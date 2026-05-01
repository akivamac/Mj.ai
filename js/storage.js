const Storage = (() => {
  const PREFIX  = 'mj_';
  const LS      = localStorage;

  // ── Brain (always localStorage — loaded from JSON files) ──
  function getBrain(key)       { const r = LS.getItem(PREFIX+'brain_'+key); if (r) try { return JSON.parse(r); } catch(_) {} return null; }
  function setBrain(key, data) { LS.setItem(PREFIX+'brain_'+key, JSON.stringify(data)); }

  // ── Settings ───────────────────────────────────────────────
  function getMcpUrl()      { return LS.getItem(PREFIX+'mcp_url') || ''; }
  function setMcpUrl(v)     { LS.setItem(PREFIX+'mcp_url', v); }
  function getActiveChat()  { return LS.getItem(PREFIX+'active_chat') || null; }
  function setActiveChat(id){ if (id) LS.setItem(PREFIX+'active_chat', id); else LS.removeItem(PREFIX+'active_chat'); }

  // ── Chats — Backside-first, localStorage fallback ─────────

  // In-memory cache built on load
  let _chats    = null;
  let _chatNote = {}; // chatId → Backside note id

  async function loadChats() {
    if (Backside.available()) {
      try {
        const notes = await Backside.getNotes('monkey-joe-chat');
        _chats = notes.map(n => {
          const meta = n.metadata || {};
          let messages = [];
          try { messages = JSON.parse(n.body || '[]'); } catch(_) {}
          _chatNote[meta.chat_id || n.id] = n.id;
          return {
            id:        meta.chat_id || n.id,
            title:     n.title || 'Chat',
            messages,
            projectId: meta.project_id || null,
            starred:   meta.starred    || false,
            hidden:    meta.hidden     || false,
            _noteId:   n.id
          };
        });
        // Cache locally too
        LS.setItem(PREFIX+'chats', JSON.stringify(_chats));
        return _chats;
      } catch(e) {
        console.warn('Backside loadChats failed, using localStorage:', e);
      }
    }
    // Fallback
    const raw = LS.getItem(PREFIX+'chats');
    _chats = raw ? JSON.parse(raw) : [];
    return _chats;
  }

  function getChats() {
    if (_chats !== null) return _chats;
    const raw = LS.getItem(PREFIX+'chats');
    _chats = raw ? JSON.parse(raw) : [];
    return _chats;
  }

  async function saveChat(chat) {
    // Update in-memory
    if (_chats) {
      const idx = _chats.findIndex(c => c.id === chat.id);
      if (idx >= 0) _chats[idx] = chat; else _chats.unshift(chat);
    }
    // Always save to localStorage
    LS.setItem(PREFIX+'chats', JSON.stringify(_chats || [chat]));

    if (!Backside.available()) return;
    try {
      const body = JSON.stringify(chat.messages || []);
      const meta = { chat_id: chat.id, project_id: chat.projectId || null, starred: !!chat.starred, hidden: !!chat.hidden };
      if (_chatNote[chat.id]) {
        await Backside.updateNote(_chatNote[chat.id], body, chat.title, meta);
      } else {
        const note = await Backside.createNote(chat.title || 'Chat', body, ['monkey-joe-chat'], meta);
        _chatNote[chat.id] = note.id;
        chat._noteId = note.id;
      }
    } catch(e) { console.warn('Backside saveChat failed:', e); }
  }

  async function saveChats(chats) {
    _chats = chats;
    LS.setItem(PREFIX+'chats', JSON.stringify(chats));
    if (!Backside.available()) return;
    // Save each chat individually
    for (const chat of chats) { await saveChat(chat); }
  }

  async function deleteChat(chatId) {
    if (_chats) _chats = _chats.filter(c => c.id !== chatId);
    LS.setItem(PREFIX+'chats', JSON.stringify(_chats || []));
    if (Backside.available() && _chatNote[chatId]) {
      try { await Backside.deleteNote(_chatNote[chatId]); delete _chatNote[chatId]; } catch(e) {}
    }
  }

  // ── Projects — Backside Notebooks ─────────────────────────

  let _projects    = null;
  let _projNotebook = {}; // projectId → notebook id

  async function loadProjects() {
    if (Backside.available()) {
      try {
        const notebooks = await Backside.getNotebooks();
        // Filter to only Monkey Joe notebooks (prefixed)
        const mj = notebooks.filter(n => n.name && n.name.startsWith('mj:'));
        _projects = mj.map(n => {
          const id = 'p_' + n.id;
          _projNotebook[id] = n.id;
          return { id, name: n.name.slice(3), collapsed: false, _notebookId: n.id };
        });
        LS.setItem(PREFIX+'projects', JSON.stringify(_projects));
        return _projects;
      } catch(e) {
        console.warn('Backside loadProjects failed, using localStorage:', e);
      }
    }
    const raw = LS.getItem(PREFIX+'projects');
    _projects = raw ? JSON.parse(raw) : [];
    return _projects;
  }

  function getProjects() {
    if (_projects !== null) return _projects;
    const raw = LS.getItem(PREFIX+'projects');
    _projects = raw ? JSON.parse(raw) : [];
    return _projects;
  }

  async function saveProjects(projects) {
    _projects = projects;
    LS.setItem(PREFIX+'projects', JSON.stringify(projects));
    if (!Backside.available()) return;
    try {
      for (const proj of projects) {
        if (_projNotebook[proj.id]) {
          await Backside.updateNotebook(_projNotebook[proj.id], 'mj:' + proj.name);
        } else {
          const nb = await Backside.createNotebook('mj:' + proj.name);
          _projNotebook[proj.id] = nb.id;
        }
      }
    } catch(e) { console.warn('Backside saveProjects failed:', e); }
  }

  async function deleteProject(projId) {
    if (_projects) _projects = _projects.filter(p => p.id !== projId);
    LS.setItem(PREFIX+'projects', JSON.stringify(_projects || []));
    if (Backside.available() && _projNotebook[projId]) {
      try { await Backside.deleteNotebook(_projNotebook[projId]); delete _projNotebook[projId]; } catch(e) {}
    }
  }

  return {
    getBrain, setBrain,
    getMcpUrl, setMcpUrl,
    getActiveChat, setActiveChat,
    loadChats, getChats, saveChat, saveChats, deleteChat,
    loadProjects, getProjects, saveProjects, deleteProject
  };
})();
