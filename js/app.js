document.addEventListener('DOMContentLoaded', async () => {
  await Brain.load();
  Storage.getChats(); // prime
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

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  newChatBtn.addEventListener('click', () => Chat.newChat());

  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
  });
});