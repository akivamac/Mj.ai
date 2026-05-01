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
    chats.forEach(chat => {
      const item = document.createElement('div');
      item.className = 'chat-item' + (chat.id === activeId ? ' active' : '');
      item.textContent = chat.title;
      item.addEventListener('click', () => switchChat(chat.id));
      list.appendChild(item);
    });
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
