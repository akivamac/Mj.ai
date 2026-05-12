const Generator = (() => {
  let templates = null;
  let dictionary = null;

  function init(t, d) {
    templates = t;
    dictionary = d;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // posMap: short slot codes → dictionary pos field
  const posMap = {
    'NOUN': 'noun',
    'VERB': 'verb',
    'ADJ':  'adjective',
    'ADV':  'adverb',
    'CONN': 'connector'
  };

  // Pick a word for a slot. If tone is given, prefer candidates whose tone
  // array includes it; fall back to all candidates if no toned match exists.
  function pickWord(slot, tone) {
    if (!dictionary || !dictionary.words) return '[?]';
    const parts = slot.split(':');
    const wantPos = posMap[parts[0]] || parts[0].toLowerCase();
    const theme   = parts[1] || null;

    let candidates = dictionary.words.filter(w => {
      if (w.pos !== wantPos) return false;
      if (theme && (!w.themes || !w.themes.includes(theme))) return false;
      return true;
    });
    if (!candidates.length) return '[' + slot + '?]';

    if (tone) {
      const toned = candidates.filter(w => w.tone && w.tone.includes(tone));
      if (toned.length) candidates = toned;
    }
    return pick(candidates).word;
  }

  // Check if a word exists in the dictionary as a noun — used to decide
  // whether to force a user-provided subject as the story's protagonist.
  function isKnownNoun(word) {
    if (!dictionary || !dictionary.words || !word) return false;
    const w = word.toLowerCase();
    return dictionary.words.some(d => d.pos === 'noun' && d.word.toLowerCase() === w);
  }

  // First sentence (or up to ~180 chars) of a fact answer — keeps the
  // weave readable when knowledge entries are paragraph-length.
  function factSnippet(answer) {
    if (!answer) return '';
    const m = answer.match(/^[^.!?]+[.!?]/);
    if (m) return m[0].trim();
    return (answer.length > 180 ? answer.slice(0, 180).trim() + '...' : answer.trim());
  }

  // Fill one template. Nouns with identical slot strings bind to the same
  // word; other PoS pick freshly. If a known subject is provided, the
  // first {NOUN:character} occurrence is locked to it so the story stays
  // on topic.
  function fillTemplate(text, opts) {
    const nounBindings = {};
    if (opts.subject && isKnownNoun(opts.subject)) {
      nounBindings['NOUN:character'] = opts.subject;
    }
    const factText = opts.fact ? factSnippet(opts.fact) : '';

    return text.replace(/\{([^}]+)\}/g, (match, slot) => {
      if (slot === 'FACT') return factText;
      const isNoun = slot.startsWith('NOUN');
      if (isNoun && nounBindings[slot]) return nounBindings[slot];
      const word = pickWord(slot, opts.tone);
      if (isNoun) nounBindings[slot] = word;
      return word;
    });
  }

  function fixSentenceCase(s) {
    return s.replace(/(^|[.!?]\s+)([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase());
  }

  // Pick a template. When a fact is provided, prefer fact-weaver templates
  // (those have a {FACT} slot). Within that pool, prefer matching tone.
  function pickTemplate(opts) {
    const wantFact = !!opts.fact;
    const factList = (templates.factStories || []);
    const baseList = templates.stories || [];

    let pool;
    if (wantFact && factList.length) {
      pool = factList;
    } else {
      pool = baseList;
    }

    if (opts.tone) {
      const toned = pool.filter(s => s.tone && s.tone.includes(opts.tone));
      if (toned.length) return pick(toned);
    }
    return pick(pool);
  }

  // Public entry point. Accepts either a tone string (back-compat with
  // Phase 2 callers) or an options object { tone, subject, fact }.
  function generateStory(arg) {
    if (!templates || !templates.stories || !templates.stories.length) {
      return "I want to tell stories, but my story-brain isn't loaded yet! 🐒";
    }
    if (!dictionary || !dictionary.words || !dictionary.words.length) {
      return "I want to tell stories, but my word-brain isn't loaded yet! 🐒";
    }

    let opts;
    if (typeof arg === 'string' || arg == null) opts = { tone: arg || null };
    else opts = arg;
    opts.tone = opts.tone || null;
    opts.subject = opts.subject || null;
    opts.fact = opts.fact || null;

    const tpl = pickTemplate(opts);
    const text = typeof tpl === 'string' ? tpl : tpl.text;
    return fixSentenceCase(fillTemplate(text, opts));
  }

  return { init, generateStory };
})();
