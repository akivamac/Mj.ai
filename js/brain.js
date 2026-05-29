const Brain = (() => {
  const BRAIN_VERSION = '75'; // bump when brain JSON files change (and the ?v= in index.html)

  // Confirmation state for "forget everything" — set when Joe asks, cleared
  // on next turn.
  let _forgetEverythingPending = false;

  // Drawing-context state (v58). Set when the user submits a drawing;
  // turn 2 collects the description, turn 3 spins a story.
  let _drawingContext = null;

  let knowledge = null;
  let rules = null;
  let terminal = null;
  let coding = null;
  let templates = null;
  let dictionary = null;
  let storyBeats = null;
  let errors = null;
  let recipes = null;
  let debugging = null;
  let responseFlavors  = null;
  let mathTutorials    = null;
  let mathFlavors      = null;
  let scienceTutorials = null;
  let scienceFlavors   = null;

  // Phase 3: response flavoring + story hook
  const FLAVOR_CHANCE      = 0.25;
  const FLAVOR_CHANCE_BUSY = 0.05;  // drops to this when recently flavored
  const PROCEDURAL_CHANCE  = 0.30;  // prepend a micro to a greeting/thanks
  const STORY_HOOK_CHANCE  = 0.15;  // suggest a story after a strong fact hit
  const SKIP_FLAVOR_WORDS  = ['just ', ' just', 'quick', 'briefly', 'short', 'tldr', 'tl;dr'];
  let _recentFlavorAge = 99;  // turns since last flavored response
  let _storyHookSubject = null;
  let _storyHookKeywords = null;
  let _storyHookAge = 99;     // turns since story hook offered
  let _lastMathContext = null; // {cleaned, result} of the last computed answer
  let _lastMathAge = 99;      // turns since that answer (for "how does this work?")

  async function load() {
    // If version changed, clear cache and reload from JSON
    if (localStorage.getItem('mj_brain_version') !== BRAIN_VERSION) {
      localStorage.removeItem('mj_brain_knowledge');
      localStorage.removeItem('mj_brain_rules');
      localStorage.removeItem('mj_brain_terminal');
      localStorage.removeItem('mj_brain_coding');
      localStorage.removeItem('mj_brain_templates');
      localStorage.removeItem('mj_brain_dictionary');
      localStorage.removeItem('mj_brain_storyBeats');
      localStorage.removeItem('mj_brain_errors');
      localStorage.removeItem('mj_brain_recipes');
      localStorage.removeItem('mj_brain_debugging');
      localStorage.removeItem('mj_brain_responseFlavors');
      localStorage.removeItem('mj_brain_mathTutorials');
      localStorage.removeItem('mj_brain_mathFlavors');
      localStorage.removeItem('mj_brain_scienceTutorials');
      localStorage.removeItem('mj_brain_scienceFlavors');
      localStorage.setItem('mj_brain_version', BRAIN_VERSION);
    }

    knowledge       = Storage.getBrain('knowledge');
    rules           = Storage.getBrain('rules');
    terminal        = Storage.getBrain('terminal');
    coding          = Storage.getBrain('coding');
    templates       = Storage.getBrain('templates');
    dictionary      = Storage.getBrain('dictionary');
    storyBeats      = Storage.getBrain('storyBeats');
    errors          = Storage.getBrain('errors');
    recipes         = Storage.getBrain('recipes');
    debugging       = Storage.getBrain('debugging');
    responseFlavors  = Storage.getBrain('responseFlavors');
    mathTutorials    = Storage.getBrain('mathTutorials');
    mathFlavors      = Storage.getBrain('mathFlavors');
    scienceTutorials = Storage.getBrain('scienceTutorials');
    scienceFlavors   = Storage.getBrain('scienceFlavors');

    if (!knowledge)       { knowledge       = await fetchJSON('brain/knowledge.json');       Storage.setBrain('knowledge', knowledge); }
    if (!rules)           { rules           = await fetchJSON('brain/rules.json');           Storage.setBrain('rules', rules); }
    if (!terminal)        { terminal        = await fetchJSON('brain/terminal.json');        Storage.setBrain('terminal', terminal); }
    if (!coding)          { coding          = await fetchJSON('brain/coding.json');          Storage.setBrain('coding', coding); }
    if (!templates)       { templates       = await fetchJSON('brain/templates.json');       Storage.setBrain('templates', templates); }
    if (!dictionary)      { dictionary      = await fetchJSON('brain/dictionary.json');      Storage.setBrain('dictionary', dictionary); }
    if (!storyBeats)      { storyBeats      = await fetchJSON('brain/storyBeats.json');      Storage.setBrain('storyBeats', storyBeats); }
    if (!errors)          { errors          = await fetchJSON('brain/errors.json');          Storage.setBrain('errors', errors); }
    if (!recipes)         { recipes         = await fetchJSON('brain/recipes.json');         Storage.setBrain('recipes', recipes); }
    if (!debugging)       { debugging       = await fetchJSON('brain/debugging.json');       Storage.setBrain('debugging', debugging); }
    if (!responseFlavors) { responseFlavors = await fetchJSON('brain/responseFlavors.json'); Storage.setBrain('responseFlavors', responseFlavors); }
    if (!mathTutorials)   { mathTutorials   = await fetchJSON('brain/mathTutorials.json');   Storage.setBrain('mathTutorials', mathTutorials); }
    if (!mathFlavors)     { mathFlavors     = await fetchJSON('brain/mathFlavors.json');     Storage.setBrain('mathFlavors', mathFlavors); }
    if (!scienceTutorials){ scienceTutorials= await fetchJSON('brain/scienceTutorials.json');Storage.setBrain('scienceTutorials', scienceTutorials); }
    if (!scienceFlavors)  { scienceFlavors  = await fetchJSON('brain/scienceFlavors.json');  Storage.setBrain('scienceFlavors', scienceFlavors); }

    if (typeof Generator !== 'undefined' && Generator.init) {
      Generator.init(templates, dictionary, storyBeats);
    }
    // Tick a session for memory tracking.
    if (typeof Memory !== 'undefined') Memory.tickSession();
  }

  // ── Coding dispatchers (v51) ──────────────────────────────

  // Error-pattern matcher. Walks errors.patterns and returns the first
  // entry whose `match` regex hits the input, plus capture groups for
  // {1}/{2} substitution. Tries entries with longer matches first so
  // specific patterns win over broad ones.
  function detectErrorPattern(input) {
    if (!errors || !errors.patterns) return null;
    let best = null, bestLen = 0;
    for (const p of errors.patterns) {
      try {
        const re = new RegExp(p.match);
        const m = input.match(re);
        if (m && m[0].length > bestLen) {
          best = { entry: p, match: m };
          bestLen = m[0].length;
        }
      } catch(_) {}
    }
    return best;
  }

  function substituteCaptures(text, m) {
    if (!text) return '';
    return text.replace(/\{(\d+)\}/g, (_, n) => {
      const idx = parseInt(n, 10);
      return (m && m[idx] != null) ? m[idx] : '';
    });
  }

  function formatErrorResponse(hit) {
    const e = hit.entry, m = hit.match;
    const diagnosis = substituteCaptures(e.diagnosis || '', m);
    const fixes = (e.fixes || []).map(f => '• ' + substituteCaptures(f, m)).join('\n');
    let out = `**${e.title || 'Error'}**\n\n${diagnosis}`;
    if (fixes) out += `\n\n**Try:**\n${fixes}`;
    if (e.example_fix) out += `\n\n**Example fix:**\n\`\`\`\n${e.example_fix}\n\`\`\``;
    return out;
  }

  // Trigger matcher. Scoring:
  //   substring-match of a multi-word trigger → 3
  //   substring-match of a single-word trigger → 2
  //   all words of a 2+-word trigger present (any order) → 1
  // Single-word triggers can ONLY substring-match (otherwise "git" alone
  // would hit on every passing mention of git).
  // Substring match that respects word boundaries — `ph` in `photosynthesis`
  // should NOT match. Both surrounding chars must be non-letter.
  function _wordContains(haystack, needle) {
    let from = 0;
    while (from < haystack.length) {
      const i = haystack.indexOf(needle, from);
      if (i < 0) return false;
      const before = i === 0 ? ' ' : haystack[i - 1];
      let endIdx = i + needle.length;
      // Tolerate a single trailing plural 's' on the matched word so a
      // singular trigger ("punnett square") matches a plural query
      // ("punnett squares"). (v64)
      if (haystack[endIdx] === 's' && needle.slice(-1) !== 's') endIdx += 1;
      const after = endIdx >= haystack.length ? ' ' : haystack[endIdx];
      if (!/[a-z]/i.test(before) && !/[a-z]/i.test(after)) return true;
      from = i + 1;
    }
    return false;
  }

  function findByTriggers(entries, lower, minScore = 2) {
    if (!entries || !entries.length) return null;
    let best = null, bestScore = 0;
    for (const e of entries) {
      let score = 0;
      for (const trig of (e.triggers || [])) {
        const t = trig.toLowerCase();
        const wordCount = t.split(/\s+/).filter(w => w.length > 1).length;
        if (_wordContains(lower, t)) {
          score += (wordCount >= 2) ? 3 : 2;
          continue;
        }
        if (wordCount >= 2) {
          const words = t.split(/\s+/).filter(w => w.length > 1);
          if (words.every(w => _wordContains(lower, w))) score += 1;
        }
      }
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return bestScore >= minScore ? best : null;
  }

  function formatRecipeResponse(r) {
    let out = `**${r.title}**\n\n\`\`\`${(r.languages && r.languages[0]) || ''}\n${r.code}\n\`\`\``;
    if (r.notes) out += `\n\n${r.notes}`;
    out += `\n\n🐒`;
    return out;
  }

  function formatDebuggingResponse(g) {
    let out = `**${g.title}**\n\n`;
    const steps = (g.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n');
    if (steps) out += `**Steps:**\n${steps}`;
    if (g.tips && g.tips.length) {
      out += `\n\n**Tips:**\n` + g.tips.map(t => '• ' + t).join('\n');
    }
    return out;
  }

  // Heuristic: does the input look like a pasted code block? Needs to be
  // permissive enough to catch multi-line snippets and strict enough to
  // not fire on prose. Triggers when:
  //   - input has ≥ 3 lines AND ≥ 2 code-indicator tokens, OR
  //   - input is wrapped in ``` fences.
  function looksLikeCode(input) {
    if (!input) return false;
    if (/^```|```[a-z]*\n/.test(input)) return true;
    // Single-line: unmistakable shell-pipeline / loop syntax. Avoids
    // letting "for f in $(ls); do echo $f; done" fall through to the
    // generic knowledge lookup.
    if (/\$\([^)]+\)/.test(input) && /\b(do|done|then|fi|elif|case|esac)\b/.test(input)) return true;
    if (/^#!\//.test(input)) return true;
    const lines = input.split('\n');
    if (lines.length < 3) return false;
    // `gm` flags so `^\s+\S` (indented line) matches every indented line,
    // not just the first one.
    const codeRe = /(\b(function|def|class|import|require|const|let|var|return|if|else|elif|for|while|try|catch|except|console\.log|print\(|System\.|public|private|static|interface|type|enum|fn|impl)\b|[{};]|=>|->|::|\$\(|<<|^\s+\S)/gm;
    const indicators = (input.match(codeRe) || []).length;
    return indicators >= 3;
  }

  function detectLanguage(code) {
    const sigs = {
      python:     /^(?:\s*)(?:def |class |from .+ import|import [a-z_]+$|if __name__|@\w+\s*\n\s*def)|:\s*$|\bprint\(|self\.|\bNone\b|\bTrue\b|\bFalse\b|\belif\b/m,
      javascript: /\b(function |const |let |=>|console\.log|require\(|module\.exports|export (?:default |const )|import .* from)\b|;\s*$/m,
      typescript: /\b(interface |type \w+ =|as (?:string|number|boolean|any|unknown)|: (?:string|number|boolean|any|unknown)|enum |readonly )\b/,
      bash:       /^(?:#!\/bin\/(?:bash|sh|zsh)|set -[a-zeuxo]+|echo |if \[|for \w+ in|fi$|done$|esac$)/m,
      java:       /\b(public class |System\.out\.|String\[\]|public static void)\b/,
      rust:       /\b(fn \w+|let mut |impl |trait |use std::)\b/,
      go:         /\b(func \w+|package main|fmt\.Println|interface\{\})\b/,
      sql:        /\b(SELECT |FROM |WHERE |INSERT INTO|UPDATE |DELETE FROM|CREATE TABLE)\b/i,
      html:       /<\/?(html|head|body|div|span|a|p|h[1-6]|script|style|table|tr|td|ul|li|button|input|form)\b/i,
      css:        /^[\s\w.#-]+\{[^}]*:\s*[^}]+;[^}]*\}/m
    };
    let best = null, bestScore = 0;
    for (const [lang, re] of Object.entries(sigs)) {
      const g = new RegExp(re.source, (re.flags || '') + (re.flags.includes('g') ? '' : 'g'));
      const matches = code.match(g);
      const score = matches ? matches.length : 0;
      if (score > bestScore) { bestScore = score; best = lang; }
    }
    return bestScore > 0 ? best : null;
  }

  function critiqueCode(code, lang) {
    const issues = [];
    // Generic bracket balance.
    const opens  = (code.match(/[{([]/g) || []).length;
    const closes = (code.match(/[})\]]/g) || []).length;
    if (opens !== closes) {
      issues.push(`Unbalanced brackets/braces/parens: ${opens} opening vs ${closes} closing. Look for a stray \`(\`, \`{\`, or \`[\` (or a missing closer).`);
    }
    // Generic unclosed string (odd count of un-escaped quotes on a single line)
    for (const line of code.split('\n')) {
      const sq = (line.match(/(?<!\\)'/g) || []).length;
      const dq = (line.match(/(?<!\\)"/g) || []).length;
      if (sq % 2 || dq % 2) {
        if (line.trim().length && !line.trim().startsWith('#') && !line.trim().startsWith('//')) {
          issues.push(`Likely unclosed string on a line: \`${line.trim().slice(0, 80)}\``);
          break;
        }
      }
    }
    if (lang === 'python') {
      if (/^\t/m.test(code) && /^ /m.test(code)) {
        issues.push('Mixed tabs and spaces in indentation — Python rejects this. Pick one (PEP 8 recommends 4 spaces).');
      }
      const blockLineRe = /^(\s*)(def |if |elif |else|for |while |class |try|except|finally|with |async def |elif )/;
      for (const line of code.split('\n')) {
        const m = line.match(blockLineRe);
        if (m && !line.trim().endsWith(':') && !/[\\(]$/.test(line.trimEnd())) {
          issues.push(`Missing colon at end of block-opening line: \`${line.trim().slice(0,80)}\``);
          break;
        }
      }
      if (/\bprint\s+(?!\()/.test(code) && /\bprint\s+['"]/.test(code)) {
        issues.push('`print` used without parentheses — that\'s Python 2 syntax. Use `print(...)` for Python 3.');
      }
      if (/except\s*:\s*$/m.test(code)) {
        issues.push('Bare `except:` swallows ALL exceptions, including KeyboardInterrupt and SystemExit. Catch a specific class instead.');
      }
      if (/\bis\s+(?:0|1|-?\d+|".+?"|'.+?')\b/.test(code) || /\b(?:0|1|-?\d+)\s+is\b/.test(code)) {
        issues.push('Using `is` to compare with a literal (number/string). Use `==` — `is` only checks identity, not value.');
      }
    }
    if (lang === 'javascript' || lang === 'typescript') {
      if (/[^=!]==[^=]/.test(code)) {
        issues.push('Loose equality (`==`) detected. Prefer `===` for strict comparison — `==` does type coercion (`"0" == false` is true).');
      }
      if (/\bvar\s+\w/.test(code)) {
        issues.push('Using `var` — prefer `let` (mutable, block-scoped) or `const` (immutable). `var` has function-level scoping that surprises people.');
      }
      if (/console\.log\(.*\bawait\b/.test(code) && !/\basync\b/.test(code)) {
        issues.push('Using `await` inside a function that isn\'t marked `async`. Add `async` to the function declaration.');
      }
      const setStateRe = /set([A-Z]\w*)\s*\(\s*\w+\s*[+\-*/%]/;
      if (setStateRe.test(code) && /useState|setState/.test(code)) {
        issues.push('Updating React state based on the previous value? Use the functional form: `setX(prev => prev + 1)` to avoid stale-closure bugs.');
      }
    }
    if (lang === 'bash') {
      if (/\bif\s+\[\s+\$\w+\s/.test(code)) {
        issues.push('Unquoted variable in `[ $X ]` — quote it: `[ "$X" = "..." ]` so empty/whitespace values don\'t blow up the test.');
      }
      if (/`[^`]+`/.test(code)) {
        issues.push('Using backticks for command substitution. Prefer `$(...)` — it nests cleanly and is easier to read.');
      }
      if (!/set\s+-[eu]/.test(code) && code.split('\n').length > 5) {
        issues.push('No `set -e` (or `set -euo pipefail`) at the top. Without it, a failing command in the middle of the script is silently ignored.');
      }
      if (/\bfor\s+\w+\s+in\s+\$\(ls\b/.test(code)) {
        issues.push('Looping over `$(ls)` is fragile (breaks on spaces/newlines in filenames). Use globs: `for f in *.txt; do ...; done`.');
      }
    }
    return issues;
  }

  function formatCodeCritique(lang, issues) {
    const tag = lang ? lang.charAt(0).toUpperCase() + lang.slice(1) : 'Code';
    if (!issues.length) {
      return `${tag} block detected. I scanned it for common patterns and didn't spot anything obvious — but I only do pattern checks, not real parsing. Want me to look at a specific error message? 🐒`;
    }
    return `${tag} block detected. A few things I noticed:\n\n` +
      issues.map(s => '• ' + s).join('\n') +
      `\n\nThese are pattern-based hints, not a real parser — your tooling will catch more. 🐒`;
  }

  async function fetchJSON(path) {
    try { const r = await fetch(path); return await r.json(); } catch(_) { return {}; }
  }

  function pick(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : ''; }

  // ── Context memory ────────────────────────────────────────
  let _lastTopicKeywords = [];
  let _lastTopicLabel    = '';
  let _lastFactAnswer    = '';

  // ── Story session state (Phase 4) ─────────────────────────
  // Set when Joe generates a story, used to keep characters/place/tone
  // consistent on follow-ups like "continue", "what happens next", "chapter 2".
  let _storySession = null;

  // Map mood keywords from a story request to the generator's tone tags.
  const storyToneKeywords = {
    silly:       ['silly', 'funny', 'goofy', 'wacky', 'absurd', 'wild', 'hilarious'],
    spooky:      ['spooky', 'scary', 'creepy', 'ghost', 'eerie', 'haunted', 'horror', 'frightening'],
    adventure:   ['adventure', 'exciting', 'brave', 'epic', 'heroic', 'quest', 'thrilling', 'daring'],
    cozy:        ['bedtime', 'cozy', 'calm', 'gentle', 'sleepy', 'peaceful', 'quiet', 'sleep', 'soft', 'soothing'],
    magical:     ['magical', 'magic', 'fantasy', 'enchanted', 'wondrous', 'mystical', 'fairy', 'fairytale'],
    bittersweet: ['bittersweet', 'sad-happy', 'happy-sad', 'sweet sad', 'gentle sad'],
    triumphant:  ['triumphant', 'victorious', 'heroic ending', 'epic win', 'glorious'],
    mysterious:  ['mysterious', 'mystery', 'enigmatic', 'puzzling', 'cryptic'],
    whimsical:   ['whimsical', 'quirky', 'fanciful', 'odd', 'peculiar'],
    wistful:     ['wistful', 'nostalgic', 'longing', 'remembering', 'long ago']
  };
  function detectStoryTone(lower) {
    for (const [tone, words] of Object.entries(storyToneKeywords)) {
      if (words.some(w => new RegExp('\\b' + w + '\\b').test(lower))) return tone;
    }
    return null;
  }

  // "longer story" / "weave me a tale" → use beat-chain mode.
  const longerStoryPatterns = [
    /\b(longer|a long|a longer)\s+(story|tale|adventure)\b/i,
    /\bweave\s+(me\s+)?a\s+(tale|story)\b/i,
    /\btell\s+(me\s+)?an?\s+adventure\b/i,
    /\b(epic|grand|sprawling)\s+(story|tale|adventure)\b/i,
    /\b(big|long)\s+story\s+please/i
  ];
  const microStoryPatterns = [
    /\b(shorter|short|tiny|quick)\s+(story|tale)\b/i,
    /\bjust\s+one\s+line\b/i,
    /\bone[-\s](line|sentence)\s+(story|tale)\b/i,
    /\bmicro[-\s]?story\b/i,
    /\bbriefly\s+a\s+story\b/i
  ];
  function detectStoryMode(lower) {
    if (longerStoryPatterns.some(re => re.test(lower))) return 'beats';
    if (microStoryPatterns.some(re => re.test(lower))) return 'micro';
    return null;
  }

  // "another" / "one more" — generate another story in the same tone if
  // a session exists. Match the whole message strictly so mid-sentence
  // uses don't trigger.
  const anotherPatterns = [
    /^(another|one more|another one|do another|tell another|give another|one more please|another please)[\s!.?]*$/i,
    /^(another (story|tale)|one more (story|tale))[\s!.?]*$/i
  ];
  function detectAnother(input) {
    return anotherPatterns.some(re => re.test(input.trim()));
  }

  // "tell me about a brave fox" / "what about a sneaky raccoon" — generate
  // a micro story featuring that ADJ + NOUN. Returns { adj, noun } or null.
  function detectAboutMicroStory(lower) {
    const m = lower.match(/^(?:tell me|what)\s+about\s+(?:a|an)\s+([a-z]+)\s+([a-z]+)[\s!.?]*$/i);
    if (!m) return null;
    return { adj: m[1], noun: m[2] };
  }

  // Score a fact's keyword overlap with a tone's keyword bank — used to
  // pick a thematically appropriate fact when the user asks for a toned
  // story without specifying a subject.
  const toneFactKeywords = {
    spooky:     ['wolf','cave','midnight','grave','witch','ghost','dark','shadow','night','blood','spider','snake','bat','crow','poison','venom','haunt','death'],
    cozy:       ['cat','dog','tea','bread','sleep','baby','warm','blanket','home','family','kitten','puppy','milk','honey','cookie'],
    adventure:  ['mountain','ocean','sail','climb','journey','treasure','explore','discover','volcano','jungle','expedition','space','astronaut'],
    magical:    ['unicorn','dragon','fairy','spell','star','moon','aurora','rainbow','wonder','magic','enchanted','phoenix'],
    silly:      ['monkey','banana','laugh','joke','silly','funny','platypus','penguin','octopus'],
    mysterious: ['mystery','ancient','old','vanish','lost','secret','riddle','unknown','disappear'],
    wistful:    ['old','ancient','remember','past','memory','long ago','first','original','forgotten'],
    triumphant: ['won','victory','hero','first','fastest','greatest','tallest','largest'],
    whimsical:  ['butterfly','jellyfish','platypus','octopus','flamingo','peacock'],
    bittersweet:['memory','end','last','goodbye','remember','past']
  };
  function pickToneAwareFact(facts, tone) {
    if (!facts || !facts.length) return null;
    if (!tone || !toneFactKeywords[tone]) return pick(facts);
    const kws = toneFactKeywords[tone];
    let best = null, bestScore = 0;
    for (const f of facts) {
      const blob = ((f.answer || '') + ' ' + ((f.keywords||[]).join(' '))).toLowerCase();
      let score = 0;
      for (const kw of kws) if (blob.includes(kw)) score++;
      if (score > bestScore) { bestScore = score; best = f; }
    }
    return best || pick(facts);
  }

  // Pull the subject out of a story request ("story about elephants" → "elephants").
  // Returns the raw and a naïve singular form so the caller can try both for lookup.
  function extractStorySubject(lower) {
    let raw = null;
    let m = lower.match(/\babout\s+(?:a|an|the|some|my|your)?\s*([a-z][a-z\s\-']*?)(?:\s*[?.!,;]|$)/);
    if (m) raw = m[1].trim();
    if (!raw) {
      m = lower.match(/\b(?:a|an|the)\s+([a-z\-]+)\s+(?:story|tale|adventure)\b/);
      if (m) {
        const word = m[1];
        const toneWords = Object.values(storyToneKeywords).flat();
        // "silly story" — the captured word is a tone, not a subject. Skip.
        const sizeOrCount = ['short', 'long', 'quick', 'small', 'big', 'little', 'tiny', 'huge', 'bedtime', 'good', 'nice', 'new', 'another'];
        if (!toneWords.includes(word) && !sizeOrCount.includes(word)) raw = word;
      }
    }
    if (!raw) return { raw: null, singular: null, lastWord: null, lastSingular: null };
    raw = raw.replace(/[.!?,;]+$/, '').trim();
    const singularize = (w) => {
      if (!w || w.length <= 3) return w;
      if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
      // Don't strip "s" off endings like "us" / "is" / "ss" — those mark
      // singulars (octopus, analysis, kiss), not plurals.
      if (/(us|is|ss)$/.test(w)) return w;
      if (w.endsWith('ses')) return w.slice(0, -2);
      if (w.endsWith('s'))   return w.slice(0, -1);
      return w;
    };
    const singular = singularize(raw);
    const words = raw.split(/\s+/);
    const lastWord = words.length > 1 ? words[words.length - 1] : null;
    const lastSingular = lastWord ? singularize(lastWord) : null;
    return { raw, singular, lastWord, lastSingular };
  }

  // Match "continue", "what happens next", etc. — strictly anchored so
  // mid-sentence uses like "when did the war continue" don't trigger.
  // Trailing politeness/filler that shouldn't block a continuation match.
  const TRAIL = '(\\s+(please|now|joe|please now))?[\\s!.?]*$';
  const continuationPatterns = [
    new RegExp('^(continue|keep going|keep writing|go on|continue the (story|book|tale))' + TRAIL, 'i'),
    new RegExp('^what happens next' + TRAIL, 'i'),
    /^(tell me more|more please|more story|i want more|more!?)[\s!.?]*$/i,
    // chapter/part continuations, incl. "make/write/give me the next chapter",
    // "another chapter", "the next page" — book mode (v66). Without these,
    // "make the next chapter" fell through to the coding-fact scorer.
    new RegExp('^(make|write|do|give me|create|start|add|spin|read)\\s+(me\\s+)?(the\\s+|a\\s+|another\\s+)?(next\\s+)?(chapter|part|page|section)' + TRAIL, 'i'),
    new RegExp('^(the\\s+)?next (chapter|part|page|section)' + TRAIL, 'i'),
    new RegExp('^(another|one more) (chapter|part|page|section|bit)' + TRAIL, 'i'),
    // bare "next" / "next." / "next please" — shorthand for "next chapter" (v69)
    new RegExp('^next' + TRAIL, 'i'),
    /^(the next part|then what|and then\??|and\?)[\s!.?]*$/i
  ];
  function detectStoryContinuation(input) {
    return continuationPatterns.some(re => re.test(input.trim()));
  }

  const resetPatterns = [
    /^(end (the |my )?story|stop (the |my )?story|end story|stop story)[\s!.?]*$/i,
    /^(new story|start over|reset story|forget that story)[\s!.?]*$/i,
    /^(that's enough|i'm done)[\s!.?]*$/i
  ];
  function detectStoryReset(input) {
    return resetPatterns.some(re => re.test(input.trim()));
  }

  // Look up a fact for fact-weaving. Only exact keyword matches count —
  // partial matches would weave the wrong fact (e.g. "monkey" matching the
  // multi-word "monkey joe" identity keyword). Tries raw + singular form.
  function findFactForSubject(subject, knowledge, coding) {
    if (!subject || !subject.raw) return null;
    const tries = [];
    for (const v of [subject.raw, subject.singular, subject.lastWord, subject.lastSingular]) {
      if (v && !tries.includes(v)) tries.push(v);
    }
    const allFacts = ((knowledge && knowledge.facts) || []).concat((coding && coding.facts) || []);
    for (const term of tries) {
      const t = term.toLowerCase();
      for (const fact of allFacts) {
        if (!fact.keywords) continue;
        for (const kw of fact.keywords) {
          if (t === kw.toLowerCase()) return fact;
        }
      }
    }
    return null;
  }

  function detectFollowUp(lower) {
    const pronounTriggers = ['they ','their ','them ','it ','its ','the animal','the creature','those animals','that animal'];
    const starterTriggers = ['and ','also ','but what','what about ','how about ','tell me more','more about','what else','same with','what do they','how do they','where do they','can they','do they '];
    return pronounTriggers.some(w => lower.includes(w)) || starterTriggers.some(w => lower.startsWith(w));
  }

  // ── Phase 3: response flavoring ──────────────────────────
  // Pick a flavor entry from a pool, preferring same-tone if any match.
  function pickTonedFlavor(pool, tone) {
    if (!pool || !pool.length) return null;
    if (tone) {
      const toned = pool.filter(e => e.tone && e.tone.includes(tone));
      if (toned.length) return pick(toned);
    }
    return pick(pool);
  }

  function renderFlavor(text, tone) {
    if (typeof Generator !== 'undefined' && Generator.fillSlots) {
      return Generator.fillSlots(text, { tone });
    }
    return text;
  }

  // Decide whether to flavor this response.
  function shouldFlavor(lower) {
    if (!responseFlavors) return false;
    for (const w of SKIP_FLAVOR_WORDS) {
      if (lower.includes(w)) return false;
    }
    const chance = (_recentFlavorAge <= 2) ? FLAVOR_CHANCE_BUSY : FLAVOR_CHANCE;
    return Math.random() < chance;
  }

  // Wrap a fact answer in a leadIn / signOff / responseWrap flourish.
  function flavorFact(answer, tone) {
    if (!responseFlavors || !answer) return answer;
    const types = [];
    if (responseFlavors.leadIns  && responseFlavors.leadIns.length)  types.push('leadIn');
    if (responseFlavors.signOffs && responseFlavors.signOffs.length) types.push('signOff');
    if (responseFlavors.responseWraps && responseFlavors.responseWraps.length) types.push('wrap');
    if (!types.length) return answer;
    const t = pick(types);
    if (t === 'leadIn') {
      const e = pickTonedFlavor(responseFlavors.leadIns, tone);
      if (!e) return answer;
      return renderFlavor(e.text, tone) + '\n\n' + answer;
    }
    if (t === 'signOff') {
      const e = pickTonedFlavor(responseFlavors.signOffs, tone);
      if (!e) return answer;
      return answer + '\n\n' + renderFlavor(e.text, tone);
    }
    // wrap: before-fact-after sandwich
    const e = pick(responseFlavors.responseWraps);
    if (!e || !e.before || !e.after) return answer;
    return renderFlavor(e.before, null) + '\n\n' + answer + '\n\n' + renderFlavor(e.after, null);
  }

  // Append a "want a story about that?" hook to a fact answer.
  // Tracks the topic so a follow-up "yes"/"tell me a story" within 2
  // turns can spin a fact-woven story without re-asking.
  function maybeAppendStoryHook(answer, fact) {
    if (!fact || !fact.keywords || !fact.keywords.length) return answer;
    if (Math.random() >= STORY_HOOK_CHANCE) return answer;
    _storyHookSubject  = fact.keywords[0];
    _storyHookKeywords = fact.keywords;
    _storyHookAge      = 0;
    return answer + "\n\nWant a story about that? Just say 'tell me a story about it' 🐒";
  }

  // 30% chance to prepend a microStory to short canned replies (greetings,
  // thanks, "good job"). Skip if dictionary/templates not loaded.
  function withProcedural(text) {
    if (!templates || !dictionary) return text;
    if (Math.random() >= PROCEDURAL_CHANCE) return text;
    if (typeof Generator === 'undefined' || !Generator.generateStory) return text;
    const tone = pick([null, 'silly', 'cozy', 'whimsical']);
    const r = Generator.generateStory({ mode: 'micro', tone });
    if (!r || !r.text || r.text.startsWith('I want to tell stories')) return text;
    return r.text + ' ' + text;
  }

  // Detect a short affirmative reply that should trigger the story-hook
  // follow-up (only valid within 2 turns of the hook firing).
  function isStoryHookYes(lower) {
    if (_storyHookAge > 2 || !_storyHookSubject) return false;
    return /^(yes|yeah|sure|yep|yup|ok|okay|go on|do it|please do|tell me|tell me a story(?: about it)?|story please)[\s!.?]*$/i.test(lower);
  }

  // ── Phase 6 (v55): math dispatcher ───────────────────────
  //
  // Routes math input by intent: COMPUTE (just answer), WORKED (answer +
  // steps), TEACH (concept explainer), DEFINE (short definition). The
  // four intents share a small classifier (regex/keyword, no NLP).
  // Tutorials and flavors load lazily — if they're missing, TEACH and
  // DEFINE silently fall through.

  const MATH_KEYWORDS = ['percent','percentage','fraction','decimal','equation',
    'variable','exponent','root','prime','average','mean','median','mode','ratio',
    'proportion','algebra','geometry','area','perimeter','volume','conversion',
    'unit','derivative','integral','limit','vector','matrix','determinant',
    'eigenvalue','slope','quadratic','linear','polynomial','factor','divisor',
    'multiple','prob','probability','combination','permutation','pythagoras',
    'pythagorean','trig','sine','cosine','tangent','log','logarithm','radian',
    'degree','number','digit',
    'arithmetic','division','multiplication','addition','subtraction',
    'modular','modulo','set','logic','induction','recurrence','big-o',
    'normal distribution','z-score','central limit','confidence interval',
    'p-value','hypothesis','standard deviation','correlation','histogram',
    'long division','order of operations','pemdas','negative number',
    'square root','cube root','exponential','factorial','sequence',
    'theorem','formula','calculus','statistics','stats'];
  const TEACH_RE  = /\b(how (?:do|does|to) .+|explain|teach me|i (?:don't|do not|dont) (?:get|understand)|confused about|why (?:is|does|do)|what does it mean|walk me through|help me with|show me)\b/i;
  const DEFINE_RE = /^(what is (?:a |an |the )?|what are (?:a |an |the )?|what's (?:a |an |the )?|what're (?:a |an |the )?|whats (?:a |an |the )?|define )/i;
  const WORKED_RE = /\b(show (?:your |the )?work|step by step|show me how|show me|walk me through|how do I solve|why is .* equal|with work|with steps)\b/i;
  const MATH_SKIP_RE = /\b(just|quick|briefly|short|tldr|tl;dr)\b/i;

  function hasMathKeyword(lower) {
    return MATH_KEYWORDS.some(k => lower.includes(k));
  }

  function classifyMathIntent(input, lower) {
    if (typeof MathEngine === 'undefined') return null;
    const conv = MathEngine.parseConversion(input);
    const compute = conv || MathEngine.looksLikeMath(input);
    // Match `x` as a variable: not glued to another letter. Allows `2x`,
    // `x = 5`, `x+1`. Rejects `tax`, `fix`, `xy`.
    const eqLike = /=/.test(input) && /(?<![a-z])x(?![a-z])/i.test(input);
    const statsLike = /^(mean|median|mode|average|stats|stddev|stdev|variance|sum|range)\b/i.test(input.trim());
    const primeLike = /\bis\s+\d+\s+prime\b/i.test(input);
    const factorLike = /^(factor|prime factor|factorize|factorise|primes? of)\s+\d+/i.test(input.trim());
    const isComputable = compute || eqLike || statsLike || primeLike || factorLike;

    // WORKED beats COMPUTE when both apply.
    if (isComputable && WORKED_RE.test(input)) return 'WORKED';
    if (isComputable) return 'COMPUTE';

    // Teaching paths require a math keyword OR a direct tutorial-trigger hit —
    // the latter so newly-added tutorial topics are reachable without growing
    // the keyword list (v64). gate = keyword OR a tutorial whose triggers match.
    const mathGate = () => hasMathKeyword(lower) ||
      !!(mathTutorials && mathTutorials.tutorials && findByTriggers(mathTutorials.tutorials, lower, 2));
    if (TEACH_RE.test(input) && mathGate()) return 'TEACH';
    if (DEFINE_RE.test(input) && mathGate() && input.length < 80) return 'DEFINE';
    // Bare math noun phrase ("pythagorean theorem", "quadratic formula") with
    // no question words — treat as DEFINE so the tutorial bank can answer.
    if (input.length < 40 && mathGate()
        && !/\?$/.test(input) && /^[a-z' \-]+$/i.test(input.trim())) return 'DEFINE';
    return null;
  }

  function _fmt(n) {
    return (typeof MathEngine !== 'undefined' && MathEngine.formatNumber)
      ? MathEngine.formatNumber(n) : String(n);
  }

  function _formatEquationAnswer(eq, worked) {
    if (!eq) return null;
    if (eq.type === 'identity' || eq.type === 'inconsistent') return eq.text;
    if (eq.type === 'linear') {
      if (!worked) return `x = ${_fmt(eq.x)}`;
      return `x = ${_fmt(eq.x)}\n\nWork:\n  ${eq.lhs} = ${eq.rhs}\n  ${eq.a}x = ${_fmt(-eq.b)}\n  x = ${_fmt(-eq.b)} / ${eq.a}\n  x = ${_fmt(eq.x)}`;
    }
    if (eq.type === 'quadratic') {
      if (eq.complex) {
        const head = `No real solutions (discriminant = ${_fmt(eq.discriminant)} < 0).`;
        if (!worked) return head;
        return head + `\n\nWork:\n  ${eq.lhs} = ${eq.rhs}\n  → ${eq.a}x² + ${_fmt(eq.b)}x + ${_fmt(eq.c)} = 0\n  discriminant = b² - 4ac = ${eq.b}² - 4(${eq.a})(${eq.c}) = ${_fmt(eq.discriminant)}\n  Negative → no real roots.`;
      }
      const roots = eq.x !== undefined ? `x = ${_fmt(eq.x)} (double root)`
                  : `x = ${_fmt(eq.x1)} or x = ${_fmt(eq.x2)}`;
      if (!worked) return roots;
      const sd = Math.sqrt(eq.discriminant);
      return `${roots}\n\nWork:\n  ${eq.lhs} = ${eq.rhs}\n  → ${eq.a}x² + ${_fmt(eq.b)}x + ${_fmt(eq.c)} = 0\n  discriminant = b² - 4ac = ${eq.b * eq.b} - ${4 * eq.a * eq.c} = ${_fmt(eq.discriminant)}\n  x = (-b ± √d) / 2a = (${_fmt(-eq.b)} ± ${_fmt(sd)}) / ${_fmt(2 * eq.a)}\n  → ${roots}`;
    }
    return null;
  }

  function _formatStats(s, worked) {
    if (!s) return null;
    if (!worked) {
      return `mean ${_fmt(s.mean)}, median ${_fmt(s.median)}, stdev ${_fmt(s.stdev)} (n=${s.n})`;
    }
    return `mean ${_fmt(s.mean)}, median ${_fmt(s.median)}, mode ${s.mode != null ? _fmt(s.mode) : '—'}, stdev ${_fmt(s.stdev)} (n=${s.n})\n\nDetail:\n  sum = ${_fmt(s.sum)}\n  min = ${_fmt(s.min)}, max = ${_fmt(s.max)}, range = ${_fmt(s.range)}\n  variance = ${_fmt(s.variance)}`;
  }

  function _formatConversion(c) {
    if (!c) return null;
    return `${_fmt(c.input)} ${c.from} = ${_fmt(c.value)} ${c.to}`;
  }

  function _formatPrime(n, worked) {
    const p = MathEngine.isPrime(n);
    if (!worked) return p ? `Yes — ${n} is prime.` : `No — ${n} = ${MathEngine.primeFactor(n).join(' × ')}.`;
    if (p) return `Yes — ${n} is prime.\n\n(Checked: no divisor between 2 and √${n} = ${_fmt(Math.sqrt(n))} divides it cleanly.)`;
    const f = MathEngine.primeFactor(n);
    return `No — ${n} = ${f.join(' × ')}.\n\nWork: trial-divided by 2, 3, 5, 7, ... until we found ${f[0]} divides ${n}, then continued on the quotient.`;
  }

  function _extractNumbers(s) {
    return (String(s).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  }

  // ── Math voice layer (v55 phase 3) ─────────────────────
  // ~20% chance to append a one-line garnish to a math answer. Skips
  // when the user's message has skip-words (just/quick/briefly/short
  // /tldr/tl;dr) — same brevity gate as fact-flavoring. Tries to match
  // a relevant garnish; if no relevant match, may use a generic
  // "any"-matched one.
  const MATH_GARNISH_CHANCE = 0.20;

  function maybeGarnishMath(answer, input, lower) {
    if (!mathFlavors || !mathFlavors.garnishes || !mathFlavors.garnishes.length) return answer;
    if (!answer || typeof answer !== 'string') return answer;
    if (MATH_SKIP_RE.test(lower)) return answer;
    if (Math.random() >= MATH_GARNISH_CHANCE) return answer;
    const answerStr = answer.trim();
    const lowerInput = lower;
    // Find candidates by match_type — collect all matches then pick one.
    const candidates = [];
    for (const g of mathFlavors.garnishes) {
      const t = g.match_type, trigs = g.triggers || [];
      if (t === 'any') { candidates.push(g); continue; }
      if (t === 'input_contains' && trigs.some(s => lowerInput.includes(s.toLowerCase()))) {
        candidates.push(g);
      } else if (t === 'answer_equals' && trigs.some(s => answerStr === s)) {
        candidates.push(g);
      } else if (t === 'answer_contains' && trigs.some(s => answerStr.includes(s))) {
        candidates.push(g);
      }
    }
    if (!candidates.length) return answer;
    // Prefer specific (non-'any') matches when available.
    const specific = candidates.filter(g => g.match_type !== 'any');
    const pick = (specific.length ? specific : candidates);
    const g = pick[Math.floor(Math.random() * pick.length)];
    return answer + '\n' + g.text;
  }

  function _handleTutorial(intent, input, lower) {
    if (!mathTutorials || !mathTutorials.tutorials) return null;
    // Reuse the same trigger scorer as recipes/debugging.
    const tut = findByTriggers(mathTutorials.tutorials, lower, 1);
    if (!tut) return null;
    let out = `**${tut.title}**`;
    if (tut.formula) out += `   _${tut.formula}_`;
    out += '\n\n' + tut.body;
    // If the user supplied numbers AND the tutorial has a walker, run it.
    if (intent === 'TEACH' && tut.walker
        && typeof MathWalkers !== 'undefined' && MathWalkers[tut.walker]) {
      const nums = _extractNumbers(input);
      if (nums.length) {
        try {
          const walked = MathWalkers[tut.walker](nums);
          if (walked) out += '\n\n_For your numbers:_\n' + MathWalkers.formatSteps(walked);
        } catch (_) { /* swallow walker errors — tutorial body still ships */ }
      }
    }
    if (tut.tryIt) out += '\n\n' + tut.tryIt;
    return out;
  }

  // ── Science dispatcher (v55 — sibling to math) ─────────
  //
  // Routes science TEACH/DEFINE/FORMULA. Same shape as the math
  // dispatcher: a classifier returns one of three intents (or null),
  // a handler dispatches to the tutorial bank or formula compute.
  // Tutorials with a `formula` block accept variable values and
  // plug them in via MathEngine.

  const SCI_KEYWORDS = [
    // physics
    'force','mass','velocity','acceleration','momentum','energy','work','power',
    'friction','gravity','weight','motion','newton','einstein','photon','electron',
    'proton','neutron','atom','nucleus','quantum','relativity','light','sound',
    'wave','frequency','refraction','reflection','magnet','magnetic','electric','current',
    'voltage','resistance','circuit','thermodynamics','entropy','temperature','heat',
    'pressure','radioactive','radiation','isotope','spectrum','telescope',
    // chemistry
    'chemical','element','compound','molecule','bond','reaction','acid','base','ph',
    'oxidation','reduction','catalyst','mole','periodic','organic','polymer',
    'salt','ion','solution','solvent','solute','enzyme',
    // biology
    'cell','dna','rna','gene','chromosome','mitosis','meiosis','evolution','species',
    'ecosystem','photosynthesis','respiration','mitochondria','neuron','blood','heart',
    'lung','kidney','brain','muscle','organ','virus','bacteria','antibody','immune',
    'hormone','protein','amino acid','vaccine','antibiotic','microbiome',
    // astronomy
    'planet','star','sun','moon','galaxy','universe','big bang','black hole','supernova',
    'nebula','asteroid','comet','satellite','orbit','light year','parsec','redshift',
    'cosmic','exoplanet','milky way','andromeda','pulsar','quasar','dark matter',
    'dark energy','hubble','cmb',
    // earth science
    'weather','climate','atmosphere','ocean','tide','earthquake','volcano','tectonic',
    'continent','ice age','fossil','mineral','rock','soil','greenhouse',
    // scientific method
    'hypothesis','experiment','peer review','scientific method',
    // additions for coverage
    'doppler','snell','fission','fusion','radioactive decay','half-life',
    'pendulum','centripetal','kepler','schwarzschild','horizon','tide',
    'aurora','ozone','vaccine','antibody','catalysis','equilibrium',
    'electromagnetic','spectrum'
  ];

  const SCI_TEACH_RE  = /\b(how (?:do|does|to) .+|explain|teach me|i (?:don't|do not|dont) (?:get|understand)|confused about|why (?:is|does|do)|walk me through|help me with)\b/i;
  const SCI_DEFINE_RE = /^(what is (?:a |an |the )?|what are (?:a |an |the )?|what's (?:a |an |the )?|what're (?:a |an |the )?|whats (?:a |an |the )?|define )/i;
  const SCI_FORMULA_RE = /\b(plug in|with [a-z]+\s*=|using [a-z]+\s*=|where [a-z]+\s*=|=\s*\d|compute (?:the )?(?:force|energy|momentum|power|work|velocity|acceleration|pressure|wavelength|frequency))/i;
  // Formula shorthand: at least 2 `letter=number` clauses anywhere in input.
  // E.g. "F=ma with m=5 a=3" or "PV=nRT P=101 V=2 n=0.5 T=300"
  const SCI_FORMULA_SHORTHAND_RE = /([a-z]+\s*=\s*-?\d+(?:\.\d+)?[\s,]*){2,}/i;

  function hasSciKeyword(lower) {
    return SCI_KEYWORDS.some(k => lower.includes(k));
  }

  function classifyScienceIntent(input, lower) {
    // Formula shorthand can fire without keyword matches (the formula
    // name like "F=ma" is the keyword — the tutorial's triggers match it).
    if (SCI_FORMULA_SHORTHAND_RE.test(input)) return 'SCIENCE_FORMULA';
    // Gate on a science keyword OR a direct tutorial-trigger hit, so new
    // tutorial topics (Punnett squares, mitosis, …) are reachable. (v64)
    const sciTutHit = !!(scienceTutorials && scienceTutorials.tutorials && findByTriggers(scienceTutorials.tutorials, lower, 2));
    if (!hasSciKeyword(lower) && !sciTutHit) return null;
    if (SCI_FORMULA_RE.test(input)) return 'SCIENCE_FORMULA';
    if (SCI_TEACH_RE.test(input))   return 'SCIENCE_TEACH';
    if (SCI_DEFINE_RE.test(input) && input.length < 100) return 'SCIENCE_DEFINE';
    // Bare science noun phrase ("photosynthesis", "newton's second law").
    if (input.length < 40 && !/\?$/.test(input) && /^[a-z' \-]+$/i.test(input.trim())) {
      return 'SCIENCE_DEFINE';
    }
    return null;
  }

  // Extract named-variable values from input. Recognizes:
  //   "m=5 a=3", "m = 5, a = 3", "mass 5 acceleration 3",
  //   "with mass 5 and acceleration 3", "mass=5kg acceleration=3 m/s²"
  // Returns { [name]: value, [label]: value }.
  function _extractNamedNumbers(input, variables) {
    const lc = input.toLowerCase();
    const out = {};
    if (!variables) return out;
    for (const v of variables) {
      const name = v.name, label = (v.label || '').toLowerCase();
      // Try `name = N` first
      let m = new RegExp('\\b' + name + '\\s*=\\s*(-?\\d+(?:\\.\\d+)?)', 'i').exec(input);
      if (!m && label) m = new RegExp('\\b' + label.replace(/\s+/g, '\\s+') + '\\s*(?:=|is|of)?\\s*(-?\\d+(?:\\.\\d+)?)', 'i').exec(lc);
      if (m) { out[name] = parseFloat(m[1]); if (label) out[label] = parseFloat(m[1]); }
    }
    return out;
  }

  function _computeFormula(formula, input) {
    if (!formula || !formula.compute || typeof MathEngine === 'undefined') return null;
    const vars = _extractNamedNumbers(input, formula.variables);
    const need = (formula.variables || []).map(v => v.name);
    const missing = need.filter(n => vars[n] == null);
    if (missing.length) return { missing };
    // Substitute variable names with numeric values in the compute string,
    // then evaluate via MathEngine.
    let expr = formula.compute;
    for (const v of formula.variables) {
      // Replace whole-word occurrences of the variable name.
      expr = expr.replace(new RegExp('\\b' + v.name + '\\b', 'g'), '(' + vars[v.name] + ')');
    }
    const r = MathEngine.evaluateExpression(expr);
    if (!r || r.error) return null;
    return { value: r.value, vars, expr };
  }

  function handleScienceIntent(intent, input, lower) {
    if (!scienceTutorials || !scienceTutorials.tutorials) return null;
    // Always look up a tutorial first (it has the explanatory body).
    const tut = findByTriggers(scienceTutorials.tutorials, lower, 1);
    if (!tut) return null;
    let out = `**${tut.title}**`;
    if (tut.formula && tut.formula.expression) out += `   _${tut.formula.expression}_`;
    out += '\n\n' + (tut.body || '');
    // If FORMULA intent and tutorial has a formula, try to compute.
    if (intent === 'SCIENCE_FORMULA' && tut.formula) {
      const r = _computeFormula(tut.formula, input);
      if (r && r.value != null) {
        out += `\n\n_Computed:_ ${tut.formula.result_label || 'result'} = ${_fmt(r.value)}` +
               (tut.formula.result_unit ? ` ${tut.formula.result_unit}` : '');
      } else if (r && r.missing) {
        out += `\n\n_Tip:_ to compute, give me values like \`${r.missing.map(n=>`${n}=…`).join(' ')}\`.`;
      }
    } else if (tut.example) {
      out += `\n\n_Example:_ ${tut.example}`;
    }
    if (tut.tryIt) out += '\n\n' + tut.tryIt;
    return out;
  }

  // Reuses the same garnish mechanism as math, with the science pool.
  function maybeGarnishScience(answer, input, lower) {
    if (!scienceFlavors || !scienceFlavors.garnishes) return answer;
    if (!answer || typeof answer !== 'string') return answer;
    if (MATH_SKIP_RE.test(lower)) return answer;
    if (Math.random() >= MATH_GARNISH_CHANCE) return answer;
    const answerStr = answer.trim();
    const cands = [];
    for (const g of scienceFlavors.garnishes) {
      const t = g.match_type, trigs = g.triggers || [];
      if (t === 'any') { cands.push(g); continue; }
      if (t === 'input_contains' && trigs.some(s => lower.includes(s.toLowerCase()))) cands.push(g);
      else if (t === 'answer_equals' && trigs.some(s => answerStr === s)) cands.push(g);
      else if (t === 'answer_contains' && trigs.some(s => answerStr.includes(s))) cands.push(g);
    }
    if (!cands.length) return answer;
    const specific = cands.filter(g => g.match_type !== 'any');
    const pool = specific.length ? specific : cands;
    return answer + '\n' + pool[Math.floor(Math.random() * pool.length)].text;
  }

  function handleMathIntent(intent, input, lower) {
    if (typeof MathEngine === 'undefined') return null;
    if (intent === 'TEACH' || intent === 'DEFINE') {
      return _handleTutorial(intent, input, lower);
    }
    const worked = intent === 'WORKED';

    // 1. Unit conversion (highest specificity)
    const conv = MathEngine.parseConversion(input);
    if (conv) {
      const c = MathEngine.convertUnit(input);
      return c ? _formatConversion(c) : null;
    }

    // 2. Equation solving (always show work — equations benefit from it)
    if (/=/.test(input) && /(?<![a-z])x(?![a-z])/i.test(input)) {
      const eq = MathEngine.solveEquation(input);
      if (eq) return _formatEquationAnswer(eq, true);
    }

    // 3. Is X prime / prime factor
    const primeM = lower.match(/\bis\s+(\d+)\s+prime\b/);
    if (primeM) return _formatPrime(parseInt(primeM[1], 10), worked);
    const factorM = lower.match(/^(?:factor|prime factor|factorize|factorise|primes? of)\s+(\d+)/);
    if (factorM) {
      const n = parseInt(factorM[1], 10);
      const f = MathEngine.primeFactor(n);
      return f.length ? `${n} = ${f.join(' × ')}` : `${n} has no prime factors (≤ 1).`;
    }

    // 4. Stats — "mean of 4 7 9 12 15"
    if (/^(mean|median|mode|average|stats|stddev|stdev|variance|sum|range)\b/i.test(input.trim())) {
      const nums = MathEngine.parseNumberList(input);
      if (nums && nums.length) {
        const s = MathEngine.summarize(nums);
        const which = input.trim().toLowerCase().split(/\s+/)[0];
        if (which === 'mean' || which === 'average') return worked
          ? `mean = ${_fmt(s.mean)}\n\nWork: (${nums.join(' + ')}) / ${s.n} = ${_fmt(s.sum)} / ${s.n} = ${_fmt(s.mean)}`
          : _fmt(s.mean);
        if (which === 'median')   return _fmt(s.median);
        if (which === 'mode')     return s.mode != null ? _fmt(s.mode) : 'No mode — all values unique.';
        if (which === 'stddev' || which === 'stdev') return _fmt(s.stdev);
        if (which === 'variance') return _fmt(s.variance);
        if (which === 'sum')      return _fmt(s.sum);
        if (which === 'range')    return _fmt(s.range);
        return _formatStats(s, worked);
      }
    }

    // 5. Plain expression evaluation (fallback)
    if (MathEngine.looksLikeMath(input)) {
      const r = MathEngine.evaluateExpression(input);
      if (r && !r.error) {
        // Remember the calculation so a follow-up "how does this work?" (the
        // garnish invites it) can explain the operation instead of falling
        // through to the physics 'work' tutorial. (v74)
        _lastMathContext = { cleaned: r.cleaned || '', result: _fmt(r.value) };
        _lastMathAge = 0;
        return _fmt(r.value);
      }
      if (r && r.error) return null; // silently fall through on parse error
    }
    return null;
  }

  // "how does this/that work?", "how'd you do that?", "explain that" — generic
  // follow-up phrasings (no new content of their own). Used only when a math
  // answer is fresh, so it must NOT match topical "how does the heart work".
  const MATH_FOLLOWUP_RE = /^(how (?:does|do|did|d)?\s*(?:this|that|it|you)?\s*(?:work|works|do that|get that|figure that out|work that out)|how'?d you (?:do|get) that|how come|explain (?:that|this|it|how)?|show me how|but how|what do you mean|how so)[\s?.!]*$/i;

  function _isMathFollowUp(lower) {
    return MATH_FOLLOWUP_RE.test(lower.trim());
  }

  // Kid-friendly explanation of the last computed expression. Tailors the
  // wording to the dominant operation; falls back to PEMDAS for compound ones.
  function _explainLastMath(ctx) {
    if (!ctx || !ctx.cleaned) return null;
    const expr = ctx.cleaned, res = ctx.result;
    const bin = expr.match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*\)?\s*([-+*/^])\s*\(?\s*(-?\d+(?:\.\d+)?)\s*\)?$/);
    if (bin) {
      const a = bin[1], op = bin[2], b = bin[3];
      if (op === '+') return `Adding means putting amounts together. You combine ${a} and ${b} into one total, which gives ${res}. Want the long way? Say "show your work". 🐒`;
      if (op === '-') return `Subtracting means taking away. You start with ${a} and remove ${b}, and what's left is ${res}. Want it broken down? Say "show your work". 🐒`;
      if (op === '*') return `Multiplying is fast repeated adding — "${a}, ${b} times". So ${a} × ${b} stacks up to ${res}. Want the steps? Say "show your work". 🐒`;
      if (op === '/') return `Dividing is splitting into equal groups. ${a} ÷ ${b} asks "how many ${b}s fit in ${a}?" — the answer is ${res}. Want it step by step? Say "show your work". 🐒`;
      if (op === '^') return `An exponent is repeated multiplying. ${a}^${b} means ${a} multiplied by itself ${b} times, which comes to ${res}. 🐒`;
    }
    if (/%|\/100/.test(expr)) return `A percent is a piece out of 100. I turned the percent into a fraction over 100, then multiplied — that lands on ${res}. Want the steps? Say "show your work". 🐒`;
    return `I worked it out left to right following order of operations (PEMDAS: parentheses, exponents, then ×/÷, then +/−), which gives ${res}. Want me to show each step? Say "show your work". 🐒`;
  }

  // ── Memory commands (v57) ───────────────────────────────
  // Explicit memory dispatcher. Handles remember/recall/forget. Runs near
  // the top of respond() so it beats the rest of the chain on a clear
  // command. Returns string OR null (null = no command matched).
  function handleMemoryCommand(input, lower) {
    if (typeof Memory === 'undefined') return null;
    const trimmed = input.trim().replace(/[?.!]+$/, '');

    // Forget-everything confirmation flow.
    if (_forgetEverythingPending) {
      _forgetEverythingPending = false;
      if (/^(yes|yep|yeah|sure|confirm|do it|forget everything|yes,? forget everything)\b/i.test(trimmed)) {
        Memory.clear();
        return "Done — fresh slate. I've cleared everything I knew. 🐒";
      }
      return "OK, I won't forget anything. What else?";
    }
    if (/^forget\s+(everything|all|all of it|me|what you know)\b/i.test(trimmed)) {
      _forgetEverythingPending = true;
      const facts = Memory.listFacts().length;
      return `Want me to wipe everything I remember (${facts} fact${facts === 1 ? '' : 's'} you told me, plus all the conversation patterns I've tracked)? Say "yes" to confirm.`;
    }

    // Forget a single fact: "forget about my cat", "forget my cat"
    let m = trimmed.match(/^forget\s+(?:about\s+)?(?:my\s+)?(.+)$/i);
    if (m) {
      const r = Memory.forgetFact(m[1]);
      return r.removed
        ? `Forgotten. I no longer know your ${m[1]}. 🐒`
        : `I didn't have anything stored under "${m[1]}".`;
    }

    // Recall — full list
    if (/^(what\s+do\s+you\s+(?:know|remember)(?:\s+about\s+me)?|tell\s+me\s+what\s+you\s+(?:know|remember)(?:\s+about\s+me)?|list\s+(?:your\s+)?memor(?:y|ies)|show\s+(?:your\s+)?memor(?:y|ies))$/i.test(trimmed)) {
      return Memory.summary();
    }

    // Recall — specific subject
    m = trimmed.match(/^(?:do\s+you\s+(?:remember|know)\s+(?:about\s+)?(?:my\s+)?(.+)|what(?:'s|\s+is)\s+my\s+(.+))$/i);
    if (m) {
      const subj = m[1] || m[2];
      const v = Memory.getFact(subj);
      return v
        ? `Yes — you told me your ${subj} is ${v}. 🐒`
        : `I don't know your ${subj} yet — tell me with "remember that my ${subj} is …" and I'll keep it safe.`;
    }

    // Store — "remember that my X is Y" / "remember my X is Y"
    m = trimmed.match(/^(?:please\s+)?remember\s+(?:that\s+)?my\s+(.+?)\s+(?:is|=)\s+(.+)$/i);
    if (m) {
      const r = Memory.setFact(m[1], m[2]);
      if (r.rejected) return "I don't store things like passwords or addresses — just names, favorites, that kind of thing. 🐒";
      return `Got it — your ${m[1]} is ${m[2]}. I'll remember. 🐒`;
    }

    // Store — "remember that I love/like X" → about_me list
    m = trimmed.match(/^(?:please\s+)?remember\s+(?:that\s+)?i\s+(?:love|like|enjoy|am into|am)\s+(.+)$/i);
    if (m) {
      const existing = Memory.getFact('about_me');
      const next = existing ? existing + ', ' + m[1] : m[1];
      const r = Memory.setFact('about_me', next);
      if (r.rejected) return "Try something specific — like 'remember that I love dragons'!";
      return `Locked in — you ${/^(love|like|enjoy)/i.test(m[0].slice(m[0].indexOf('i ')+2)) ? "like" : "are into"} ${m[1]}. 🐒`;
    }

    // Store — "remember this for later: X" / "make a note that X"
    m = trimmed.match(/^(?:remember\s+this(?:\s+for\s+later)?[:,]?\s*|make\s+a\s+note(?:\s+that)?\s+|don'?t\s+forget(?:\s+that)?\s+)(.+)$/i);
    if (m) {
      const id = 'note_' + Date.now().toString(36).slice(-6);
      const r = Memory.setFact(id, m[1]);
      if (r.rejected) return "I don't store things like passwords or addresses.";
      return `Noted: "${m[1]}". 🐒`;
    }

    return null;
  }

  // ── Drawing handler (v58) ───────────────────────────────
  //
  // Three-turn flow:
  //   turn 1: drawing arrives via Chat.processResponse('__DRAWING__:' + json)
  //           → analysis-to-warm-observation + "what is it?" question
  //   turn 2: user describes ("it's my dog") → noun extracted, reacted to,
  //           offered a story
  //   turn 3: user says yes / tell me a story → fact-woven or mood-toned
  //           micro story spun via the existing Generator

  function _drawingExtractNoun(input) {
    let s = input.trim().replace(/[?.!]+$/, '').toLowerCase();
    // Strip lead-ins (twice — "it's a", "this is a").
    const lead = /^(it'?s|its|that'?s|thats|i drew|i made|this is|here'?s|looks like|a|an|the|my|some|just|kind of)\s+/;
    s = s.replace(lead, '').replace(lead, '');
    // Cut trailing modifier clauses ("…floating in the wind", "…with horns
    // on a stick", "…that flies") so the subject stays a clean noun phrase.
    s = s.split(/\s+(?:floating|flying|sitting|standing|with|that|which|who|on|in|under|over|near|by|made of|holding|wearing|doing|and)\b/)[0];
    // Drop "top/part/picture of (a)" framing → keep the head noun.
    s = s.replace(/^(top|bottom|side|part|picture|drawing|image|photo|sketch)\s+of\s+(?:a|an|the)?\s*/, '');
    // Cap to 4 words.
    s = s.trim().split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
    return s.trim() || input.trim().toLowerCase();
  }

  // Build the warm observation string (no trailing question). Shared by the
  // turn-1 opener and the photo-feature "observe + react" path.
  function _drawingObservation(a) {
    const colors = a.topColors && a.topColors.length
      ? (a.topColors.length === 1
          ? `just ${a.topColors[0]}`
          : `${a.topColors.slice(0, -1).join(', ')} and ${a.topColors.slice(-1)[0]}`)
      : 'a mix of colors';
    const bits = [];
    bits.push(`I see it! Lots of ${colors}`);
    if (a.colorTemp && !a.colorTemp.startsWith('one color')) bits.push(`(${a.colorTemp})`);
    if (a.position && a.position !== 'right in the middle') bits.push(`— ${a.position}`);
    else bits.push(`— sitting nicely in the middle`);
    if (a.symmetryLabel && a.symmetryLabel === 'very symmetric left-to-right') bits.push(', and very symmetric');
    let observation = bits.join(' ') + '.';
    if (a.intensity === 'busy')       observation += ` Lots of detail packed in there.`;
    else if (a.intensity === 'tiny')  observation += ` Just a tiny mark.`;
    else if (a.intensity === 'sparse') observation += ` Light and airy.`;
    if (a.strokeStats && a.strokeStats.strokeCount >= 8) {
      observation += ` You really took your time (${a.strokeStats.strokeCount} strokes).`;
    }
    return observation;
  }

  function _drawingOpener(a) {
    if (a.empty) return "I see the canvas but it looks empty — did you mean to draw more, or was that the whole idea?";
    return _drawingObservation(a) + '\n\nWhat is it? 🐒';
  }

  // Photo feature: user drew AND/OR described in one submit. Observe the
  // drawing (if any) and react to the description in a single reply,
  // collapsing turns 1+2 — Joe shouldn't ask "what is it?" when he was
  // already told.
  function _drawingObserveAndReact(a, noun) {
    const lead = a.empty ? '' : _drawingObservation(a) + '\n\n';
    return lead + _drawingReact(noun, a);
  }

  function _drawingReact(noun, analysis) {
    // Base openers work whether or not there's a visible drawing.
    const base = [
      `${noun}! I love that.`,
      `A ${noun}! Best choice.`,
      `A ${noun}! Nice.`,
      `${noun}! Love it.`
    ];
    // These presume a visible drawing — skip them on the description-only
    // path (photo feature with text but no canvas marks).
    const drawn = [
      `Oh, ${noun} — that fits the colors perfectly.`,
      `${noun}! That's such a good one to draw.`
    ];
    const openers = (analysis && analysis.empty) ? base : base.concat(drawn);
    // Always a clean, unambiguous yes/no offer — never presume a story
    // already exists (that confuses kids).
    const offers = [
      `Want me to make up a tiny story about your ${noun}?`,
      `Should I spin a little story about your ${noun}?`,
      `Want a tiny tale starring your ${noun}? Just say yes! 🐒`
    ];
    return pick(openers) + ' ' + pick(offers);
  }

  function _drawingStoryToneFromMood(mood) {
    return mood || null;  // mood already maps to tone names
  }

  function _isDrawingStoryAccept(lower) {
    // Affirmative, allowing a trailing vocative / politeness word so "yes joe",
    // "yes please", "sure thing buddy", "ok then" all count (v60 — fixes the
    // "Yes Joe" → idk → accidental web-search-for-"yes joe" cascade).
    const AFFIRM = "yes|yeah|yea|yep|yup|sure|ok|okay|kay|k|please|pls|do it|go on|go ahead|sounds good|tell me a story(?: about it)?|story|tell me one|spin one|i guess|why not|let'?s (do it|go|hear it)|absolutely|definitely";
    const TAIL = "(\\s+(joe|monkey joe|please|pls|thing|thanks|thank you|thx|sir|there|buddy|pal|friend|sure|ok|okay|now|then))*[\\s!.?]*$";
    return new RegExp("^(" + AFFIRM + ")" + TAIL, "i").test(lower.trim());
  }

  function _maybeClearDrawingContext() {
    if (_drawingContext && Date.now() - _drawingContext.sentAt > 5 * 60 * 1000) {
      _drawingContext = null;
    }
  }

  // Accumulate generated story/chapter text so the user can later say
  // "put it all together in a file" and get the whole book. (v68)
  function _recordChapter(text) {
    if (_storySession && text) {
      if (!Array.isArray(_storySession.chapters)) _storySession.chapters = [];
      _storySession.chapters.push(text);
    }
  }

  // Build a __SAVESTORY__ envelope from the accumulated chapters, or null if
  // there's nothing to save yet.
  function _assembleBook() {
    if (!_storySession || !Array.isArray(_storySession.chapters) || !_storySession.chapters.length) return null;
    const chapters = _storySession.chapters;
    const subj = (_storySession.subject || '').replace(/^(a|an|the)\s+/i, '').trim();
    const title = subj ? subj.replace(/\b\w/g, c => c.toUpperCase()) : 'My Story';
    let body = `# ${title}\n\n`;
    chapters.forEach((c, i) => { body += `## Chapter ${i + 1}\n\n${c}\n\n`; });
    const name = (subj || 'my-story').toLowerCase().replace(/\s+/g, '-');
    const n = chapters.length;
    return '__SAVESTORY__:' + JSON.stringify({
      ext: 'md', name, content: body,
      intro: `Here's "${title}" — all ${n} chapter${n === 1 ? '' : 's'} in one file! 🐒`
    });
  }
  const saveStoryPatterns = [
    /\bput (it|them|this|the (story|book|chapters?)) (all )?together\b/i,
    /\b(save|compile|export|download)\b.*\b(story|book|it|this|chapters?)\b/i,
    /\bmake (a|the|me a) (file|book|document|pdf)\b.*\b(it|this|story|book)\b/i,
    /\bturn (it|this|the (story|book)) into a (file|book|document|pdf)\b/i,
    /\b(it|this|the (story|book)|all of it|everything)\b.*\b(in|into|as|to)\b.*\bfile\b/i,
    /\bsave (it|this|the (story|book))\b/i,
    /\bthe whole (story|book)\b/i
  ];

  // ── Rule matching (v58 fix) ─────────────────────────────
  // The rules.json `rules` array is matched BEFORE the math/science/
  // knowledge dispatchers, so a bare substring rule like "what" would
  // shadow every "what is X" question ("what is a derivative" →
  // "Yeah! Want me to explain more?"). Ambiguous reaction/interrogative
  // words must therefore essentially BE the whole message; unambiguous
  // stems ("thank", "good morning") keep substring matching.
  const RULE_EXACT_WORDS = new Set([
    'what', 'why', 'really', 'seriously', 'wow', 'cool', 'nice',
    'interesting', 'okay', 'ok', 'lol', 'haha', 'lmao', 'omg', 'no way',
    'sure', 'huh',
    // single-word commands that were substring-matching inside sentences
    // ("you can help by…" → help rule). v59.
    'help', 'food', 'hungry', 'bored', 'draw'
  ]);

  // Stopwords that are never meaningful as a knowledge keyword. The scorer
  // skips these so a junk keyword (e.g. the Euler-constant fact tagged "like")
  // can't exact-match a common word in casual chat and dump the fact. (v60)
  const KW_STOPWORDS = new Set([
    'a','an','the','it','its','is','are','am','do','does','did','you','your','yours',
    'i','me','my','mine','we','us','our','he','she','him','her','his','they','them','their',
    'like','really','very','so','too','and','or','but','of','to','in','on','at','for','with',
    'as','be','this','that','what','who','how','why','when','where','which','can','will',
    'would','should','could','not','no','yes','ok','okay','just','also','then','than',
    'was','were','has','have','had','get','got','one','some','any','all','more','most',
    'such','only','into','out','up','down','by','from','about','good','bad','nice','cool',
    'love','hate','want','need','make','made','thing','things','stuff','great','best'
  ]);

  function ruleMatches(ruleIf, lower) {
    const r = ruleIf.toLowerCase();
    // Any very short trigger (≤3 chars: "gm","gn","cya","bye","ok"...) must be
    // the WHOLE message — otherwise it substring-matches inside common words
    // (gm→magma/pigment/segment, gn→sign/design) and hijacks them. (v64)
    if (RULE_EXACT_WORDS.has(r) || r.length <= 3) {
      // Strip punctuation + a trailing vocative; require the remainder to
      // equal the trigger. "what?" matches; "what is a derivative" doesn't.
      const stripped = lower
        .replace(/[^a-z\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\s+(joe|monkey joe|there|buddy|pal|man|bro|dude)$/, '')
        .trim();
      return stripped === r;
    }
    return lower.includes(r);
  }

  function respond(input, history = []) {
    // Tick flavoring counters once per respond() call.
    _recentFlavorAge++;
    _storyHookAge++;
    _lastMathAge++;
    _maybeClearDrawingContext();

    // ── Drawing envelope (turn 1) ───────────────────────
    if (input && input.startsWith('__DRAWING__:')) {
      let analysis = { empty: true };
      try { analysis = JSON.parse(input.slice('__DRAWING__:'.length)); } catch (_) {}
      // Photo feature can bundle a description in the envelope — when present,
      // observe + react + offer a story in one shot (skip "what is it?").
      if (analysis.describedAs) {
        const noun = _drawingExtractNoun(String(analysis.describedAs));
        _drawingContext = {
          sentAt: Date.now(),
          analysis,
          awaitingDescription: false,
          describedAs: noun,
          awaitingStoryDecision: true
        };
        return _drawingObserveAndReact(analysis, noun);
      }
      _drawingContext = {
        sentAt: Date.now(),
        analysis,
        awaitingDescription: !analysis.empty,
        describedAs: null
      };
      return _drawingOpener(analysis);
    }

    // ── Drawing turn 2 (user describes) ────────────────
    if (_drawingContext && _drawingContext.awaitingDescription && !input.startsWith('__')) {
      const lower2 = input.toLowerCase().trim();
      // Release ONLY on a pure shrug (the whole message). A hedge with a real
      // description after it ("I don't know, something with a big belly") must
      // NOT release — strip the hedge and keep the description (v59 fix).
      if (/^(i\s+don'?t\s+know|idk|dunno|not\s+sure|no\s+idea|nothing|nothin'?|just\s+(a\s+)?doodl\w*|just\s+scribbl\w*)[\s.!?]*$/i.test(lower2)) {
        _drawingContext = null;
        return "All good — sometimes drawing is just drawing. 🐒";
      }
      let described = input;
      const hedge = input.match(/^\s*(?:i\s+don'?t\s+know|idk|dunno|not\s+sure|hmm+|maybe|i\s+think(?:\s+it'?s)?|probably|it\s+might\s+be)\b[,:\s-]*(.+)$/i);
      if (hedge && hedge[1] && hedge[1].trim()) described = hedge[1];
      const noun = _drawingExtractNoun(described);
      _drawingContext.describedAs = noun;
      _drawingContext.awaitingDescription = false;
      _drawingContext.awaitingStoryDecision = true;
      return _drawingReact(noun, _drawingContext.analysis);
    }

    // ── Drawing turn 3 (story decision) ────────────────
    // Joe just offered a yes/no story. Handle decline, confusion, and
    // accept — never let a non-yes fall through to the generic chain
    // (that's the bug where "What story?" hit the greedy `what` rule).
    if (_drawingContext && _drawingContext.awaitingStoryDecision) {
      const lower3 = input.toLowerCase().trim();
      const subj = _drawingContext.describedAs;
      // Decline → step back but stay recoverable ("actually yes" within the
      // 5-min window still works — don't nuke the subject). v59 fix.
      if (/^(no|nope|nah|no thanks?|not now|maybe later|not really)\b/i.test(lower3)) {
        _drawingContext.awaitingStoryDecision = false;
        _drawingContext.declined = true;
        return "No worries! 🐒 Say 'yes' anytime if you change your mind.";
      }
      // Confusion about the offer → clarify, stay open to a yes.
      if (/\b(what|which|huh|mean)\b/i.test(lower3) || /^\s*\?+\s*$/.test(input)) {
        return `A little made-up story starring your ${subj}! Want one? Just say "yes". 🐒`;
      }
      // Accept (or any clear affirmative) → spin the story.
      if (_isDrawingStoryAccept(lower3) && typeof Generator !== 'undefined') {
        const tone = _drawingStoryToneFromMood(_drawingContext.analysis.mood);
        const r = Generator.generateStory({ subject: subj, mode: 'micro', tone });
        // Graduate into a story session so "another" continues the subject.
        _storySession = {
          tone: r.tone || tone, subject: subj,
          character: r.character, place: r.place,
          chapter: 1, chapterMode: false, mode: 'micro'
        };
        _drawingContext = null;
        return r.text;
      }
      // Anything else (a new topic, an off-hand remark) → release the
      // drawing context and let the normal dispatch chain handle it.
      _drawingContext = null;
    }

    // Re-accept after a decline — "actually yes" / "wait, yes" within the
    // window still spins the story (v59 fix for the dead-end decline).
    if (_drawingContext && _drawingContext.declined && typeof Generator !== 'undefined'
        && /^(actually\s+)?(yes|yeah|sure|ok|okay|go on|do it|fine|wait,?\s*yes|on second thought.*yes|i changed my mind)\b/i.test(input.toLowerCase().trim())) {
      const subj = _drawingContext.describedAs;
      const tone = _drawingStoryToneFromMood(_drawingContext.analysis.mood);
      const r = Generator.generateStory({ subject: subj, mode: 'micro', tone });
      _storySession = {
        tone: r.tone || tone, subject: subj,
        character: r.character, place: r.place,
        chapter: 1, chapterMode: false, mode: 'micro'
      };
      _drawingContext = null;
      return r.text;
    }

    // Memory commands win early — pure command surface, no chance of
    // misrouting to other dispatchers.
    if (typeof Memory !== 'undefined') {
      const memOut = handleMemoryCommand(input, input.toLowerCase().trim());
      if (memOut !== null) return memOut;
    }
    let lower = input.toLowerCase().trim();

    // Get user account name for personalization
    const account = JSON.parse(localStorage.getItem('mj_account') || 'null');
    const userName = account ? account.name : null;

    // Identity check — personalize before other logic
    if (/who am i|what is my name|do you know me/i.test(lower)) {
      if (userName) return `You're ${userName}! 👋`;
      return "I don't know your name yet — you might not be logged in with an account.";
    }

    // ── Story reset / continuation / chapter (Phase 4) ─────────────
    // Runs near the top so short follow-ups like "continue" or
    // "what happens next" aren't intercepted by the generic rules check.

    const NO_STORY_MSG = "I don't have a story going yet — try 'tell me a story about a fox' to get one started! 🐒";

    if (detectStoryReset(lower)) {
      if (_storySession) {
        _storySession = null;
        return "OK, ending that story. Tell me when you want a new one! 🐒";
      }
      return NO_STORY_MSG;
    }

    const standaloneChapter = lower.match(/^chapter\s+(\d+)[\s!.?]*$/);
    if (standaloneChapter) {
      if (_storySession && typeof Generator !== 'undefined') {
        const num = parseInt(standaloneChapter[1], 10);
        const r = Generator.generateStory({
          continuation: true,
          tone:      _storySession.tone,
          character: _storySession.character,
          place:     _storySession.place
        });
        _storySession.character  = r.character || _storySession.character;
        _storySession.place      = r.place     || _storySession.place;
        _storySession.chapter    = num;
        _storySession.chapterMode = true;
        _recordChapter(r.text);
        return `Chapter ${num}\n\n${r.text}`;
      }
      return NO_STORY_MSG;
    }

    if (detectStoryContinuation(lower)) {
      if (_storySession && typeof Generator !== 'undefined') {
        const r = Generator.generateStory({
          continuation: true,
          tone:      _storySession.tone,
          character: _storySession.character,
          place:     _storySession.place
        });
        _storySession.character = r.character || _storySession.character;
        _storySession.place     = r.place     || _storySession.place;
        let prefix = '';
        if (_storySession.chapterMode) {
          _storySession.chapter = (_storySession.chapter ?? 1) + 1;
          prefix = `Chapter ${_storySession.chapter}\n\n`;
        }
        _recordChapter(r.text);
        return prefix + r.text;
      }
      return NO_STORY_MSG;
    }

    // "Put it all together in a file" — compile the book the user wrote across
    // chapters into a single downloadable file. (v68)
    if (_storySession && saveStoryPatterns.some(re => re.test(lower))) {
      const env = _assembleBook();
      if (env) return env;
      // session but no captured chapters yet
      return "I haven't written any chapters yet — say 'make a story about a fox', then 'next chapter' a few times, then ask me to put it in a file! 🐒";
    }

    // "Make it longer" / "bigger" — upgrade the CURRENT story instead of
    // reading it as frustration (v60 — fixes the drawing-payoff dead end where
    // "that's not big enough, make it longer" hit the emotion detector). Only
    // fires when a session is live, so it can be liberal: a micro story grows
    // to a regular one, a regular one grows to a beat-chain. Must sit ABOVE the
    // emotion detector and the edit-intent block.
    if (_storySession && typeof Generator !== 'undefined'
        && /\b(longer|bigger|not (big|long) enough|make it (longer|big|bigger)|too short|expand it|more detail)\b/i.test(lower)
        && !/\bstory about\b|\btell me a story\b/i.test(lower)) {
      const nextMode = _storySession.mode === 'micro' ? 'regular' : 'beats';
      const r = Generator.generateStory({
        tone:      _storySession.tone,
        subject:   _storySession.subject,
        character: _storySession.character,
        place:     _storySession.place,
        mode:      nextMode
      });
      _storySession.character = r.character || _storySession.character;
      _storySession.place     = r.place     || _storySession.place;
      _storySession.mode      = r.mode || nextMode;
      // "make that longer" expands the most recent chapter — replace it in the
      // book so the saved file has the longer version, not both. (v69)
      if (Array.isArray(_storySession.chapters) && _storySession.chapters.length) {
        _storySession.chapters[_storySession.chapters.length - 1] = r.text;
      } else {
        _recordChapter(r.text);
      }
      return r.text;
    }

    // Story-hook reply — if Joe recently offered a story-about-X, treat
    // a short "yes"/"tell me a story about it" as that confirmation.
    if (isStoryHookYes(lower) && typeof Generator !== 'undefined') {
      const subj = _storyHookSubject;
      const kws  = _storyHookKeywords || [];
      _storyHookSubject = null;
      _storyHookAge = 99;
      let fact = null;
      const allFacts = ((knowledge && knowledge.facts) || []).concat((coding && coding.facts) || []);
      for (const f of allFacts) {
        if (f.keywords && kws.some(k => f.keywords.includes(k))) { fact = f; break; }
      }
      const r = Generator.generateStory({
        subject: subj,
        fact:    fact ? fact.answer : null,
        tone:    null,
        mode:    'regular'
      });
      _storySession = { tone: r.tone || null, subject: subj,
                        character: r.character, place: r.place,
                        chapter: 1, chapterMode: false, mode: 'regular' };
      return r.text;
    }

    // ── Follow-up context injection ──────────────────────────
    if (_lastTopicLabel && detectFollowUp(lower)) {
      // inject last topic so "what do they eat?" becomes "what do they eat elephant"
      lower = lower + ' ' + _lastTopicLabel;
    }

    // "Yes" context — if Joe just offered to search, treat as search confirmation
    if (/^(yes|yeah|sure|ok|okay|yep|yup|do it|go ahead)[\s!.]*$/.test(lower)) {
      const lastJoe = [...history].reverse().find(m => m.role === 'joe');
      if (lastJoe && lastJoe.content && lastJoe.content.includes('search the web for it')) {
        // Find the topic from earlier in conversation
        const userMsgs = history.filter(m => m.role === 'user');
        const lastUser = userMsgs[userMsgs.length - 2];
        if (lastUser) return '__SEARCH__:' + lastUser.content;
      }
    }

    // Find last file in history (used for edit intent)
    const lastFileMsg = [...history].reverse().find(m => m.role === 'joe' && m.isHTML && m.content && m.content.includes('Files.view'));
    const hasRecentFile = !!lastFileMsg;

    const explicitEditTriggers = ['edit it','edit that','edit the file','change it','update it','update the file','modify it','modify the file','add to it','add to the file','rename it','rename the file','fix it','fix the file'];
    const contextEditTriggers = ['change the','add the','add a','remove the','rename to','make it','make the','set the','update the','delete the','delete all','remove all','clear the','strip the','get rid of','hide the'];
    const isEditIntent = explicitEditTriggers.some(t => lower.includes(t)) ||
      (hasRecentFile && contextEditTriggers.some(t => lower.startsWith(t)));
    if (isEditIntent) {
      if (lastFileMsg) {
        const match = lastFileMsg.content.match(/Files\.view\('([^']+)'\)/);
        if (match) return '__EDIT__:' + match[1] + ':' + input;
      }
      return "I don't see a file to edit yet — make one first and then tell me what to change!";
    }

    // File creation
    const fileTypes = ['html','css','js','javascript','ts','typescript','md','markdown','txt','text','json','py','python','sh','bash','shell','svg','csv'];
    const fileTypeRe = new RegExp('\\b(?:' + fileTypes.join('|') + ')\\b');
    const isFileReq = /^(make|create|write|generate|build)\s/.test(lower) && fileTypeRe.test(lower);
    if (isFileReq) return '__FILE__:' + input;

    // GitHub push
    const isPushReq = /^(push|deploy|publish|send to github|push to github|update github|commit)/.test(lower);
    if (isPushReq) return '__PUSH__:' + input;

        // Just "search the web" with no query
    if (/^s[ea]rch(\s+the\s+web)?!?$/.test(lower)) {
      return "Sure! What do you want me to search for?";
    }

    // Greeting check — only when the WHOLE message is just a greeting
    // (optionally followed by Joe's name / "there" / punctuation). Skip
    // when a real request follows the greeting, e.g. "Hi, I want to
    // make a book" — that should route to the story handler.
    if (rules && rules.greetings && lower.length < 40) {
      for (const g of rules.greetings) {
        const matched = g.if.some(w => {
          const escW = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Allow an optional comma before a vocative ("hi, friend") and a
          // leading comma/space generally (v59 fix).
          const re = new RegExp(
            '^' + escW + "(\\s*,?\\s+(joe|monkey joe|there|friend|buddy|pal))?[\\s,!.?]*$",
            'i'
          );
          return re.test(lower);
        });
        if (matched) {
          let greeting;
          // Welcome-back wins when we have memory of prior sessions.
          if (typeof Memory !== 'undefined' && Memory.shouldWelcomeBack()) {
            greeting = Memory.formatWelcomeBack(userName);
          } else {
            greeting = pick(g.responses);
            if (userName && greeting.includes('Hi') && !greeting.includes(userName)) {
              greeting = greeting.replace(/^Hi/, `Hi ${userName},`);
            }
          }
          return withProcedural(greeting);
        }
      }
    }

    // ── Relational + compound-question handling (v60) ───────────
    // Two linked bugs this fixes:
    //  • "do you love me" / "are you my friend" used to fall through every
    //    dispatcher into the knowledge scorer and dump a random wordy fact
    //    (ACT therapy, Docker volumes…). Now answered warmly, here, before
    //    emotion + knowledge.
    //  • "I love you, what's your name?" used to hit the `i love you` reaction
    //    rule, which swallowed the question. Now the affection is acknowledged
    //    AND the question gets answered.
    {
      const askName = /\b(what'?s|what is|whats)\s+your\s+name\b|\bwho\s+(are|r)\s+(you|u)\b|\bwhat\s+are\s+you(\s+called)?\b/.test(lower);
      const affLead = /\bi\s+(love|like)\s+(you|u|ya)\b/.test(lower);
      const lovesMe = /\bdo\s+you\s+(really\s+|even\s+|still\s+)?love\s+me\b/.test(lower)
                   || /\byou\s+(don'?t|do\s+not|dont)\s+love\s+me\b/.test(lower)
                   || /\bdo\s+you\s+(really\s+|even\s+)?like\s+me\b/.test(lower);
      const friendMe = /\b(are|will|would)\s+you\s+(be\s+|become\s+)?my\s+friend\b/.test(lower)
                    || /\bare\s+we\s+(friends|buddies|pals)\b/.test(lower)
                    || /\bdo\s+you\s+care\s+(about\s+)?me\b/.test(lower);
      if (lovesMe || friendMe) {
        return pick([
          "Of course I do! 🐒❤️ You're my favorite human to chat with.",
          "You bet I do! 🐒 I'm always happy when you show up.",
          "Always! 🐒❤️ You and me — best buddies.",
          "100%! 🐒 I light right up every time you say hi."
        ]);
      }
      // Compound: affection AND a name/who question → acknowledge + answer.
      if (affLead && askName) {
        return "Aw 🐒❤️ I love chatting with you too! And I'm Monkey Joe — a rules-based assistant built by Akiva with Claude's help. 🐒";
      }
    }

    // Positive feedback ("I like it", "that was great", "love it", "cool
    // story") — respond warmly instead of falling into the knowledge scorer
    // (the "i like it" → Euler's-number bug). If a story is live, offer more.
    if (/^((i\s+)?(really\s+)?(like|love|loved|liked|loving|enjoy|enjoyed)\s+(it|that|this(\s+one|\s+story)?)|that('?s|\s+was)(\s+so|\s+really)?\s+(great|good|cool|awesome|nice|fun|lovely|sweet|amazing|perfect)|(so\s+|really\s+)?(good|great|cool|awesome|nice|lovely|fun)\s+(story|one|job|tale)|nice\s+one|well\s+done|good\s+job)[\s!.?]*$/i.test(lower)) {
      if (_storySession) {
        return pick([
          "Yay, so glad you liked it! 🐒 Want another? Just say 'another'.",
          "Aw, thank you! 🐒 I can spin another or make it longer — your call.",
          "🐒💛 Happy you enjoyed it! Say 'another' for one more."
        ]);
      }
      return pick([
        "Aw, thank you! 🐒 What should we do next?",
        "🐒💛 You're the best. What's next?",
        "Glad you think so! 🐒 Ask me anything."
      ]);
    }

    // Meta / feedback ABOUT Joe ("you didn't answer", "that's wrong", "I'll
    // tell Claude to fix you") — respond humbly instead of dumping a fact that
    // merely shares a keyword like "Claude" or "Anthropic". (v61)
    if (/\b(you('?re| are)?\s+wrong|wrong\s+(answer|response)|that('?s| was)?\s*(not\s+(right|it|what\s+i)|wrong)|did(n'?t| not)\s+(answer|help|work|understand)|not\s+the\s+right\s+(answer|response|thing)|does(n'?t| not)\s+make\s+sense|made\s+no\s+sense|you('?re| are)?\s+(broken|useless|dumb|stupid|not\s+working)|fix\s+you|tell\s+(claude|akiva)|report\s+you|bad\s+(bot|monkey|answer|response)|you\s+(suck|messed\s+up|don'?t\s+work)|wrong\s+again)\b/i.test(lower)) {
      return pick([
        "Oof, sorry — I'm just a rules-based monkey, so I flub things sometimes. 🐒 What were you hoping I'd say?",
        "You're right, that one missed. 🙈 Akiva and Claude keep teaching me — what did you actually want?",
        "My bad! 🐒 Tell me what you meant and I'll have another go.",
        "Yeah, that wasn't my best. 🐒 Want to ask me again a different way?"
      ]);
    }

    // Emoji-only or emoji-heavy check
    if (rules && rules.emojis) {
      for (const [emoji, responses] of Object.entries(rules.emojis)) {
        if (input.includes(emoji) && lower.replace(/\s/g,'').length < 20) {
          return pick(responses);
        }
      }
    }

    // Emotion detection
    if (rules && rules.emotions) {
      const detected = detectEmotion(lower, input);
      if (detected) return pick(rules.emotions[detected].responses);
    }

    // Rules check (before terminal so "what are cats" doesn't hit `cat` command).
    // ruleMatches() keeps ambiguous reaction words (what/why/cool/...) from
    // shadowing real questions handled by later dispatchers.
    if (rules && rules.rules) {
      for (const rule of rules.rules) {
        if (rule.if && ruleMatches(rule.if, lower)) {
          return rule.procedural ? withProcedural(rule.then) : rule.then;
        }
      }
    }

    // Identity shortcut — catch before search triggers
    if (lower.includes('who are you') || lower.includes('what are you') || lower === 'who r u' || lower.includes('your name') || lower === 'what are you called') {
      return "I'm Monkey Joe 🐒 — a rules-based assistant built by Akiva with Claude's help. My brain lives in a GitHub repo and grows over time!";
    }

    // Name recognition — user addresses or asks about Joe by name
    if (lower.includes('monkey joe')) {
      if (rules && rules.greetings && /^(hi|hey|hello|howdy|hiya|yo|sup)/.test(lower)) {
        return pick(rules.greetings[0].responses);
      }
      return "That's me! 🐒 I'm Monkey Joe — a rules-based AI assistant made by Akiva. Ask me anything!";
    }

    // "Another" / "one more" — generate a new story in the same tone if a
    // session exists. Skipped if there's no prior session.
    if (detectAnother(input) && _storySession && typeof Generator !== 'undefined') {
      const r = Generator.generateStory({
        tone:    _storySession.tone,
        subject: _storySession.subject,
        mode:    _storySession.mode === 'beats' ? 'beats' : 'regular'
      });
      _storySession.character = r.character || _storySession.character;
      _storySession.place     = r.place     || _storySession.place;
      _recordChapter(r.text);
      return r.text;
    }

    // "tell me about a brave fox" — micro story featuring that ADJ + NOUN.
    const aboutMicro = detectAboutMicroStory(lower);
    if (aboutMicro && typeof Generator !== 'undefined') {
      const r = Generator.generateStory({
        mode:    'micro',
        subject: aboutMicro.noun,
        tone:    detectStoryTone(lower)
      });
      if (r.text && r.text.trim()) {
        _storySession = {
          tone:        r.tone || null,
          subject:     aboutMicro.noun,
          character:   r.character,
          place:       r.place,
          chapter:     1,
          chapterMode: false,
          mode:        'micro'
        };
        return r.text;
      }
    }

    // Story-generation intent — make up new text instead of looking up a fact.
    // "book" is a synonym for story (matches the original v42 use case: user
    // wanted to write a book with Joe). "fable", "legend", "yarn",
    // "bedtime story" all route here too.
    const storyTriggers = [
      /\b(tell|read|make|give|write|share)\s+(me\s+)?(a|an|another|me\s+a|me\s+an)\s+(\w+\s+)?(story|tale|adventure|book|fable|legend|yarn)\b/i,
      /\b(can|could|will|would)\s+you\s+(tell|read|make|give|write|share)\s+(me\s+)?(a|an)\s+(\w+\s+)?(story|tale|adventure|book|fable|legend|yarn)\b/i,
      /^(a\s+)?(\w+\s+)?(story|tale|book|fable|legend|yarn)\s+please/i,
      /\bmake\s+(up|me)\s+(a|an)\s+(\w+\s+)?(story|tale|adventure|book|fable|legend|yarn)/i,
      /^chapter\s+\d+\s+of\s+(?:a|an|the)\s+\w*\s*(?:story|tale|adventure|book)\b/i,
      /\b(let'?s|let us|we'?ll|i want to|i'?d like to|i wanna|wanna|want to|can we|shall we)\s+(make|write|create|tell|share|do|start)\s+(up\s+)?(a|an)\s+(\w+\s+)?(story|tale|adventure|book|fable|legend|yarn)\b/i,
      /^(make|write|create|tell|start)\s+(a|an)\s+(\w+\s+)?(story|tale|adventure|book|fable|legend|yarn)\b/i,
      /\bbedtime\s+story\b/i,
      /\b(weave|spin)\s+(me\s+)?a\s+(story|tale|yarn|legend)\b/i,
      // Mode-prefixed forms ("one line story please", "longer adventure", "micro story")
      /\b(one[-\s](line|sentence)|micro|tiny|short(er)?|quick|long(er)?|epic|grand|sprawling)\s+(story|tale|adventure|book|fable|legend|yarn)\b/i
    ];
    if (storyTriggers.some(re => re.test(input))) {
      if (typeof Generator !== 'undefined' && Generator.generateStory) {
        const tone    = detectStoryTone(lower);
        const mode    = detectStoryMode(lower);
        const subject = extractStorySubject(lower);
        let   fact    = findFactForSubject(subject, knowledge, coding);
        // If the user wanted a toned story but didn't name a subject, pick
        // a tone-appropriate fact so a "spooky factStory" weaves a wolf-fact,
        // not a capital-city fact.
        if (!fact && tone && knowledge && knowledge.facts) {
          const all = (knowledge.facts || []).concat((coding && coding.facts) || []);
          // Only ~30% of the time so most no-subject stories don't lock into factStories.
          if (Math.random() < 0.3) fact = pickToneAwareFact(all, tone);
        }
        // Prefer the last-word singular for character binding so a request
        // like "story about a brave fox" treats "fox" as the protagonist.
        const bindSubject = subject.lastSingular || subject.lastWord || subject.singular || subject.raw || null;
        const r = Generator.generateStory({
          tone,
          mode:    mode || 'regular',
          subject: bindSubject,
          fact:    fact ? fact.answer : null
        });
        // Save session so "continue" / "chapter N" / "another" follow-ups work
        const chMatch = input.match(/\bchapter\s+(\d+)\b/i);
        _storySession = {
          tone,
          subject:     bindSubject,
          character:   r.character,
          place:       r.place,
          chapter:     chMatch ? parseInt(chMatch[1], 10) : 1,
          chapterMode: !!chMatch,
          mode:        r.mode || mode || 'regular'
        };
        _recordChapter(r.text);
        const prefix = _storySession.chapterMode ? `Chapter ${_storySession.chapter}\n\n` : '';
        return prefix + r.text;
      }
    }

    // ── Coding dispatchers (v51) ──────────────────────────
    // Order: error-paste > code-paste > debugging walkthrough > recipe.
    // Each runs before the generic knowledge lookup so coding intents
    // don't get hijacked by stray keyword matches.

    // 1. Error message paste — detect by regex match against errors.json.
    //    Skip when the input is short and casual (low confidence).
    if (errors && errors.patterns && input.length > 8) {
      const errHit = detectErrorPattern(input);
      if (errHit) return formatErrorResponse(errHit);
    }

    // 2. Code paste — multi-line, code-like tokens. Critique using patterns.
    if (looksLikeCode(input)) {
      const lang   = detectLanguage(input);
      const issues = critiqueCode(input, lang);
      return formatCodeCritique(lang, issues);
    }

    // 3. Debugging walkthrough — "merge conflict", "git is broken", etc.
    //    minScore 2 here: walkthroughs are bigger replies, want a stronger
    //    signal (substring-match, not just word-set overlap).
    if (debugging && debugging.guides) {
      const guide = findByTriggers(debugging.guides, lower, 2);
      if (guide) return formatDebuggingResponse(guide);
    }

    // 4. Recipe — "how do I X in Y" / "python read csv".
    //    minScore 1 here: snippet recipes are small enough that a 2+-word
    //    word-set match is enough to fire.
    if (recipes && recipes.recipes) {
      const recipe = findByTriggers(recipes.recipes, lower, 1);
      if (recipe) return formatRecipeResponse(recipe);
    }

    // ── Math dispatcher (v55) ─────────────────────────────
    // Slot: after coding (so pasted tracebacks containing `1/0` still
    // route to the error matcher) and before terminal + knowledge (so
    // `is 91 prime` doesn't get hijacked by a wikipedia-style fact).
    // Follow-up to a fresh calculation: "how does this work?" / "explain that".
    // Must run before the science dispatcher, or "how does this work?" gets
    // hijacked by the physics 'work' tutorial. Only fires when the input is a
    // bare follow-up (no math of its own) and a recent answer is on record.
    if (_lastMathContext && _lastMathAge <= 2 && _isMathFollowUp(lower)
        && !classifyMathIntent(input, lower)) {
      const exp = _explainLastMath(_lastMathContext);
      if (exp) { _lastMathAge = 99; return exp; }
    }

    const mathIntent = classifyMathIntent(input, lower);
    if (mathIntent) {
      const mathOut = handleMathIntent(mathIntent, input, lower);
      if (mathOut) {
        // COMPUTE/WORKED answers may get a one-line voice garnish.
        // TEACH/DEFINE already end on a tryIt prompt — don't double up.
        return (mathIntent === 'COMPUTE' || mathIntent === 'WORKED')
          ? maybeGarnishMath(mathOut, input, lower)
          : mathOut;
      }
    }

    // ── Science dispatcher (v55) ──────────────────────────
    // After math, before terminal + knowledge. Routes TEACH/DEFINE/
    // FORMULA intents to scienceTutorials.json. The formula path
    // plugs user-supplied numbers into the tutorial's compute string.
    const sciIntent = classifyScienceIntent(input, lower);
    if (sciIntent) {
      const sciOut = handleScienceIntent(sciIntent, input, lower);
      if (sciOut) {
        return (sciIntent === 'SCIENCE_FORMULA')
          ? maybeGarnishScience(sciOut, input, lower)
          : sciOut;
      }
    }

    // Terminal/command check — fires when the input looks like a command OR
    // is a question ABOUT a command. The "about a command" path is gated on an
    // explicit command-context word (command/terminal/shell/cli/bash) so that
    // "what is a cat" stays the animal, not the `cat` command. (v70)
    if (terminal && terminal.commands) {
      const aboutCommand = /\b(command|terminal|cli|command line|shell|bash)\b/.test(lower);
      for (const entry of terminal.commands) {
        if (!entry.triggers) continue;
        const direct = entry.triggers.some(t =>
          lower === t || lower.startsWith(t + ' ') || lower.startsWith(t + ':') ||
          (/^(run|execute|use|type)\s/.test(lower) && lower.includes(t)));
        const asked = aboutCommand && entry.triggers.some(t => _wordContains(lower, t));
        if (direct || asked) return entry.response;
      }
    }

    // ── Smart question understanding ──────────────────────────

    // 1. QUESTION STRIPPING — remove filler to expose the real topic
    function stripQuestion(q) {
      return q
        .replace(/^(please |can you |could you |can you tell me|could you tell me|do you know |do you happen to know|do you know anything about|tell me |i want to know |i was wondering |i wonder |i was just wondering|i'm curious about|help me understand |explain to me |)/i, '')
        .replace(/^(what is|what are|what was|what were|what's|whats|what does|what do|what did|what can|what makes|what causes|what happens|what kind of|what type of|what sort of|what's the deal with|what's up with)/i, '')
        .replace(/^(who is|who are|who was|who were|who's|whos|who invented|who created|who discovered|who made|who built|who founded)/i, '')
        .replace(/^(how does|how do|how did|how is|how are|how was|how were|how to|how many|how much|how long|how big|how large|how small|how fast|how old|how far)/i, '')
        .replace(/^(why does|why do|why did|why is|why are|why was|why were|why can't|why cant|why would)/i, '')
        .replace(/^(where is|where are|where was|where were|where do|where does|where did|where can)/i, '')
        .replace(/^(when is|when was|when were|when did|when does|when do)/i, '')
        .replace(/^(is it|is there|is a|is an|are there|are they|does it|do they|did it|can it|can they|will it|is it true that|is it true|have you heard of|do you know what)/i, '')
        .replace(/^(tell me about|talk to me about|give me info on|give me information about|info on|information on|information about|facts about|fact about|about|give me some info on|give me facts about)/i, '')
        .replace(/^(i want to learn about|explain|describe|define|what does.*mean)/i, '')
        .replace(/\?+$/, '')
        .replace(/^(the |a |an )/, '')
        .trim();
    }

    // 2. SYNONYM EXPANSION — map common synonyms to canonical forms
    const synonymMap = {
      'feline': 'cat', 'kitty': 'cat', 'kitten': 'cat',
      'canine': 'dog', 'puppy': 'dog', 'pup': 'dog',
      'equine': 'horse', 'pony': 'horse', 'foal': 'horse',
      'pachyderm': 'elephant',
      'primate': 'chimpanzee', 'chimp': 'chimpanzee',
      'cetacean': 'whale',
      'avian': 'bird',
      'arachnid': 'spider',
      'bovine': 'cow',
      'velocity': 'speed', 'mph': 'speed', 'km/h': 'speed',
      'hue': 'color', 'colour': 'color',
      'huge': 'large', 'enormous': 'large', 'giant': 'large', 'massive': 'large', 'tiny': 'small', 'minuscule': 'small',
      'dangerous': 'venom', 'deadly': 'venom', 'venomous': 'venom',
      'nutrition': 'diet', 'consume': 'eat', 'feeds on': 'eat', 'graze': 'eat',
      'offspring': 'baby', 'young': 'baby', 'juvenile': 'baby',
      'habitat': 'live', 'reside': 'live', 'dwell': 'live', 'found in': 'live',
      'nocturnal': 'sleep', 'hibernate': 'sleep',
      'vocalize': 'sound', 'roar': 'sound', 'bark': 'sound', 'call': 'sound',
      'cryptocurrency': 'bitcoin', 'crypto': 'bitcoin',
      'artificial intelligence': 'ai', 'machine intelligence': 'ai',
      'large language model': 'llm', 'language model': 'llm',
      'photovoltaic': 'solar', 'pv panel': 'solar',
      'deoxyribonucleic acid': 'dna',
      'ribonucleic acid': 'rna',
      'cardiovascular': 'heart',
      'pulmonary': 'lungs',
      'cerebral': 'brain', 'neural': 'brain', 'neurological': 'brain',
      'gastrointestinal': 'digestion', 'gut': 'digestion',
      'renal': 'kidney',
      'dermal': 'skin',
      'skeletal': 'skeleton',
      'muscular': 'muscle',
      'ocular': 'eye',
      'auditory': 'ear',
      'thyroid': 'hormones', 'insulin': 'hormones', 'cortisol': 'hormones',
      'programming language': 'coding', 'coding language': 'coding',
      'web development': 'javascript',
      'server side': 'nodejs', 'server-side': 'nodejs',
      'version control': 'git',
      'source control': 'git',
      'container': 'docker',
      'containerization': 'docker',
      'orchestration': 'kubernetes',
      'relational database': 'sql',
      'object oriented': 'oop',
      'object-oriented': 'oop',
      'functional': 'functional programming',
      'algebra': 'linear algebra',
      'calculus': 'calculus',
      'statistics': 'statistics',
      'probability': 'statistics',
      'greenhouse effect': 'climate change', 'global warming': 'climate change',
      'greenhouse gases': 'climate change',
      'co2': 'climate change', 'carbon dioxide': 'climate change',
      'fission': 'nuclear', 'fusion': 'nuclear',
      'radioactive': 'nuclear',
      'supermassive black hole': 'black hole',
      'milky way': 'galaxy',
      'andromeda': 'galaxy',
      'photosynthesizing': 'photosynthesis',
      'photosynthesise': 'photosynthesis',
      'evolve': 'evolution', 'evolved': 'evolution', 'evolving': 'evolution',
      'natural selection': 'evolution',
      'survival of the fittest': 'evolution',
      'heredity': 'genetics', 'hereditary': 'genetics', 'inherited': 'genetics',
      'genome': 'dna', 'chromosomes': 'dna', 'genes': 'dna',
      'antibiotic resistance': 'antibiotic',
      'pathogen': 'virus', 'germ': 'virus',
      'flu': 'virus', 'influenza': 'virus',
      'pandemic': 'virus',
      'gut bacteria': 'digestion',
      'microbiome': 'digestion',
      'tectonic': 'volcano',
      'tectonic plates': 'volcano',
      'earthquake': 'volcano',
      'seismic': 'volcano',
      'seismograph': 'earthquake',
      'tsunami': 'ocean',
      'aurora': 'space weather',
      'northern lights': 'space weather',
      'southern lights': 'space weather',
      'fawn': 'deer', 'colt': 'horse', 'piglet': 'pig', 'lamb': 'sheep', 'cub': 'bear', 'joey': 'kangaroo', 'hatchling': 'bird',
      'h2o': 'water', 'nacl': 'salt', 'periodic table': 'elements',
      'artificial neural network': 'neural network', 'deep learning': 'machine learning', 'chatbot': 'ai', 'self driving': 'autonomous vehicles', 'self-driving': 'autonomous vehicles',
      'ev': 'electric vehicles', 'cryptocurrency exchange': 'bitcoin', 'nft': 'web3', 'ar': 'augmented reality', 'vr': 'virtual reality',
      'ww2': 'world war 2', 'ww1': 'world war 1', 'the great war': 'world war 1', 'the holocaust': 'holocaust',
      'bp': 'blood pressure', 'bmi': 'nutrition', 'calories': 'nutrition', 'carbs': 'nutrition', 'gut health': 'digestion', 'immune': 'immune system',
      'mental illness': 'mental health', 'anxiety': 'mental health', 'depression': 'mental health',
      'quadratic': 'algebra', 'differentiation': 'calculus', 'integration': 'calculus', 'matrices': 'linear algebra', 'vectors': 'linear algebra', 'probability theory': 'statistics',
      'north pole': 'arctic', 'south pole': 'antarctic', 'rainforest': 'amazon', 'sahel': 'deserts', 'tundra': 'arctic',
      'espresso': 'coffee', 'latte': 'coffee', 'cappuccino': 'coffee', 'mozzarella': 'cheese', 'parmesan': 'cheese', 'sourdough': 'bread', 'baguette': 'bread', 'spaghetti': 'pasta', 'penne': 'pasta',
    };

    function expandSynonyms(q) {
      let result = q;
      for (const [syn, canonical] of Object.entries(synonymMap)) {
        if (result.includes(syn)) result = result + ' ' + canonical;
      }
      return result;
    }

    // 3. STEM MATCHING — strip common suffixes so "running" matches "run"
    function stemWord(w) {
      return w
        .replace(/izing$/, 'ize').replace(/ising$/, 'ise')
        .replace(/ization$/, '').replace(/isation$/, '')
        .replace(/ational$/, 'ate').replace(/tional$/, 'tion')
        .replace(/izes$/, 'ize').replace(/ised$/, 'ise')
        .replace(/nesses$/, '').replace(/ness$/, '')
        .replace(/ments$/, '').replace(/ment$/, '')
        .replace(/ities$/, 'ity').replace(/ity$/, '')
        .replace(/ically$/, 'ic')
        .replace(/ical$/, 'ic')
        .replace(/ations$/, 'ate').replace(/ation$/, 'ate')
        .replace(/ators$/, 'ate').replace(/ator$/, 'ate')
        .replace(/ings$/, '').replace(/ing$/, '')
        .replace(/edly$/, '')
        .replace(/ed$/, '')
        .replace(/ers$/, '').replace(/er$/, '')
        .replace(/ies$/, 'y').replace(/es$/, '').replace(/s$/, '');
    }

    function stemScore(keyword, query) {
      const kStem = stemWord(keyword.toLowerCase());
      const words = query.split(/\s+/);
      return words.some(w => stemWord(w) === kStem && w.length > 3) ? 1 : 0;
    }

    // 4. TOPIC EXTRACTION — pull the subject from common question patterns
    function extractTopic(q) {
      const patterns = [
        /(?:what is|what are|what's|whats)\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s+and|\s+or|\s+\?|$)/i,
        /(?:how does|how do|how did)\s+(?:a\s+|an\s+|the\s+)?(.+?)\s+(?:work|function|happen|form|develop|grow|reproduce|move|fly|swim|run|eat|live)/i,
        /(?:why (?:is|are|do|does|did|can|can't))\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s+so|\s+\?|$)/i,
        /(?:tell me about|info on|facts about|about)\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s+\?|$)/i,
        /(?:what do|what does)\s+(.+?)\s+(?:eat|drink|need|live|do|mean|say|look like|sound like)/i,
        /(?:where (?:do|does|did|is|are))\s+(?:a\s+|an\s+|the\s+)?(.+?)\s+(?:live|come from|originate|grow|found)/i,
        /(?:how (?:big|large|small|tall|heavy|fast|old|long|far|much|many))\s+(?:is|are|was|were|can)\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s+\?|$)/i,
        /(?:can|do|does|is|are)\s+(?:a\s+|an\s+|the\s+)?(.+?)\s+(?:fly|swim|talk|think|feel|dream|sleep|breathe|lay eggs|have|see|hear)/i,
        /(?:is it true that|is it true)\s+(.+?)(?:\?|$)/i,
        /(?:have you heard of|do you know what|do you know about)\s+(.+?)(?:\?|$)/i,
        /(?:what's the deal with|what's up with)\s+(.+?)(?:\?|$)/i,
        /(?:define|meaning of|what does)\s+(.+?)\s+(?:mean|stand for|refer to)?(?:\?|$)/i,
        /(?:difference between|compare)\s+(.+?)\s+and\s+(.+?)(?:\?|$)/i,
        /(?:examples? of|types? of|kinds? of)\s+(.+?)(?:\?|$)/i,
        /(?:history of|origin of|story of|who invented|who discovered|who created|who founded)\s+(.+?)(?:\?|$)/i,
        /(?:how (?:do|does|did|can|could|would|should|to))\s+(?:i|you|we|one)?\s*(.+?)\s+(?:work|function|happen|start|begin|end|stop|improve|learn|get|make|use|fix|build|create|find)/i,
      ];
      for (const pat of patterns) {
        const m = q.match(pat);
        if (m && m[1] && m[1].trim().length > 1) return m[1].trim().toLowerCase();
      }
      return null;
    }

    // ── Intent map (expanded) ──
    const intentMap = {
      diet:      ['eat', 'diet', 'food', 'feed', 'prey', 'herbivore', 'carnivore', 'omnivore', 'drink', 'nutrition', 'meal', 'consume', 'graze', 'hunt', 'forage', 'scavenge'],
      size:      ['big', 'large', 'small', 'tall', 'heavy', 'weight', 'size', 'long', 'wide', 'huge', 'giant', 'tiny', 'height', 'diameter', 'measure', 'biggest', 'largest', 'smallest', 'massive'],
      color:     ['color', 'colour', 'red', 'blue', 'green', 'black', 'white', 'pink', 'yellow', 'orange', 'purple', 'brown', 'look like', 'appearance', 'markings', 'spots', 'stripes'],
      speed:     ['fast', 'speed', 'run', 'swim', 'fly', 'quick', 'slow', 'mph', 'km/h', 'velocity', 'fastest', 'slowest'],
      habitat:   ['live', 'habitat', 'where', 'home', 'found', 'region', 'country', 'continent', 'environment', 'range', 'native to', 'come from', 'origin'],
      lifespan:  ['lifespan', 'how old', 'how long', 'age', 'live to', 'years old', 'longest living', 'oldest'],
      danger:    ['dangerous', 'attack', 'bite', 'sting', 'venom', 'poison', 'kill', 'hurt', 'safe', 'deadly', 'aggressive', 'threat'],
      sound:     ['sound', 'noise', 'call', 'roar', 'bark', 'sing', 'communicate', 'talk', 'vocalize', 'growl', 'purr', 'howl', 'chirp'],
      baby:      ['baby', 'young', 'cub', 'pup', 'foal', 'calf', 'born', 'birth', 'newborn', 'offspring', 'reproduce', 'pregnancy', 'gestation'],
      sleep:     ['sleep', 'rest', 'nocturnal', 'awake', 'hibernate', 'nap', 'dormant'],
      smell:     ['smell', 'scent', 'nose', 'sniff', 'sense of smell', 'olfactory'],
      reproduction: ['reproduce', 'mate', 'breeding', 'pregnant', 'eggs', 'gestation', 'spawn', 'litter', 'offspring'],
      intelligence: ['smart', 'intelligent', 'clever', 'brain', 'learn', 'think', 'memory', 'problem solving', 'iq', 'cognitive'],
      history_of: ['history', 'origin', 'invented', 'discovered', 'created', 'founded', 'first', 'ancient', 'old', 'began', 'started'],
      how_works: ['how does', 'how do', 'mechanism', 'process', 'function', 'work', 'operate'],
      comparison: ['vs', 'versus', 'difference', 'compare', 'better', 'worse', 'similar', 'different'],
      examples: ['example', 'examples', 'types', 'kinds', 'varieties', 'list', 'name some', 'give me'],
    };

    function getIntent(q) {
      for (const [intent, words] of Object.entries(intentMap)) {
        if (words.some(w => q.includes(w))) return { intent, words };
      }
      return null;
    }

    // ── Main knowledge scoring ──────────────────────────────
    function scoreFactAgainst(fact, queryVariants) {
      if (!fact.keywords) return 0;
      let best = 0;
      for (const q of queryVariants) {
        let score = 0;
        for (const k of fact.keywords) {
          const kl = k.toLowerCase();
          // Junk-keyword guard (v60): a stray stopword keyword like "like" or
          // "good" must never score — otherwise ANY sentence containing it
          // ("i like it") exact-matches and dumps that fact (the Euler's-number
          // "like" bug). Protects against bad data, including generated facts.
          if (KW_STOPWORDS.has(kl)) continue;
          // exact substring match (word-boundary aware)
          let exactMatch = false;
          try {
            const esc = kl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Word-boundary on BOTH sides for alphanumeric keywords, so short
            // keywords like "act" don't match inside "actually" (v59 fix).
            const re = /^[a-z0-9 ]+$/.test(kl) ? new RegExp('\\b' + esc + '\\b') : new RegExp(esc);
            exactMatch = re.test(q);
          } catch(e) { exactMatch = q.includes(kl); }
          if (exactMatch) { score += 2; continue; } // exact match worth 2
          // stem match
          if (kl.length > 4 && stemScore(kl, q)) { score += 1; continue; }
          // partial: a query word and a keyword word share a prefix. BOTH must
          // be >4 chars — otherwise short words like "do"/"me" prefix-match
          // "docker"/"mentor" and dump unrelated facts on conversational input
          // (v59 fix).
          const kWords = kl.split(/\s+/);
          const qWords = q.split(/\s+/);
          if (kWords.some(kw => kw.length > 4 && qWords.some(qw => qw.length > 4 && (qw.startsWith(kw) || kw.startsWith(qw))))) { score += 0.5; }
        }
        if (score > best) best = score;
      }
      return best;
    }

    // ── Context-aware follow-up handling ──────────────────────────
    // If this is a very short follow-up (under 4 words, no question words), append last topic
    function applyContextualFollowUp(q) {
      if (_lastTopicLabel && q.includes(_lastTopicLabel)) return q;
      const wordCount = q.split(/\s+/).length;
      const hasQuestionWords = /^(what|who|how|why|where|when|is|are|do|does|can|could|would|should|will|did|was|were)/.test(q);
      if (wordCount <= 3 && !hasQuestionWords && _lastTopicLabel) {
        // Append last topic to boost relevance (e.g., "and size?" becomes "and size elephant")
        return q + ' ' + _lastTopicLabel;
      }
      return q;
    }

    // Casual statement, not a question — e.g. "i think that was weird",
    // "lol you're funny", "i'm gonna tell on you". Mirror of the mj CLI's
    // is_casual_statement so a rambling first-person remark that merely shares
    // a keyword doesn't dump an encyclopedia entry. Runs after every real
    // dispatcher (story/coding/math/science/terminal), just before lookup.
    {
      const hasQ = /^(what|why|how|where|when|who|which|can |do |does |is |are |was |were |will |would |could |should |tell me|explain|define)/.test(lower) || lower.endsWith('?');
      const casualWords = ['cool','awesome','nice','great','love','hate','think','feel','wow','lol','haha','interesting','yeah','yep','nope','okay','sure','thanks','thank you','no way','really','seriously','funny','weird','agree','i guess','i bet','gonna tell','tell on you'];
      if (!hasQ && lower.split(/\s+/).length >= 4 && casualWords.some(w => lower.includes(w))) {
        return pick([
          "Ha, gotcha! 🐒 What do you want to know?",
          "🐒 Fair enough! Anything I can help with?",
          "Cool — ask me something! 🐒",
          "Interesting! What's on your mind? 🐒"
        ]);
      }
    }

    if (knowledge && knowledge.facts) {
      // Build query variants: original, stripped, synonym-expanded, topic-extracted
      const contextualQ = applyContextualFollowUp(lower);
      const stripped   = stripQuestion(contextualQ);
      const expanded   = expandSynonyms(contextualQ);
      const strExpanded = expandSynonyms(stripped);
      const topic      = extractTopic(contextualQ);
      const variants   = [contextualQ, stripped, expanded, strExpanded];
      if (topic) variants.push(topic, expandSynonyms(topic));

      let bestFact = null, bestScore = 0;
      const allFacts = (knowledge.facts || []).concat((coding && coding.facts) || []);
      for (const fact of allFacts) {
        const score = scoreFactAgainst(fact, variants);
        if (score > bestScore) { bestScore = score; bestFact = fact; }
      }

      // Improved threshold: require >= 1.5 for knowledge match, fall back to search for weak matches (0.5-1.5)
      if (bestFact && bestScore >= 1.5) {
        const intentResult = getIntent(lower);
        if (intentResult) {
          const answerLower = bestFact.answer.toLowerCase();
          const covered = intentResult.words.some(w => answerLower.includes(w));
          if (!covered) return '__SEARCH__:' + input;
        }
        _lastTopicKeywords = bestFact.keywords;
        _lastTopicLabel    = bestFact.keywords[0];
        _lastFactAnswer    = bestFact.answer;
        if (typeof Memory !== 'undefined') Memory.recordTopic(bestFact.keywords[0]);
        let out = bestFact.answer;
        if (shouldFlavor(lower)) {
          out = flavorFact(out, null);
          _recentFlavorAge = 0;
        }
        out = maybeAppendStoryHook(out, bestFact);
        return out;
      }

      // Weak match (0.5-1.5 score): fall back to search instead of returning unreliable answer
      if (bestFact && bestScore > 0.5 && bestScore < 1.5) {
        return '__SEARCH__:' + input.replace(/^(find a link to|find me|find a|find|look up|show me|get me|can you find|s[ea]rch for|s[ea]rch the web for)\s+/i, '');
      }
    }

    // Search detection
    if (needsSearch(lower)) {
      return '__SEARCH__:' + input.replace(/^(find a link to|find me|find a|find|look up|show me|get me|can you find|s[ea]rch for|s[ea]rch the web for)\s+/i, '');
    }

    return withProcedural("Hmm, I don't know that one yet 🐒 Try asking me to search the web for it, or ask Akiva to add it to my brain!");
  }

  function detectEmotion(lower, original) {
    if (!rules || !rules.emotions) return null;
    let best = null, bestScore = 0;
    for (const [emotion, data] of Object.entries(rules.emotions)) {
      const score = data.signals.filter(s => emotionSignalHit(s, lower, original)).length;
      if (score > bestScore) { bestScore = score; best = emotion; }
    }
    return bestScore > 0 ? best : null;
  }

  // A signal hits if it's present. Two guards prevent over-firing (v59):
  //  - Signals written in CAPS (e.g. "WHY", "WHY WON'T") are SHOUTING markers
  //    — match case-sensitively against the original text only, so a normal
  //    lowercase "why is the sky blue" doesn't read as anger.
  //  - Short all-letter signals (≤3 chars, e.g. "ugh", "grr") must match as a
  //    whole word, so they don't fire inside unrelated words.
  function emotionSignalHit(signal, lower, original) {
    const hasUpper = /[A-Z]/.test(signal);
    if (hasUpper) return original.includes(signal);          // shouting: exact case
    const s = signal.toLowerCase();
    if (/^[a-z]+$/.test(s) && s.length <= 3) {
      return new RegExp('\\b' + s + '\\b').test(lower);       // whole-word only
    }
    return lower.includes(s);
  }

  function needsSearch(input) {
    const questionTriggers = [
      'what is', 'what are', 'what do', 'what does', 'what did', 'what can',
      'who is', 'who are', 'who was', 'who am',
      'when did', 'when was', 'when is',
      'how do', 'how does', 'how did', 'how to', 'how many', 'how much',
      'why does', 'why did', 'why is', 'why can',
      'where is', 'where can', 'where do',
      'news about', 'latest on', 'current status',
      'tell me about', 'explain'
    ];
    if (questionTriggers.some(t => input.startsWith(t + ' ') || input === t || input.startsWith(t + '?'))) return true;

    const actionTriggers = [
      'look up', 'search for', 'search the web for',
      'link to', 'photo of', 'picture of', 'image of',
      'show me', 'can you find', 'find me', 'find a link',
      'get me a link', 'find info', 'find monkeys', 'find a'
    ];
    if (actionTriggers.some(t => input.includes(t))) return true;

    // "find X" at start of input
    if (/^find\s+\w/.test(input)) return true;

    return false;
  }

  return { load, respond };
})();
