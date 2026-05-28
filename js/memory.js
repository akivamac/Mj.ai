// Mj.ai memory (v57). Two stores, one localStorage key:
//   facts — what the user explicitly told Joe ("remember that my cat is Felix")
//   usage — anonymous behavior counts (topic counts, tone preferences,
//           session timing, recent subjects). Never personal claims.
//
// The split is the whole point: implicit data is allowed because it never
// crosses into "facts about the user", only "facts about the conversation".
// Joe never says "I notice you like X" — only "we did X last time" or
// "you told me X".

const Memory = (() => {

  const KEY = 'mj_memory';
  const SCHEMA_VERSION = 1;
  const SESSION_GAP_MS = 30 * 60 * 1000;     // 30 min idle = new session
  const WELCOME_BACK_GAP_MS = 24 * 60 * 60 * 1000;
  const MAX_TOPIC_COUNTS = 80;
  const MAX_RECENT_SUBJECTS = 10;
  const TTL_DAYS = 365;                       // wipe if no activity for a year

  // Reject password/credit-card/address-shaped explicit facts.
  const PII_REJECT_RE = /\b(password|passcode|pin|ssn|social security|credit card|cvv|address)\b/i;

  let _data = null;
  let _saveTimer = null;

  function _empty() {
    return {
      v: SCHEMA_VERSION,
      facts: {},          // { slug: value }
      usage: {
        session_count: 0,
        first_session_at: null,
        last_session_at: null,
        last_save_at: null,
        topic_counts: {},
        tone_counts: {},
        dispatcher_counts: {},
        recent_subjects: [],
        last_story: null,
        welcome_hint_shown: false
      }
    };
  }

  function load() {
    if (_data) return _data;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.v === SCHEMA_VERSION) { _data = d; }
      }
    } catch (_) {}
    if (!_data) _data = _empty();
    // TTL — wipe if last save is older than TTL_DAYS.
    if (_data.usage.last_save_at) {
      const ageDays = (Date.now() - _data.usage.last_save_at) / 86400000;
      if (ageDays > TTL_DAYS) _data = _empty();
    }
    return _data;
  }

  function save() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      if (!_data) return;
      _data.usage.last_save_at = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify(_data)); } catch (_) {}
    }, 500);
  }

  function clear() {
    _data = _empty();
    try { localStorage.removeItem(KEY); } catch (_) {}
  }

  // ── usage tracking ────────────────────────────────────────

  function tickSession() {
    const d = load();
    const now = Date.now();
    if (!d.usage.first_session_at) d.usage.first_session_at = now;
    if (!d.usage.last_session_at
        || now - d.usage.last_session_at > SESSION_GAP_MS) {
      d.usage.session_count++;
    }
    d.usage.last_session_at = now;
    save();
  }

  function recordTopic(label) {
    if (!label) return;
    const d = load();
    const k = String(label).toLowerCase().slice(0, 40);
    d.usage.topic_counts[k] = (d.usage.topic_counts[k] || 0) + 1;
    // Cap each count and prune the map if it grows too big.
    if (d.usage.topic_counts[k] > 999) d.usage.topic_counts[k] = 999;
    const keys = Object.keys(d.usage.topic_counts);
    if (keys.length > MAX_TOPIC_COUNTS) {
      const sorted = keys.sort((a,b) => d.usage.topic_counts[b] - d.usage.topic_counts[a]);
      const out = {};
      for (const key of sorted.slice(0, MAX_TOPIC_COUNTS)) out[key] = d.usage.topic_counts[key];
      d.usage.topic_counts = out;
    }
    // Prepend to recent_subjects, dedupe, cap.
    d.usage.recent_subjects = [k, ...d.usage.recent_subjects.filter(x => x !== k)].slice(0, MAX_RECENT_SUBJECTS);
    save();
  }

  function recordTone(tone) {
    if (!tone) return;
    const d = load();
    d.usage.tone_counts[tone] = Math.min(999, (d.usage.tone_counts[tone] || 0) + 1);
    save();
  }

  function recordDispatcher(name) {
    if (!name) return;
    const d = load();
    d.usage.dispatcher_counts[name] = Math.min(999, (d.usage.dispatcher_counts[name] || 0) + 1);
    save();
  }

  function snapshotStory(s) {
    if (!s) return;
    const d = load();
    d.usage.last_story = {
      tone: s.tone || null,
      subject: s.subject || null,
      character: s.character || null,
      place: s.place || null,
      at: Date.now()
    };
    save();
  }

  // ── derived queries ──────────────────────────────────────

  function favoriteTone() {
    const d = load();
    const tc = d.usage.tone_counts;
    let best = null, bestCount = 0;
    for (const [t, c] of Object.entries(tc)) {
      if (c > bestCount) { best = t; bestCount = c; }
    }
    return bestCount >= 3 ? best : null;  // need a few data points
  }

  function topInterests(n = 3) {
    const d = load();
    return Object.entries(d.usage.topic_counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k]) => k);
  }

  function shouldWelcomeBack() {
    const d = load();
    return d.usage.session_count > 1
        && d.usage.last_session_at
        && (Date.now() - d.usage.last_session_at) > WELCOME_BACK_GAP_MS;
  }

  function formatWelcomeBack(userName) {
    const d = load();
    const name = userName ? ` ${userName}` : '';
    const subjects = d.usage.recent_subjects.slice(0, 2);
    let out = `Welcome back${name}! 🐒`;
    if (d.usage.last_story && d.usage.last_story.subject) {
      const s = d.usage.last_story;
      out += ` Last time we wove a ${s.tone || ''} tale about ${s.subject} — want another?`;
    } else if (subjects.length) {
      out += ` Last few things we talked about: ${subjects.join(', ')}.`;
    }
    if (!d.usage.welcome_hint_shown) {
      out += '\n\n(I remember some context from our chats — say "what do you remember" to see, or "forget everything" to clear.)';
      d.usage.welcome_hint_shown = true;
      save();
    }
    return out;
  }

  // ── facts (explicit) ─────────────────────────────────────

  function slugify(s) {
    return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  }

  function setFact(rawKey, value) {
    if (PII_REJECT_RE.test(rawKey + ' ' + value)) return { rejected: true };
    const d = load();
    const key = slugify(rawKey);
    if (!key) return { rejected: true };
    d.facts[key] = String(value).slice(0, 200);
    save();
    return { stored: true, key, value: d.facts[key] };
  }

  function getFact(rawKey) {
    const d = load();
    const key = slugify(rawKey);
    return d.facts[key] || null;
  }

  function forgetFact(rawKey) {
    const d = load();
    const key = slugify(rawKey);
    if (key in d.facts) {
      const v = d.facts[key];
      delete d.facts[key];
      save();
      return { removed: true, key, value: v };
    }
    return { removed: false, key };
  }

  function listFacts() {
    const d = load();
    return Object.entries(d.facts).map(([k, v]) => ({ key: k, value: v }));
  }

  // ── summary (for "what do you remember") ─────────────────

  function summary() {
    const d = load();
    const facts = listFacts();
    const topTopics = topInterests(5);
    const tone = favoriteTone();
    let out = '';
    if (facts.length) {
      out += "**What you've told me:**\n";
      for (const f of facts) {
        out += `• ${f.key.replace(/_/g, ' ')}: ${f.value}\n`;
      }
    } else {
      out += "_You haven't told me anything to remember yet._ Try `remember that my cat is Felix`.\n";
    }
    out += '\n**What I\'ve noticed:**\n';
    out += `• ${d.usage.session_count} session${d.usage.session_count === 1 ? '' : 's'} so far\n`;
    if (topTopics.length) out += `• Top topics: ${topTopics.join(', ')}\n`;
    if (tone) out += `• Favorite story tone: ${tone}\n`;
    out += '\n_Say `forget everything` to wipe all of this._';
    return out;
  }

  return {
    load, save, clear,
    tickSession, recordTopic, recordTone, recordDispatcher, snapshotStory,
    favoriteTone, topInterests, shouldWelcomeBack, formatWelcomeBack,
    setFact, getFact, forgetFact, listFacts, summary
  };
})();
