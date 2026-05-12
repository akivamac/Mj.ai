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

  // Fill one template. Nouns with identical slot strings bind to the same word
  // (so a character/place stays consistent through the story). Other parts of
  // speech pick freshly each time so the language doesn't feel mechanical.
  function fillTemplate(template, tone) {
    const nounBindings = {};
    return template.replace(/\{([^}]+)\}/g, (match, slot) => {
      const isNoun = slot.startsWith('NOUN');
      if (isNoun && nounBindings[slot]) return nounBindings[slot];
      const word = pickWord(slot, tone);
      if (isNoun) nounBindings[slot] = word;
      return word;
    });
  }

  // Capitalize the first letter of every sentence (handles slots like {ADV}
  // that land at sentence start with a lowercase word).
  function fixSentenceCase(s) {
    return s.replace(/(^|[.!?]\s+)([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase());
  }

  // Pick a template matching the requested tone. Order of preference:
  // 1) templates explicitly tagged with the tone
  // 2) any template (so the user always gets a story, even if no tone match)
  function pickTemplate(tone) {
    const list = templates.stories;
    if (tone) {
      const toned = list.filter(s => s.tone && s.tone.includes(tone));
      if (toned.length) return pick(toned);
    }
    return pick(list);
  }

  function generateStory(tone) {
    if (!templates || !templates.stories || !templates.stories.length) {
      return "I want to tell stories, but my story-brain isn't loaded yet! 🐒";
    }
    if (!dictionary || !dictionary.words || !dictionary.words.length) {
      return "I want to tell stories, but my word-brain isn't loaded yet! 🐒";
    }
    const tpl = pickTemplate(tone || null);
    // Support both old (string) and new (object) template formats
    const text = typeof tpl === 'string' ? tpl : tpl.text;
    return fixSentenceCase(fillTemplate(text, tone || null));
  }

  return { init, generateStory };
})();
