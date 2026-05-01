const Brain = (() => {
  let knowledge = null;
  let rules = null;
  let terminal = null;

  async function load() {
    knowledge = Storage.getBrain('knowledge');
    rules     = Storage.getBrain('rules');
    terminal  = Storage.getBrain('terminal');

    if (!knowledge) { knowledge = await fetchJSON('brain/knowledge.json'); Storage.setBrain('knowledge', knowledge); }
    if (!rules)     { rules     = await fetchJSON('brain/rules.json');     Storage.setBrain('rules', rules); }
    if (!terminal)  { terminal  = await fetchJSON('brain/terminal.json');  Storage.setBrain('terminal', terminal); }
  }

  async function fetchJSON(path) {
    try { const r = await fetch(path); return await r.json(); } catch(_) { return {}; }
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function respond(input) {
    const lower = input.toLowerCase().trim();

    // Just "search the web" with no query
    if (/^search(\s+the\s+web)?!?$/.test(lower)) {
      return "Sure! What do you want me to search for?";
    }

    // Greeting check
    if (rules && rules.greetings) {
      for (const g of rules.greetings) {
        if (g.if.some(w => lower === w || lower.startsWith(w + ' ') || lower.startsWith(w + '!'))) {
          return pick(g.responses);
        }
      }
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

    // Terminal/command check
    if (terminal && terminal.commands) {
      for (const entry of terminal.commands) {
        if (entry.triggers && entry.triggers.some(t => lower.includes(t))) {
          return entry.response;
        }
      }
    }

    // Rules check
    if (rules && rules.rules) {
      for (const rule of rules.rules) {
        if (rule.if && lower.includes(rule.if.toLowerCase())) {
          return rule.then;
        }
      }
    }

    // Knowledge check
    if (knowledge && knowledge.facts) {
      for (const fact of knowledge.facts) {
        if (fact.keywords && fact.keywords.some(k => lower.includes(k))) {
          return fact.answer;
        }
      }
    }

    // Search detection
    if (needsSearch(lower)) {
      return '__SEARCH__:' + input.replace(/^(find a link to|find me|find a|find|look up|show me|get me|can you find|search for|search the web for)\s+/i, '');
    }

    return "I'm not sure about that yet. My brain is still growing! Try asking me to search the web for it.";
  }

  function detectEmotion(lower, original) {
    if (!rules || !rules.emotions) return null;
    // Score each emotion by how many signals match
    let best = null, bestScore = 0;
    for (const [emotion, data] of Object.entries(rules.emotions)) {
      const score = data.signals.filter(s => original.includes(s) || lower.includes(s.toLowerCase())).length;
      if (score > bestScore) { bestScore = score; best = emotion; }
    }
    return bestScore > 0 ? best : null;
  }

  function needsSearch(input) {
    const questionTriggers = [
      'what is', 'what are', 'who is', 'who are',
      'when did', 'when was', 'when is',
      'how do', 'how does', 'how did', 'how to',
      'why does', 'why did', 'why is',
      'where is', 'where can', 'where do',
      'news about', 'latest on', 'current status'
    ];
    if (questionTriggers.some(t => input.includes(t))) return true;

    const actionTriggers = [
      'look up', 'search for', 'search the web for',
      'link to', 'photo of', 'picture of', 'image of',
      'show me', 'can you find', 'find me', 'find a link',
      'get me a link', 'find info'
    ];
    return actionTriggers.some(t => input.includes(t));
  }

  return { load, respond };
})();
