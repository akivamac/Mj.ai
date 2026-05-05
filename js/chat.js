const Chat = (() => {
  let chats = [];
  let projects = [];
  let activeId = null;
  let activeProjectId = null; // project scope for new chats

  async function init() {
    [chats, projects] = await Promise.all([Storage.loadChats(), Storage.loadProjects()]);
    activeId = Storage.getActiveChat();
    if (!activeId || !chats.find(c => c.id === activeId)) newChat();
    else { renderSidebar(); loadActiveMessages(); }
  }

  // ── New chat ──────────────────────────────────────────────
  function newChat(projectId) {
    const id   = 'c' + Date.now();
    const chat = { id, title: 'New Chat', messages: [], projectId: projectId || activeProjectId || null };
    chats.unshift(chat);
    activeId = id;
    Storage.saveChat(chat);
    Storage.setActiveChat(id);
    renderSidebar();
    clearMessages();
  }

  function getActive() { return chats.find(c => c.id === activeId); }

  function clearMessages() {
    document.getElementById('messages').innerHTML = '';
    const chat = getActive();
    let title = chat?.title || 'New Chat';
    if (chat?.projectId) {
      const proj = projects.find(p => p.id === chat.projectId);
      if (proj) {
        const el = document.getElementById('chat-title');
        el.innerHTML = `<span class="breadcrumb-project" data-pid="${proj.id}">${proj.name}</span><span class="breadcrumb-sep">›</span>${title}`;
        el.querySelector('.breadcrumb-project').addEventListener('click', () => openProjectPage(proj.id));
        return;
      }
    }
    document.getElementById('chat-title').textContent = title;
  }

  function loadActiveMessages() {
    clearMessages();
    getActive()?.messages.forEach(renderMessage);
    scrollBottom();
  }

  // ── Messages ──────────────────────────────────────────────
  function addMessage(role, content, isHTML = false) {
    const chat = getActive();
    if (!chat) return;
    const msg = { role, content, isHTML, ts: Date.now() };
    chat.messages.push(msg);
    if (role === 'user' && chat.messages.filter(m => m.role === 'user').length === 1) {
      chat.title = content.replace(/<[^>]+>/g, '').slice(0, 40) || 'New Chat';
      document.getElementById('chat-title').textContent = chat.title;
      renderSidebar();
    }
    chat.updatedAt = Date.now(); Storage.saveChat(chat);
    renderMessage(msg);
    scrollBottom();
  }

  function renderMessage(msg) {
    const el = document.createElement('div');
    el.className = 'message ' + msg.role;
    const avatar = msg.role === 'user' ? '🧑' : '🐒';
    el.innerHTML = `<div class="avatar">${avatar}</div><div class="bubble"></div>`;
    const bubble = el.querySelector('.bubble');
    if (msg.isHTML) bubble.innerHTML = msg.content;
    else bubble.textContent = msg.content;
    if (msg.role === 'joe') {
      const btn = document.createElement('button');
      btn.textContent = '🔊';
      btn.title = 'Read aloud';
      btn.className = 'speak-btn';
      btn.onclick = () => {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(msg.content);
        u.rate = 0.95;
        window.speechSynthesis.speak(u);
      };
      bubble.appendChild(btn);
    }
    document.getElementById('messages').appendChild(el);
  }

  // ── Panel visibility ─────────────────────────────────────
  function showPanel(name) { // 'chat' | 'projects' | 'project'
    document.getElementById('main').classList.toggle('hidden', name !== 'chat');
    document.getElementById('projects-panel').classList.toggle('hidden', name !== 'projects');
    document.getElementById('project-page').classList.toggle('hidden', name !== 'project');
    document.getElementById('nav-projects-btn').classList.toggle('active', name === 'projects' || name === 'project');
  }

  // ── Sidebar ───────────────────────────────────────────────
  function renderSidebar() {
    const list = document.getElementById('chat-list');
    list.innerHTML = '';

    // Loose chats only in sidebar
    const looseChats = chats.filter(c => !c.hidden && !c.projectId);
    const starred   = looseChats.filter(c => c.starred);
    const unstarred = looseChats.filter(c => !c.starred);
    if (looseChats.length) {
      const div = document.createElement('div');
      div.className = 'sidebar-divider';
      div.style.margin = '4px 12px';
      list.appendChild(div);
    }
    [...starred, ...unstarred].forEach(c => list.appendChild(makeChatItem(c)));
  }

  function makeChatItem(chat, inProject = false) {
    const item = document.createElement('div');
    item.className = 'chat-item' + (chat.id === activeId ? ' active' : '');
    item.innerHTML = `
      <span class="chat-item-title">${chat.starred ? "⭐ " : ""}${chat.title || "New Chat"}</span>
      <button class="chat-menu-btn" data-id="${chat.id}">⋮</button>
    `;
    item.querySelector('.chat-item-title').addEventListener('click', () => switchChat(chat.id));
    item.querySelector('.chat-menu-btn').addEventListener('click', e => {
      e.stopPropagation();
      openChatMenu(chat.id, e.target);
    });
    return item;
  }

  // ── Projects panel ────────────────────────────────────────
  function renderProjectsPanel() {
    const grid = document.getElementById('projects-grid');
    grid.innerHTML = '';
    projects.forEach(proj => {
      const projChats = chats.filter(c => !c.hidden && c.projectId === proj.id);
      const lastUpdated = projChats.length
        ? (() => {
            const t = Math.max(...projChats.map(c => c.updatedAt || 0));
            if (!t) return 'No chats yet';
            const ago = Date.now() - t;
            if (ago < 60000) return 'Just now';
            if (ago < 3600000) return Math.floor(ago/60000) + ' min ago';
            if (ago < 86400000) return Math.floor(ago/3600000) + ' hr ago';
            return Math.floor(ago/86400000) + ' days ago';
          })()
        : 'No chats yet';
      const card = document.createElement('div');
      card.className = 'project-card';
      card.innerHTML = `
        <button class="project-card-menu" data-pid="${proj.id}">⋯</button>
        <div class="project-card-name">${proj.name}</div>
        <div class="project-card-meta">Updated ${lastUpdated}</div>
      `;
      card.addEventListener('click', e => {
        if (e.target.classList.contains('project-card-menu')) return;
        openProjectPage(proj.id);
      });
      card.querySelector('.project-card-menu').addEventListener('click', e => {
        e.stopPropagation();
        openProjectMenu(proj.id, e.target);
      });
      grid.appendChild(card);
    });
    if (!projects.length) {
      grid.innerHTML = '<div style="color:var(--text-muted);font-size:0.88rem;padding:8px 0;">No projects yet. Create one to get started!</div>';
    }
    showPanel('projects');
  }

  // ── Project page ──────────────────────────────────────────
  function openProjectPage(projId) {
    const proj = projects.find(p => p.id === projId);
    if (!proj) return;
    activeProjectId = projId;
    document.getElementById('project-page-name').textContent = proj.name;
    const list = document.getElementById('project-chat-list');
    list.innerHTML = '';

    // New chat button at top
    const newBtn = document.createElement('button');
    newBtn.className = 'project-new-chat-card';
    newBtn.textContent = '+ New chat';
    newBtn.addEventListener('click', () => { newChat(projId); showPanel('chat'); });
    list.appendChild(newBtn);

    const projChats = chats.filter(c => !c.hidden && c.projectId === projId);
    projChats.forEach(c => {
      const item = document.createElement('div');
      item.className = 'project-chat-item';
      const ago = c.updatedAt ? (() => {
        const d = Date.now() - c.updatedAt;
        if (d < 60000) return 'Just now';
        if (d < 3600000) return Math.floor(d/60000) + ' min ago';
        if (d < 86400000) return Math.floor(d/3600000) + ' hr ago';
        return Math.floor(d/86400000) + ' days ago';
      })() : '';
      item.innerHTML = `<div class="project-chat-item-title">${c.title}</div>${ago ? `<div class="project-chat-item-meta">Last message ${ago}</div>` : ''}`;
      item.addEventListener('click', () => { switchChat(c.id); showPanel('chat'); });
      list.appendChild(item);
    });
    showPanel('project');
  }

  // ── Project actions ───────────────────────────────────────
  function createProject() {
    const name = prompt('Project name:');
    if (!name || !name.trim()) return;
    const proj = { id: 'p' + Date.now(), name: name.trim() };
    projects.push(proj);
    Storage.saveProjects(projects);
    renderProjectsPanel();
  }

  function openProjectMenu(id, anchor) {
    closeAllMenus();
    const menu = document.createElement('div');
    menu.className = 'chat-menu-dropdown';
    menu.style.cssText = 'position:absolute;right:0;top:100%;z-index:300;';
    menu.innerHTML = `
      <div class="menu-item" data-action="rename-proj">Rename</div>
      <div class="menu-item" data-action="delete-proj" style="color:#c0392b">Delete project</div>
    `;
    menu.querySelectorAll('.menu-item').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        handleProjectAction(id, el.dataset.action);
        closeAllMenus();
      });
    });
    anchor.parentElement.style.position = 'relative';
    anchor.parentElement.appendChild(menu);
    setTimeout(() => document.addEventListener('click', closeAllMenus, { once: true }), 0);
  }

  function handleProjectAction(id, action) {
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
    if (action === 'rename-proj') {
      const name = prompt('Rename project:', proj.name);
      if (name && name.trim()) { proj.name = name.trim(); Storage.saveProjects(projects); }
    } else if (action === 'delete-proj') {
      if (!confirm('Delete project "' + proj.name + '"? Chats will move to main list.')) return;
      chats.forEach(c => { if (c.projectId === id) { c.projectId = null; Storage.saveChat(c); } });
      projects = projects.filter(p => p.id !== id);
      Storage.deleteProject(id);
    }
    renderSidebar();
    renderProjectsPanel();
  }

  // ── Chat menu ─────────────────────────────────────────────
  function openChatMenu(id, anchor) {
    closeAllMenus();
    const chat = chats.find(c => c.id === id);
    const inProject = !!chat.projectId;
    let projectItems = '';
    if (inProject) {
      projectItems = `<div class="menu-item" data-action="remove-proj">Remove from project</div>`;
    } else if (projects.length) {
      projectItems = `<div class="menu-item" data-action="add-proj">Add to project…</div>`;
    }
    const menu = document.createElement('div');
    menu.className = 'chat-menu-dropdown';
    menu.innerHTML = `
      <div class="menu-item" data-action="rename">Rename</div>
      <div class="menu-item" data-action="star">${chat.starred ? 'Unstar' : 'Star ⭐'}</div>
      ${projectItems}
      <div class="menu-item" data-action="hide">Hide</div>
      <div class="menu-item" data-action="delete" style="color:#c0392b">Delete</div>
    `;
    menu.querySelectorAll('.menu-item').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        handleMenuAction(id, el.dataset.action);
        closeAllMenus();
      });
    });
    anchor.parentElement.appendChild(menu);
    setTimeout(() => document.addEventListener('click', closeAllMenus, { once: true }), 0);
  }

  function handleMenuAction(id, action) {
    const chat = chats.find(c => c.id === id);
    if (!chat) return;
    if (action === 'rename') {
      const name = prompt('Rename chat:', chat.title);
      if (name && name.trim()) { chat.title = name.trim(); document.getElementById('chat-title').textContent = chat.title; }
    } else if (action === 'star') {
      chat.starred = !chat.starred;
    } else if (action === 'hide') {
      chat.hidden = true;
      if (chat.id === activeId) newChat();
    } else if (action === 'delete') {
      if (!confirm('Delete this chat?')) return;
      chats = chats.filter(c => c.id !== id);
      Storage.deleteChat(id);
      if (id === activeId) newChat();
    } else if (action === 'add-proj') {
      if (!projects.length) return;
      const names = projects.map((p, i) => i + 1 + '. ' + p.name).join('\n');
      const choice = prompt('Add to which project?\n' + names + '\n\nEnter number:');
      const idx = parseInt(choice) - 1;
      if (idx >= 0 && idx < projects.length) chat.projectId = projects[idx].id;
    } else if (action === 'remove-proj') {
      chat.projectId = null;
    }
    Storage.saveChat(chats.find(c => c.id === id) || {});
    renderSidebar();
  }

  function closeAllMenus() {
    document.querySelectorAll('.chat-menu-dropdown').forEach(m => m.remove());
  }

  // ── Switch chat ───────────────────────────────────────────
  function switchChat(id) {
    activeId = id;
    Storage.setActiveChat(id);
    loadActiveMessages();
    renderSidebar();
  }

  function scrollBottom() {
    const msgs = document.getElementById('messages');
    msgs.scrollTop = msgs.scrollHeight;
  }

  // ── Typing indicator ──────────────────────────────────────
  function showTyping() {
    const el = document.createElement('div');
    el.className = 'message joe';
    el.id = 'typing-indicator';
    el.innerHTML = '<div class="avatar">🐒</div><div class="bubble typing-joe"><span class="typing-emoji">🐒</span><span class="typing-label">joeing...</span></div>';
    document.getElementById('messages').appendChild(el);
    const emojis = ['🐒','🦍','🦧'];
    let i = 0;
    el._interval = setInterval(() => {
      i = (i + 1) % emojis.length;
      const span = el.querySelector('.typing-emoji');
      if (span) span.textContent = emojis[i];
    }, 400);
    scrollBottom();
  }

  function removeTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) { clearInterval(el._interval); el.remove(); }
  }



  // ── Process response ──────────────────────────────────────
  async function processResponse(input) {
    showTyping();
    await new Promise(r => setTimeout(r, 400));
    removeTyping();
    try {
      const history = (getActive() ? getActive().messages : []).slice(-20);
      const raw = Brain.respond(input, history);
      if (raw && raw.startsWith('__EDIT__:')) {
        const colonIdx = raw.indexOf(':', 9);
        const fileId = raw.slice(8, colonIdx);
        const instruction = raw.slice(colonIdx + 1);
        const result = Files.edit(fileId, instruction);
        if (result.startsWith('__HTML__:')) addMessage('joe', result.slice(9), true);
        else addMessage('joe', result);
      } else if (raw && raw.startsWith('__FILE__:')) {
        const parsed = Files.parse(raw.slice(9));
        if (parsed) {
          const result = Files.create(parsed.type, parsed.name, parsed.desc || '');
          if (result.startsWith('__HTML__:')) addMessage('joe', result.slice(9), true);
          else addMessage('joe', result);
        } else {
          addMessage('joe', "I can make: html, css, js, ts, md, txt, json, py, sh, svg, csv files. Which type do you want?");
        }
      } else if (raw && raw.startsWith('__SEARCH__:')) {
        const query = raw.slice(11);
        const result = await Search.ask(query);
        addMessage('joe', result === null ? "Okay, I won't search for that." : result);
      } else if (raw && raw.startsWith('__PUSH__:')) {
        await handlePush(input);
      } else {
        addMessage('joe', raw);
      }
    } catch(err) {
      addMessage('joe', 'Error: ' + err.message);
    }
  }

  // ── GitHub push ──────────────────────────────────────────
  async function handlePush(input) {
    const lower = input.toLowerCase();

    // Find the most recent file card in active chat
    const active = getActive();
    const fileMsg = active && [...active.messages].reverse().find(m => m.isHTML && m.content && m.content.includes('Files.view'));

    if (!fileMsg) {
      addMessage('joe', "I don't see a file to push! Make a file first, then ask me to push it. 🐒");
      return;
    }

    const idMatch = fileMsg.content.match(/Files\.view\('([^']+)'\)/);
    if (!idMatch) { addMessage('joe', "Couldn't find the file ID. Try making the file again."); return; }

    const file = Files.getFile(idMatch[1]);
    if (!file) { addMessage('joe', "I lost the file content (page may have reloaded). Make it again and I'll push it!"); return; }

    // Parse custom commit message if given
    let commitMsg = null;
    const msgMatch = input.match(/(?:with message|commit message|message)[:\s]+["']?(.+?)["']?$/i);
    if (msgMatch) commitMsg = msgMatch[1].trim();

    addMessage('joe', `Pushing **${file.filename}** to GitHub… 🚀`);

    const result = await GitHub.pushFile(file.filename, file.content, commitMsg || `Add ${file.filename} via Monkey Joe`);

    if (result.ok) {
      addMessage('joe', `✅ **${file.filename}** pushed to GitHub! Changes will be live on GitHub Pages in ~1 minute. 🎉`);
    } else {
      addMessage('joe', `❌ Push failed: ${result.error}`);
    }
  }

  // ── Hidden chats (for settings) ───────────────────────────
  function getHiddenChats() { return chats.filter(c => c.hidden); }
  function restoreChat(id) {
    const chat = chats.find(c => c.id === id);
    if (chat) { chat.hidden = false; Storage.saveChats(chats); }
  }

  return { init, newChat, addMessage, processResponse, getHiddenChats, restoreChat, renderProjectsPanel, createProject, showPanel };
})();
