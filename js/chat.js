const Chat = (() => {
  let chats = [];
  let projects = [];
  let activeId = null;
  let activeProjectId = null; // project scope for new chats

  function init() {
    chats    = Storage.getChats();
    projects = Storage.getProjects();
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
    Storage.saveChats(chats);
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
      if (proj) title = proj.name + ' › ' + title;
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
    Storage.saveChats(chats);
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
    document.getElementById('messages').appendChild(el);
  }

  // ── Sidebar ───────────────────────────────────────────────
  function renderSidebar() {
    const list = document.getElementById('chat-list');
    list.innerHTML = '';

    // New Project button
    const newProjBtn = document.createElement('button');
    newProjBtn.className = 'new-project-btn';
    newProjBtn.textContent = '+ New Project';
    newProjBtn.addEventListener('click', createProject);
    list.appendChild(newProjBtn);

    // Projects
    projects.forEach(proj => renderProject(proj, list));

    // Divider if there are both projects and loose chats
    const looseChats = chats.filter(c => !c.hidden && !c.projectId);
    if (projects.length && looseChats.length) {
      const div = document.createElement('div');
      div.className = 'sidebar-divider';
      list.appendChild(div);
    }

    // Starred chats (no project) first
    const starred   = looseChats.filter(c => c.starred);
    const unstarred = looseChats.filter(c => !c.starred);
    [...starred, ...unstarred].forEach(c => list.appendChild(makeChatItem(c)));
  }

  function renderProject(proj, container) {
    const wrap = document.createElement('div');
    wrap.className = 'project-wrap';

    const header = document.createElement('div');
    header.className = 'project-header' + (proj.collapsed ? ' collapsed' : '');
    header.innerHTML = `
      <span class="project-arrow">${proj.collapsed ? '▶' : '▼'}</span>
      <span class="project-name">${proj.name}</span>
      <button class="chat-menu-btn proj-menu-btn" data-pid="${proj.id}">⋮</button>
    `;
    header.querySelector('.project-name').addEventListener('click', () => toggleProject(proj.id));
    header.querySelector('.project-arrow').addEventListener('click', () => toggleProject(proj.id));
    header.querySelector('.proj-menu-btn').addEventListener('click', e => {
      e.stopPropagation();
      openProjectMenu(proj.id, e.target);
    });

    wrap.appendChild(header);

    if (!proj.collapsed) {
      const projChats = chats.filter(c => !c.hidden && c.projectId === proj.id);
      projChats.forEach(c => wrap.appendChild(makeChatItem(c, true)));

      const addBtn = document.createElement('button');
      addBtn.className = 'project-new-chat-btn';
      addBtn.textContent = '+ New chat';
      addBtn.addEventListener('click', () => { activeProjectId = proj.id; newChat(proj.id); });
      wrap.appendChild(addBtn);
    }

    container.appendChild(wrap);
  }

  function makeChatItem(chat, inProject = false) {
    const item = document.createElement('div');
    item.className = 'chat-item' + (chat.id === activeId ? ' active' : '') + (inProject ? ' in-project' : '');
    item.innerHTML = `
      <span class="chat-item-title">${chat.starred && !inProject ? '⭐ ' : ''}${chat.title}</span>
      <button class="chat-menu-btn" data-id="${chat.id}">⋮</button>
    `;
    item.querySelector('.chat-item-title').addEventListener('click', () => switchChat(chat.id));
    item.querySelector('.chat-menu-btn').addEventListener('click', e => {
      e.stopPropagation();
      openChatMenu(chat.id, e.target);
    });
    return item;
  }

  // ── Project actions ───────────────────────────────────────
  function createProject() {
    const name = prompt('Project name:');
    if (!name || !name.trim()) return;
    const proj = { id: 'p' + Date.now(), name: name.trim(), collapsed: false };
    projects.push(proj);
    Storage.saveProjects(projects);
    renderSidebar();
  }

  function toggleProject(id) {
    const proj = projects.find(p => p.id === id);
    if (proj) { proj.collapsed = !proj.collapsed; Storage.saveProjects(projects); renderSidebar(); }
  }

  function openProjectMenu(id, anchor) {
    closeAllMenus();
    const menu = document.createElement('div');
    menu.className = 'chat-menu-dropdown';
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
    anchor.parentElement.appendChild(menu);
    setTimeout(() => document.addEventListener('click', closeAllMenus, { once: true }), 0);
  }

  function handleProjectAction(id, action) {
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
    if (action === 'rename-proj') {
      const name = prompt('Rename project:', proj.name);
      if (name && name.trim()) proj.name = name.trim();
      Storage.saveProjects(projects);
    } else if (action === 'delete-proj') {
      if (!confirm('Delete project "' + proj.name + '"? Chats will move to main list.')) return;
      chats.forEach(c => { if (c.projectId === id) c.projectId = null; });
      projects = projects.filter(p => p.id !== id);
      Storage.saveProjects(projects);
      Storage.saveChats(chats);
    }
    renderSidebar();
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
    Storage.saveChats(chats);
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
    el.innerHTML = '<div class="avatar">🐒</div><div class="bubble typing"><span></span><span></span><span></span></div>';
    document.getElementById('messages').appendChild(el);
    scrollBottom();
  }

  function removeTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  // ── Process response ──────────────────────────────────────
  async function processResponse(input) {
    showTyping();
    await new Promise(r => setTimeout(r, 400));
    removeTyping();
    const raw = Brain.respond(input);
    if (raw && raw.startsWith('__SEARCH__:')) {
      const query = raw.slice(11);
      const result = await Search.ask(query);
      addMessage('joe', result === null ? "Okay, I won't search for that." : result);
    } else {
      addMessage('joe', raw);
    }
  }

  // ── Hidden chats (for settings) ───────────────────────────
  function getHiddenChats() { return chats.filter(c => c.hidden); }
  function restoreChat(id) {
    const chat = chats.find(c => c.id === id);
    if (chat) { chat.hidden = false; Storage.saveChats(chats); }
  }

  return { init, newChat, addMessage, processResponse, getHiddenChats, restoreChat };
})();
