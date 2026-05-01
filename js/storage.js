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

  function getProjects() {
    const raw = localStorage.getItem(PREFIX + 'projects');
    if (raw) { try { return JSON.parse(raw); } catch(_) {} }
    return [];
  }
  function saveProjects(p) { localStorage.setItem(PREFIX + 'projects', JSON.stringify(p)); }
  function getActiveProject() { return localStorage.getItem(PREFIX + 'active_project') || null; }
  function setActiveProject(id) {
    if (id) localStorage.setItem(PREFIX + 'active_project', id);
    else localStorage.removeItem(PREFIX + 'active_project');
  }
  return { getBrain, setBrain, getChats, saveChats, getActiveChat, setActiveChat, getMcpUrl, getProjects, saveProjects, getActiveProject, setActiveProject };
})();
