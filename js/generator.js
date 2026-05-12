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

  const posMap = {
    'NOUN': 'noun',
    'VERB': 'verb',
    'ADJ':  'adjective',
    'ADV':  'adverb',
    'CONN': 'connector'
  };

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

  function isKnownNoun(word) {
    if (!dictionary || !dictionary.words || !word) return false;
    const w = word.toLowerCase();
    return dictionary.words.some(d => d.pos === 'noun' && d.word.toLowerCase() === w);
  }

  function factSnippet(answer) {
    if (!answer) return '';
    const m = answer.match(/^[^.!?]+[.!?]/);
    if (m) return m[0].trim();
    return (answer.length > 180 ? answer.slice(0, 180).trim() + '...' : answer.trim());
  }

  // Fill template + return what nouns bound to (so the caller can persist
  // them across turns for continuation mode).
  function fillTemplate(text, opts) {
    const bindings = {};
    // Force-bind from session/subject so the protagonist & place persist.
    if (opts.character) bindings['NOUN:character'] = opts.character;
    if (opts.place)     bindings['NOUN:place']     = opts.place;
    if (opts.subject && isKnownNoun(opts.subject)) {
      bindings['NOUN:character'] = bindings['NOUN:character'] || opts.subject;
    }
    const factText = opts.fact ? factSnippet(opts.fact) : '';

    const filled = text.replace(/\{([^}]+)\}/g, (match, slot) => {
      if (slot === 'FACT') return factText;
      const isNoun = slot.startsWith('NOUN');
      if (isNoun && bindings[slot]) return bindings[slot];
      const word = pickWord(slot, opts.tone);
      if (isNoun) bindings[slot] = word;
      return word;
    });
    return { text: filled, bindings };
  }

  function fixSentenceCase(s) {
    return s.replace(/(^|[.!?]\s+)([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase());
  }

  // Pick a template based on mode (continuation vs. fact vs. regular) and tone.
  function pickTemplate(opts) {
    let pool;
    if (opts.continuation && templates.continuations && templates.continuations.length) {
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

  // Public entry point. Returns { text, character, place, tone, subject }.
  // Backward compat: a string arg is treated as tone (Phase 2 callers).
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

    const tpl = pickTemplate(opts);
    const tplText = typeof tpl === 'string' ? tpl : tpl.text;
    const result  = fillTemplate(tplText, opts);

    return {
      text:      fixSentenceCase(result.text),
      character: result.bindings['NOUN:character'] || null,
      place:     result.bindings['NOUN:place']     || null,
      tone:      opts.tone,
      subject:   opts.subject
    };
  }

  return { init, generateStory };
})();
