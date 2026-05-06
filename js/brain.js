const Brain = (() => {
  const BRAIN_VERSION = '29'; // bump when brain JSON files change

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

  // ── Context memory ────────────────────────────────────────
  let _lastTopicKeywords = [];
  let _lastTopicLabel    = '';
  let _lastFactAnswer    = '';

  function detectFollowUp(lower) {
    const pronounTriggers = ['they ','their ','them ','it ','its ','the animal','the creature','those animals','that animal'];
    const starterTriggers = ['and ','also ','but what','what about ','how about ','tell me more','more about','what else','same with','what do they','how do they','where do they','can they','do they '];
    return pronounTriggers.some(w => lower.includes(w)) || starterTriggers.some(w => lower.startsWith(w));
  }

  function respond(input, history = []) {
    let lower = input.toLowerCase().trim();

    // Get user account name for personalization
    const account = JSON.parse(localStorage.getItem('mj_account') || 'null');
    const userName = account ? account.name : null;

    // Identity check — personalize before other logic
    if (/who am i|what is my name|do you know me/i.test(lower)) {
      if (userName) return `You're ${userName}! 👋`;
      return "I don't know your name yet — you might not be logged in with an account.";
    }

    // ── Follow-up context injection ──────────────────────────
    if (_lastTopicLabel && detectFollowUp(lower)) {
      // inject last topic so "what do they eat?" becomes "what do they eat elephant"
      lower = lower + ' ' + _lastTopicLabel;
    }

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
    const isFileReq = /^(make|create|write|generate|build)\s/.test(lower) && fileTypes.some(t => lower.includes(t));
    if (isFileReq) return '__FILE__:' + input;

    // GitHub push
    const isPushReq = /^(push|deploy|publish|send to github|push to github|update github|commit)/.test(lower);
    if (isPushReq) return '__PUSH__:' + input;

        // Just "search the web" with no query
    if (/^s[ea]rch(\s+the\s+web)?!?$/.test(lower)) {
      return "Sure! What do you want me to search for?";
    }

    // Greeting check — only if short message (not combined with a question)
    if (rules && rules.greetings && lower.length < 30 && !lower.includes('?') && !lower.includes('who') && !lower.includes('what') && !lower.includes('how')) {
      for (const g of rules.greetings) {
        if (g.if.some(w => lower === w || lower.startsWith(w + ' ') || lower.startsWith(w + '!') || lower.startsWith(w + ','))) {
          const greeting = pick(g.responses);
          // Personalize greeting with user's name if available
          if (userName && greeting.includes('Hi') && !greeting.includes(userName)) {
            return greeting.replace(/^Hi/, `Hi ${userName},`);
          }
          return greeting;
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

    // Name recognition — user addresses or asks about Joe by name
    if (lower.includes('monkey joe')) {
      if (rules && rules.greetings && /^(hi|hey|hello|howdy|hiya|yo|sup)/.test(lower)) {
        return pick(rules.greetings[0].responses);
      }
      return "That's me! 🐒 I'm Monkey Joe — a rules-based AI assistant made by Akiva. Ask me anything!";
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
        .replace(/izing$/, 'ize')
        .replace(/izes$/, 'ize').replace(/ised$/, 'ise')
        .replace(/izing$/, 'ize')
        .replace(/nesses$/, '').replace(/ness$/, '')
        .replace(/ments$/, '').replace(/ment$/, '')
        .replace(/ities$/, 'ity').replace(/ity$/, '')
        .replace(/ically$/, 'ic').replace(/ically$/, 'ic')
        .replace(/ical$/, 'ic')
        .replace(/ations$/, 'ate').replace(/ation$/, 'ate')
        .replace(/ators$/, 'ate').replace(/ator$/, 'ate')
        .replace(/ators$/, 'ate')
        .replace(/ings$/, '').replace(/ing$/, '')
        .replace(/edly$/, '').replace(/edly$/, '')
        .replace(/edly$/, '')
        .replace(/edly$/, '')
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
          // exact substring match (word-boundary aware)
          let exactMatch = false;
          try {
            const esc = kl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = /^[a-z0-9 ]+$/.test(kl) ? new RegExp('\b' + esc) : new RegExp(esc);
            exactMatch = re.test(q);
          } catch(e) { exactMatch = q.includes(kl); }
          if (exactMatch) { score += 2; continue; } // exact match worth 2
          // stem match
          if (kl.length > 4 && stemScore(kl, q)) { score += 1; continue; }
          // partial: does the query contain any word that starts with the keyword (or vice versa)?
          const kWords = kl.split(/\s+/);
          const qWords = q.split(/\s+/);
          if (kWords.some(kw => kw.length > 4 && qWords.some(qw => qw.startsWith(kw) || kw.startsWith(qw))) ) { score += 0.5; }
        }
        if (score > best) best = score;
      }
      return best;
    }

    // ── Context-aware follow-up handling ──────────────────────────
    // If this is a very short follow-up (under 4 words, no question words), append last topic
    function applyContextualFollowUp(q) {
      const wordCount = q.split(/\s+/).length;
      const hasQuestionWords = /^(what|who|how|why|where|when|is|are|do|does|can|could|would|should|will|did|was|were)/.test(q);
      if (wordCount <= 3 && !hasQuestionWords && _lastTopicLabel) {
        // Append last topic to boost relevance (e.g., "and size?" becomes "and size elephant")
        return q + ' ' + _lastTopicLabel;
      }
      return q;
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
      for (const fact of knowledge.facts) {
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
        return bestFact.answer;
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
