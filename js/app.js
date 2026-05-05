document.addEventListener('DOMContentLoaded', async () => {
  await Brain.load();
  Storage.getChats();
  MCP.init();
  Search.init();
  Draw.init();
  Photo.init();
  await Chat.init();

  const input = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const newChatBtn = document.getElementById('new-chat-btn');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');

  function send() {
    const text = input.value.trim();
    if (!text) return;
    Chat.addMessage('user', text);
    Chat.processResponse(text);
    input.value = '';
    input.style.height = 'auto';
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  newChatBtn.addEventListener('click', () => { Chat.newChat(); Chat.showPanel('chat'); });

  document.getElementById('nav-projects-btn').addEventListener('click', () => Chat.renderProjectsPanel());
  document.getElementById('new-project-panel-btn').addEventListener('click', () => Chat.createProject());
  document.getElementById('project-back-btn').addEventListener('click', () => Chat.renderProjectsPanel());

  function toggleSidebar() { sidebar.classList.toggle('hidden'); }
  sidebarToggle.addEventListener('click', toggleSidebar);
  document.getElementById('projects-sidebar-toggle').addEventListener('click', toggleSidebar);
  document.getElementById('project-page-sidebar-toggle').addEventListener('click', toggleSidebar);
});
