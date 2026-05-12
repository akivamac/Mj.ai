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

  function pickWord(slot) {
    if (!dictionary || !dictionary.words) return '[?]';
    const parts = slot.split(':');
    const wantPos = posMap[parts[0]] || parts[0].toLowerCase();
    const theme   = parts[1] || null;

    const candidates = dictionary.words.filter(w => {
      if (w.pos !== wantPos) return false;
      if (theme && (!w.themes || !w.themes.includes(theme))) return false;
      return true;
    });
    if (!candidates.length) return '[' + slot + '?]';
    return pick(candidates).word;
  }

  // Fill one template. Nouns with identical slot strings bind to the same word
  // (so a character/place stays consistent through the story). Other parts of
  // speech (adjectives, verbs, adverbs, connectors) pick freshly each time so
  // the language doesn't feel mechanical.
  function fillTemplate(template) {
    const nounBindings = {};
    return template.replace(/\{([^}]+)\}/g, (match, slot) => {
      const isNoun = slot.startsWith('NOUN');
      if (isNoun && nounBindings[slot]) return nounBindings[slot];
      const word = pickWord(slot);
      if (isNoun) nounBindings[slot] = word;
      return word;
    });
  }

  // Capitalize the first letter of every sentence (handles slots like {ADV}
  // that land at sentence start with a lowercase word).
  function fixSentenceCase(s) {
    return s.replace(/(^|[.!?]\s+|"\s*)([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase());
  }

  function generateStory() {
    if (!templates || !templates.stories || !templates.stories.length) {
      return "I want to tell stories, but my story-brain isn't loaded yet! 🐒";
    }
    if (!dictionary || !dictionary.words || !dictionary.words.length) {
      return "I want to tell stories, but my word-brain isn't loaded yet! 🐒";
    }
    const template = pick(templates.stories);
    return fixSentenceCase(fillTemplate(template));
  }

  return { init, generateStory };
})();
