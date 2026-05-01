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

  function respond(input) {
    const lower = input.toLowerCase().trim();

    // If it's just "search the web" with no query, ask what to search
    if (/^search(\s+the\s+web)?!?$/.test(lower)) {
      return "Sure! What do you want me to search for?";
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

    // Search detection — broad set of triggers
    if (needsSearch(lower)) {
      return '__SEARCH__:' + input;
    }

    return "I'm not sure about that yet. My brain is still growing! Try asking me to search the web for it.";
  }

  function needsSearch(input) {
    const triggers = [
      'what is', 'what are', 'who is', 'who are',
      'when did', 'when was', 'when is',
      'how do', 'how does', 'how did', 'how to',
      'why does', 'why did', 'why is',
      'where is', 'where can', 'where do',
      'find', 'look up', 'search for', 'search the web for',
      'link to', 'photo of', 'picture of', 'image of',
      'show me', 'get me', 'can you find',
      'news', 'latest', 'current', 'today'
    ];
    return triggers.some(t => input.includes(t));
  }

  return { load, respond };
})();
