const Brain = (() => {
  let knowledge = null;
  let rules = null;
  let terminal = null;

  async function load() {
    // Load from localStorage first, fall back to repo JSON
    knowledge = Storage.getBrain('knowledge');
    rules     = Storage.getBrain('rules');
    terminal  = Storage.getBrain('terminal');

    if (!knowledge) {
      knowledge = await fetchJSON('brain/knowledge.json');
      Storage.setBrain('knowledge', knowledge);
    }
    if (!rules) {
      rules = await fetchJSON('brain/rules.json');
      Storage.setBrain('rules', rules);
    }
    if (!terminal) {
      terminal = await fetchJSON('brain/terminal.json');
      Storage.setBrain('terminal', terminal);
    }
  }

  async function fetchJSON(path) {
    try {
      const r = await fetch(path);
      return await r.json();
    } catch(_) { return {}; }
  }

  function respond(input) {
    const lower = input.toLowerCase().trim();

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

    // Search suggestion
    if (needsSearch(lower)) {
      return '__SEARCH__:' + input;
    }

    return "I'm not sure about that yet. My brain is still growing! You could ask me to search the web.";
  }

  function needsSearch(input) {
    const searchWords = ['what is', 'who is', 'when did', 'how do', 'why does', 'where is', 'news', 'latest', 'current'];
    return searchWords.some(w => input.includes(w));
  }

  return { load, respond };
})();
