const Generator = (() => {
  let templates = null;
  let dictionary = null;
  let beats = null;

  // Per-slot recent-word tracking. Same slot key (pos+theme) avoids repeating
  // recent picks; the cap stops it from "forgetting" too slowly.
  const recentWords = {};
  const RECENT_LIMIT = 30;

  function init(t, d, b) {
    templates = t;
    dictionary = d;
    beats = b || null;
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

  function factSnippet(answer) {
    if (!answer) return '';
    const m = answer.match(/^[^.!?]+[.!?]/);
    if (m) return m[0].trim();
    return (answer.length > 180 ? answer.slice(0, 180).trim() + '...' : answer.trim());
  }

  // Fill a single template + return what nouns bound to (so callers can
  // persist them across turns for continuation mode).
  function fillTemplate(text, opts) {
    const bindings = {};
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
    return pick(pool).text;
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

    let current = pick(matchTone(byType('opening')));
    if (!current) return generateStory({ ...opts, mode: 'regular' });

    const visited = new Set();
    const chain = [];
    const targetLen = 4 + Math.floor(Math.random() * 3); // 4–6 beats

    for (let i = 0; i < targetLen + 2; i++) {
      chain.push(current);
      visited.add(current.id);
      if (current.type === 'closing') break;
      if (!current.next_beats || !current.next_beats.length) break;

      let cands = current.next_beats.map(id => byId[id]).filter(Boolean);
      if (!cands.length) break;

      // After 3 hops, bias toward resolution / closing so chains end well.
      if (i >= 3) {
        const endish = cands.filter(b => b.type === 'closing' || b.type === 'resolution');
        if (endish.length) cands = endish;
      }
      // Prefer same-tone candidates.
      cands = matchTone(cands);
      // Prefer not-yet-visited to avoid loops.
      const unvisited = cands.filter(b => !visited.has(b.id));
      if (unvisited.length) cands = unvisited;
      current = pick(cands);
    }

    // Force a closing if we ran out of hops without hitting one.
    if (chain[chain.length - 1].type !== 'closing') {
      const closings = matchTone(byType('closing'));
      if (closings.length) chain.push(pick(closings));
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

  return { init, generateStory };
})();
