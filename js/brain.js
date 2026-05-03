const Brain = (() => {
  const BRAIN_VERSION = '18'; // bump when brain JSON files change

  let knowledge = null;
  let rules = null;
  let terminal = null;

  async function load() {
    // If version changed, clear cache and reload from JSON
    if (localStorage.getItem('mj_brain_version') !== BRAIN_VERSION) {
      localStorage.removeItem('mj_brain_knowledge');
      localStorage.removeItem('mj_brain_rules');
      localStorage.removeItem('mj_brain_terminal');
      localStorage.setItem('mj_brain_version', BRAIN_VERSION);
    }

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

  function respond(input, history = []) {
    const lower = input.toLowerCase().trim();

    // Edit intent — check if user is referring to a previously created file
    const editTriggers = ['edit it','edit that','edit the file','change it','update it','update the file','modify it','modify the file','add to it','add to the file','rename it','rename the file','fix it','fix the file'];
    // "Yes" context — if Joe just offered to search, treat as search confirmation
    if (/^(yes|yeah|sure|ok|okay|yep|yup|do it|go ahead)[\s!.]*$/.test(lower)) {
      const lastJoe = [...history].reverse().find(m => m.role === 'joe');
      if (lastJoe && lastJoe.content && lastJoe.content.includes('search the web for it')) {
        // Find the topic from earlier in conversation
        const lastUser = [...history].reverse().find(m => m.role === 'user' && m.content !== input);
        if (lastUser) return '__SEARCH__:' + lastUser.content;
      }
    }

    // Find last file in history (used for edit intent)
    const lastFileMsg = [...history].reverse().find(m => m.role === 'joe' && m.isHTML && m.content && m.content.includes('Files.view'));
    const hasRecentFile = !!lastFileMsg;

    const explicitEditTriggers = ['edit it','edit that','edit the file','change it','update it','update the file','modify it','modify the file','add to it','add to the file','rename it','rename the file','fix it','fix the file'];
    const contextEditTriggers = ['change the','add the','add a','remove the','rename to','make it','make the','set the','update the'];
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
    const isFileReq = /^(make|create|write|generate|build)\s/.test(lower) && fileTypes.some(t => lower.includes(t));
    if (isFileReq) return '__FILE__:' + input;

        // Just "search the web" with no query
    if (/^s[ea]rch(\s+the\s+web)?!?$/.test(lower)) {
      return "Sure! What do you want me to search for?";
    }

    // Greeting check — only if short message (not combined with a question)
    if (rules && rules.greetings && lower.length < 30 && !lower.includes('?') && !lower.includes('who') && !lower.includes('what') && !lower.includes('how')) {
      for (const g of rules.greetings) {
        if (g.if.some(w => lower === w || lower.startsWith(w + ' ') || lower.startsWith(w + '!') || lower.startsWith(w + ','))) {
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

    // Rules check (before terminal so "what are cats" doesn't hit `cat` command)
    if (rules && rules.rules) {
      for (const rule of rules.rules) {
        if (rule.if && lower.includes(rule.if.toLowerCase())) {
          return rule.then;
        }
      }
    }

    // Identity shortcut — catch before search triggers
    if (lower.includes('who are you') || lower.includes('what are you') || lower === 'who r u') {
      return "I'm Monkey Joe 🐒 — a rules-based assistant built by Akiva with Claude's help. My brain lives in a GitHub repo and grows over time!";
    }

    // Terminal/command check — only if input looks like a command (starts with trigger or is short)
    if (terminal && terminal.commands) {
      for (const entry of terminal.commands) {
        if (entry.triggers && entry.triggers.some(t => {
          return lower === t || lower.startsWith(t + ' ') || lower.startsWith(t + ':') || /^(run|execute|use|type)\s/.test(lower) && lower.includes(t);
        })) {
          return entry.response;
        }
      }
    }

    // Knowledge check — prefer most-specific match (most keywords hit)
    if (knowledge && knowledge.facts) {
      let bestFact = null, bestScore = 0;
      for (const fact of knowledge.facts) {
        if (!fact.keywords) continue;
        const score = fact.keywords.reduce((n, k) => { const kl = k.toLowerCase(); const esc = kl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = /^[a-z0-9 ]+$/.test(kl) ? new RegExp('\\b' + esc + '\\b') : new RegExp(esc); return n + (re.test(lower) ? 1 : 0); }, 0);
        if (score > bestScore) { bestScore = score; bestFact = fact; }
      }
      if (bestFact) return bestFact.answer;
    }

    // Search detection
    if (needsSearch(lower)) {
      return '__SEARCH__:' + input.replace(/^(find a link to|find me|find a|find|look up|show me|get me|can you find|s[ea]rch for|s[ea]rch the web for)\s+/i, '');
    }

    return "Hmm, I don't know that one yet 🐒 Try asking me to search the web for it, or ask Akiva to add it to my brain!";
  }

  function detectEmotion(lower, original) {
    if (!rules || !rules.emotions) return null;
    let best = null, bestScore = 0;
    for (const [emotion, data] of Object.entries(rules.emotions)) {
      const score = data.signals.filter(s => original.includes(s) || lower.includes(s.toLowerCase())).length;
      if (score > bestScore) { bestScore = score; best = emotion; }
    }
    return bestScore > 0 ? best : null;
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
    if (questionTriggers.some(t => input.includes(t))) return true;

    const actionTriggers = [
      'look up', 'search for', 'search the web for', 'serch for',
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
