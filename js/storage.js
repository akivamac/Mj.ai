const Storage = (() => {
  const PREFIX = 'mj_';

  function getBrain(key) {
    const raw = localStorage.getItem(PREFIX + 'brain_' + key);
    if (raw) { try { return JSON.parse(raw); } catch(_) {} }
    return null;
  }

  function setBrain(key, data) {
    localStorage.setItem(PREFIX + 'brain_' + key, JSON.stringify(data));
  }

  function getChats() {
    const raw = localStorage.getItem(PREFIX + 'chats');
    if (raw) { try { return JSON.parse(raw); } catch(_) {} }
    return [];
  }

  function saveChats(chats) {
    localStorage.setItem(PREFIX + 'chats', JSON.stringify(chats));
  }

  function getActiveChat() {
    return localStorage.getItem(PREFIX + 'active_chat') || null;
  }

  function setActiveChat(id) {
    localStorage.setItem(PREFIX + 'active_chat', id);
  }

  function getMcpUrl() {
    return localStorage.getItem(PREFIX + 'mcp_url') || '';
  }

  return { getBrain, setBrain, getChats, saveChats, getActiveChat, setActiveChat, getMcpUrl };
})();
