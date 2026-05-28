const Generator = (() => {
  let templates = null;
  let dictionary = null;
  let beats = null;

  // Per-slot recent-word tracking. Same slot key (pos+theme) avoids repeating
  // recent picks; the cap stops it from "forgetting" too slowly.
  const recentWords = {};
  const RECENT_LIMIT = 30;

  // Beat-level dedup: in-chain (`usedBeatIds`) plus cross-story ring buffer.
  const recentBeatIds = [];
  const BEAT_HISTORY = 20;

  // Closer dedup: ring of stem-sets so the same metaphor (e.g. "heart")
  // doesn't fire twice within a few stories. recentCloserTexts catches
  // verbatim repeats of closers whose every word is too short to be a stem.
  const recentCloserStems = [];
  const recentCloserTexts = [];
  const CLOSER_STEM_HISTORY = 5;

  function init(t, d, b) {
    templates = t;
    dictionary = d;
    beats = b || null;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ── English pluralization ──────────────────────────────────
  const IRREGULAR_PLURALS = {
    'jellyfish': 'jellyfish', 'octopus': 'octopuses', 'equinox': 'equinoxes',
    'ox': 'oxen', 'mouse': 'mice', 'goose': 'geese',
    'wolf': 'wolves', 'leaf': 'leaves', 'half': 'halves',
    'knife': 'knives', 'life': 'lives', 'self': 'selves', 'thief': 'thieves',
    'child': 'children', 'person': 'people',
    'foot': 'feet', 'tooth': 'teeth',
    'cactus': 'cacti', 'fungus': 'fungi', 'nucleus': 'nuclei', 'alumnus': 'alumni',
    'criterion': 'criteria', 'phenomenon': 'phenomena',
    'index': 'indices', 'matrix': 'matrices', 'vertex': 'vertices'
  };
  // -f / -fe words that keep the f (don't take -ves).
  const F_EXCEPTIONS = new Set(['roof', 'chief', 'belief', 'cliff', 'cuff',
    'gulf', 'reef', 'safe', 'cafe', 'proof', 'staff']);

  function pluralize(word) {
    if (!word) return word;
    const lw = word.toLowerCase();
    if (IRREGULAR_PLURALS[lw] !== undefined) return IRREGULAR_PLURALS[lw];
    if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
    if (/(?:s|x|z|ch|sh)$/i.test(word)) return word + 'es';
    if (/fe$/i.test(word) && !F_EXCEPTIONS.has(lw)) return word.slice(0, -2) + 'ves';
    if (/f$/i.test(word) && !F_EXCEPTIONS.has(lw)) return word.slice(0, -1) + 'ves';
    return word + 's';
  }

  // Words ≥ 5 chars in closers usually carry the metaphor. Skip common
  // function words so the stem-check focuses on content words.
  const CLOSER_STOPWORDS = new Set([
    'again','still','about','where','their','those','these','would','could',
    'should','might','first','small','great','every','until','while','being',
    'there','which','other','after','before','around','always','never'
  ]);

  function extractStems(text) {
    const out = new Set();
    const matches = text.toLowerCase().match(/[a-z]{5,}/g) || [];
    for (const w of matches) if (!CLOSER_STOPWORDS.has(w)) out.add(w);
    return out;
  }

  const posMap = {
    'NOUN': 'noun',
    'VERB': 'verb',
    'ADJ':  'adjective',
    'ADV':  'adverb',
    'CONN': 'connector'
  };

  function pickWord(slot, tone) {
    if (!dictionary || !dictionary.words) return '';
    const parts = slot.split(':');
    const wantPos = posMap[parts[0]] || parts[0].toLowerCase();
    const theme   = parts[1] || null;

    let candidates = dictionary.words.filter(w => {
      if (w.pos !== wantPos) return false;
      if (theme && (!w.themes || !w.themes.includes(theme))) return false;
      return true;
    });
    // Theme pool empty → fall back to any word of this pos so the slot
    // never leaks raw to the user.
    if (!candidates.length && theme) {
      candidates = dictionary.words.filter(w => w.pos === wantPos);
    }
    if (!candidates.length) return '';

    if (tone) {
      const toned = candidates.filter(w => w.tone && w.tone.includes(tone));
      if (toned.length) candidates = toned;
    }

    // De-repetition: avoid words used recently for this slot. If filtering
    // would empty the pool, keep the full pool — variety is best-effort.
    const recentKey = wantPos + ':' + (theme || '');
    const recent = recentWords[recentKey] || [];
    if (recent.length) {
      const fresh = candidates.filter(w => !recent.includes(w.word));
      if (fresh.length) candidates = fresh;
    }

    const chosen = pick(candidates).word;
    if (!recentWords[recentKey]) recentWords[recentKey] = [];
    recentWords[recentKey].push(chosen);
    if (recentWords[recentKey].length > RECENT_LIMIT) recentWords[recentKey].shift();
    return chosen;
  }

  function isKnownNoun(word) {
    if (!dictionary || !dictionary.words || !word) return false;
    const w = word.toLowerCase();
    return dictionary.words.some(d => d.pos === 'noun' && d.word.toLowerCase() === w);
  }

  // Strip parentheticals containing digits ("(~15 plates moving 1-15 cm/year)"),
  // keep first sentence, cap at 120 chars on word boundary.
  function factSnippet(answer) {
    if (!answer) return '';
    let cleaned = answer.replace(/\s*\([^)]*\d[^)]*\)/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    const m = cleaned.match(/^[^.!?]+[.!?]/);
    let first = m ? m[0].trim() : cleaned;
    if (first.length > 120) {
      const cut = first.slice(0, 120);
      const lastSpace = cut.lastIndexOf(' ');
      first = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + '...';
    }
    return first;
  }

  // Fill a single template + return what nouns bound to (so callers can
  // persist them across turns for continuation mode). Trailing `s` immediately
  // after a NOUN slot is treated as a plural marker and routed through
  // pluralize() instead of being a literal `s`.
  function fillTemplate(text, opts) {
    const bindings = {};
    if (opts.character) bindings['NOUN:character'] = opts.character;
    if (opts.place)     bindings['NOUN:place']     = opts.place;
    if (opts.subject && isKnownNoun(opts.subject)) {
      bindings['NOUN:character'] = bindings['NOUN:character'] || opts.subject;
    }
    const factText = opts.fact ? factSnippet(opts.fact) : '';

    const filled = text.replace(/\{([^}]+)\}(s\b)?/g, (match, slot, suffix) => {
      if (slot === 'FACT') return factText + (suffix || '');
      const isNoun = slot.startsWith('NOUN');
      let word;
      if (isNoun && bindings[slot]) {
        word = bindings[slot];
      } else {
        word = pickWord(slot, opts.tone);
        if (isNoun) bindings[slot] = word;
      }
      if (suffix && isNoun) return pluralize(word);
      return word + (suffix || '');
    });
    return { text: filled, bindings };
  }

  function fixSentenceCase(s) {
    return s.replace(/(^|[.!?]\s+)([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase());
  }

  // Naïve a/an correction. Covers vowel-letter starts but not every English
  // exception (no "an hour" / "a university" handling).
  function fixArticles(s) {
    return s.replace(/\b(a|an|A|An)\s+([A-Za-z][A-Za-z']*)/g, (m, art, word) => {
      const isVowelStart = /^[aeiou]/i.test(word);
      const capitalized  = art[0] === 'A';
      let newArt = isVowelStart ? 'an' : 'a';
      if (capitalized) newArt = newArt[0].toUpperCase() + newArt.slice(1);
      return newArt + ' ' + word;
    });
  }

  // Pick a template pool by mode/tone. Falls back gracefully when the pool
  // for the requested mode is empty.
  function pickTemplate(opts) {
    let pool;
    if (opts.mode === 'micro' && templates.microStories && templates.microStories.length) {
      pool = templates.microStories;
    } else if (opts.continuation && templates.continuations && templates.continuations.length) {
      pool = templates.continuations;
    } else if (opts.fact && templates.factStories && templates.factStories.length) {
      pool = templates.factStories;
    } else {
      pool = templates.stories || [];
    }
    if (opts.tone) {
      const toned = pool.filter(s => s.tone && s.tone.includes(opts.tone));
      if (toned.length) return pick(toned);
    }
    return pick(pool);
  }

  function pickCloser(tone) {
    if (!templates || !templates.closers || !templates.closers.length) return null;
    let pool = templates.closers;
    if (tone) {
      const toned = pool.filter(c => c.tone && c.tone.includes(tone));
      if (toned.length) pool = toned;
    }
    // Drop closers that share a stem with anything in the recent window.
    const recentUnion = new Set();
    for (const s of recentCloserStems) for (const w of s) recentUnion.add(w);
    const dropByStems = recentUnion.size
      ? pool.filter(c => {
          for (const w of extractStems(c.text)) if (recentUnion.has(w)) return false;
          return true;
        })
      : pool;
    const dropByText = dropByStems.filter(c => !recentCloserTexts.includes(c.text));
    pool = dropByText.length ? dropByText : (dropByStems.length ? dropByStems : pool);
    const chosen = pick(pool);
    recentCloserStems.push(extractStems(chosen.text));
    recentCloserTexts.push(chosen.text);
    if (recentCloserStems.length > CLOSER_STEM_HISTORY) recentCloserStems.shift();
    if (recentCloserTexts.length > CLOSER_STEM_HISTORY) recentCloserTexts.shift();
    // Closers may contain slots — fill them so {NOUN:plant} etc. don't
    // leak raw to the user.
    const r = fillTemplate(chosen.text, { tone });
    return fixSentenceCase(fixArticles(r.text));
  }

  function pickPacingBeat() {
    if (!templates || !templates.pacingBeats || !templates.pacingBeats.length) return null;
    return pick(templates.pacingBeats).text;
  }

  // ── Beat-chain mode ─────────────────────────────────────────
  // Build a 4-6 beat story by walking the storyBeats graph. Opens on a
  // tone-matching opening, follows next_beats links, and ends on a closing.
  // Character and place lock across beats for continuity.
  function generateBeatStory(opts) {
    if (!beats || !beats.beats || !beats.beats.length) {
      // No beats file → fall back to a regular tone-matched story.
      return generateStory({ ...opts, mode: 'regular' });
    }
    const tone = opts.tone || null;

    const byId = {};
    for (const b of beats.beats) byId[b.id] = b;
    const byType = (type) => beats.beats.filter(b => b.type === type);
    const matchTone = (list) => {
      if (!tone) return list;
      const t = list.filter(b => b.tone && b.tone.includes(tone));
      return t.length ? t : list;
    };
    // Combined blocklist: this-chain visits + cross-story recent ring.
    const usedBeatIds = new Set();
    const dropBlocked = (list) => {
      const fresh = list.filter(b => !usedBeatIds.has(b.id)
                                  && !recentBeatIds.includes(b.id));
      return fresh.length ? fresh : list;
    };

    let current = pick(dropBlocked(matchTone(byType('opening'))));
    if (!current) return generateStory({ ...opts, mode: 'regular' });

    const chain = [];
    const targetLen = 4 + Math.floor(Math.random() * 3); // 4–6 beats

    for (let i = 0; i < targetLen + 2; i++) {
      chain.push(current);
      usedBeatIds.add(current.id);
      if (current.type === 'closing') break;
      if (!current.next_beats || !current.next_beats.length) break;

      let cands = current.next_beats.map(id => byId[id]).filter(Boolean);
      if (!cands.length) break;

      // After 3 hops, bias toward resolution / closing so chains end well.
      if (i >= 3) {
        const endish = cands.filter(b => b.type === 'closing' || b.type === 'resolution');
        if (endish.length) cands = endish;
      }
      cands = matchTone(cands);
      cands = dropBlocked(cands);
      current = pick(cands);
    }

    // Force a closing if we ran out of hops without hitting one.
    if (chain[chain.length - 1].type !== 'closing') {
      const closings = dropBlocked(matchTone(byType('closing')));
      if (closings.length) chain.push(pick(closings));
    }

    // Record this chain's beats so the next story avoids them.
    for (const b of chain) {
      recentBeatIds.push(b.id);
      if (recentBeatIds.length > BEAT_HISTORY) recentBeatIds.shift();
    }

    let character = opts.character || null;
    let place     = opts.place     || null;
    const subject = opts.subject   || null;

    const out = [];
    for (let i = 0; i < chain.length; i++) {
      const b = chain[i];
      const r = fillTemplate(b.text, { tone, character, place, subject });
      character = character || r.bindings['NOUN:character'] || null;
      place     = place     || r.bindings['NOUN:place']     || null;
      out.push(r.text);
      // Coin-flip pacing beat between regular beats (not before closing).
      if (i < chain.length - 1 && chain[i + 1].type !== 'closing' && Math.random() < 0.28) {
        const p = pickPacingBeat();
        if (p) out.push(p);
      }
    }

    let text = fixSentenceCase(fixArticles(out.join(' ')));
    const closer = pickCloser(tone);
    if (closer) text += '\n\n' + closer;

    return {
      text,
      character,
      place,
      tone,
      subject,
      mode: 'beats'
    };
  }

  // Public entry. Backward-compat: string arg = tone (old Phase 2 callers).
  // opts: { tone, subject, fact, character, place, continuation, mode }
  // mode: 'micro' | 'beats' | (default regular)
  function generateStory(arg) {
    if (!templates || !templates.stories || !templates.stories.length) {
      return { text: "I want to tell stories, but my story-brain isn't loaded yet! 🐒" };
    }
    if (!dictionary || !dictionary.words || !dictionary.words.length) {
      return { text: "I want to tell stories, but my word-brain isn't loaded yet! 🐒" };
    }

    let opts;
    if (typeof arg === 'string' || arg == null) opts = { tone: arg || null };
    else opts = arg;
    opts.tone         = opts.tone         || null;
    opts.subject      = opts.subject      || null;
    opts.fact         = opts.fact         || null;
    opts.character    = opts.character    || null;
    opts.place        = opts.place        || null;
    opts.continuation = !!opts.continuation;
    opts.mode         = opts.mode         || 'regular';

    if (opts.mode === 'beats') {
      return generateBeatStory(opts);
    }

    const tpl     = pickTemplate(opts);
    const tplText = typeof tpl === 'string' ? tpl : tpl.text;
    const result  = fillTemplate(tplText, opts);

    let text = fixSentenceCase(fixArticles(result.text));

    // Add a closer ~40% of the time for regular stories. Micro & continuation
    // skip the closer — they're already short / mid-arc.
    if (opts.mode === 'regular' && !opts.continuation && Math.random() < 0.4) {
      const closer = pickCloser(opts.tone);
      if (closer) text += '\n\n' + closer;
    }

    return {
      text,
      character: result.bindings['NOUN:character'] || null,
      place:     result.bindings['NOUN:place']     || null,
      tone:      opts.tone,
      subject:   opts.subject,
      mode:      opts.mode
    };
  }

  // Public slot-filler for callers (e.g. brain.js response flavoring)
  // that want to render a template string without going through the
  // full story-picking pipeline.
  function fillSlots(text, opts) {
    if (!text) return '';
    opts = opts || {};
    if (!dictionary || !dictionary.words || !dictionary.words.length) return text;
    const r = fillTemplate(text, {
      tone:      opts.tone      || null,
      character: opts.character || null,
      place:     opts.place     || null,
      subject:   opts.subject   || null,
      fact:      opts.fact      || null
    });
    return fixSentenceCase(fixArticles(r.text));
  }

  return { init, generateStory, fillSlots };
})();
