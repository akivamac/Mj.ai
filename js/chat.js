const Chat = (() => {
  let chats = [];
  let activeId = null;

  function init() {
    chats = Storage.getChats();
    activeId = Storage.getActiveChat();
    if (!activeId || !chats.find(c => c.id === activeId)) newChat();
    else renderChatList();
  }

  function newChat() {
    const id = 'c' + Date.now();
    const chat = { id, title: 'New Chat', messages: [] };
    chats.unshift(chat);
    activeId = id;
    Storage.saveChats(chats);
    Storage.setActiveChat(id);
    renderChatList();
    clearMessages();
  }

  function getActive() { return chats.find(c => c.id === activeId); }

  function clearMessages() {
    document.getElementById('messages').innerHTML = '';
    document.getElementById('chat-title').textContent = getActive()?.title || 'New Chat';
  }

  function addMessage(role, content, isHTML = false) {
    const chat = getActive();
    if (!chat) return;
    const msg = { role, content, isHTML, ts: Date.now() };
    chat.messages.push(msg);

    // Auto-title from first user message
    if (role === 'user' && chat.messages.filter(m => m.role === 'user').length === 1) {
      chat.title = content.replace(/<[^>]+>/g, '').slice(0, 40) || 'New Chat';
      document.getElementById('chat-title').textContent = chat.title;
      renderChatList();
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

  function renderChatList() {
    const list = document.getElementById('chat-list');
    list.innerHTML = '';
    chats.filter(c => !c.hidden).forEach(chat => {
      const item = document.createElement('div');
      item.className = 'chat-item' + (chat.id === activeId ? ' active' : '') + (chat.starred ? ' starred' : '');
      item.innerHTML = `
        <span class="chat-item-title">${chat.starred ? '⭐ ' : ''}${chat.title}</span>
        <button class="chat-menu-btn" data-id="${chat.id}">⋮</button>
      `;
      item.querySelector('.chat-item-title').addEventListener('click', () => switchChat(chat.id));
      item.querySelector('.chat-menu-btn').addEventListener('click', e => {
        e.stopPropagation();
        openChatMenu(chat.id, e.target);
      });
      list.appendChild(item);
    });
  }

  function openChatMenu(id, anchor) {
    closeAllMenus();
    const chat = chats.find(c => c.id === id);
    const menu = document.createElement('div');
    menu.className = 'chat-menu-dropdown';
    menu.innerHTML = `
      <div class="menu-item" data-action="rename">Rename</div>
      <div class="menu-item" data-action="star">${chat.starred ? 'Unstar' : 'Star ⭐'}</div>
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

  function closeAllMenus() {
    document.querySelectorAll('.chat-menu-dropdown').forEach(m => m.remove());
  }

  function handleMenuAction(id, action) {
    const chat = chats.find(c => c.id === id);
    if (!chat) return;
    if (action === 'rename') {
      const name = prompt('Rename chat:', chat.title);
      if (name && name.trim()) { chat.title = name.trim(); }
    } else if (action === 'star') {
      chat.starred = !chat.starred;
    } else if (action === 'hide') {
      chat.hidden = true;
      if (chat.id === activeId) newChat();
    } else if (action === 'delete') {
      if (!confirm('Delete this chat?')) return;
      chats = chats.filter(c => c.id !== id);
      if (id === activeId) newChat();
    }
    Storage.saveChats(chats);
    renderChatList();
    if (action === 'rename') document.getElementById('chat-title').textContent = chat.title;
  }

  function switchChat(id) {
    activeId = id;
    Storage.setActiveChat(id);
    clearMessages();
    const chat = getActive();
    chat.messages.forEach(renderMessage);
    renderChatList();
    scrollBottom();
  }

  function scrollBottom() {
    const msgs = document.getElementById('messages');
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'message joe';
    el.id = 'typing-indicator';
    el.innerHTML = '<div class="avatar">🐒</div><div class="bubble typing"><span></span><span></span><span></span></div>';
    document.getElementById('messages').appendChild(el);
    scrollBottom();
    return el;
  }

  function removeTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  async function processResponse(input) {
    const indicator = showTyping();
    await new Promise(r => setTimeout(r, 400));
    removeTyping();

    const raw = Brain.respond(input);

    if (raw && raw.startsWith('__SEARCH__:')) {
      const query = raw.slice(11);
      const result = await Search.ask(query);
      if (result === null) {
        addMessage('joe', "Okay, I won't search for that.");
      } else {
        addMessage('joe', result);
      }
    } else {
      addMessage('joe', raw);
    }
  }

  return { init, newChat, addMessage, processResponse };
})();
