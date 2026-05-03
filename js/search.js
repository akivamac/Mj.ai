const Search = (() => {
  let pendingResolve = null;

  function init() {
    document.getElementById('search-allow').addEventListener('click', () => {
      closeModal();
      if (pendingResolve) pendingResolve(true);
    });
    document.getElementById('search-deny').addEventListener('click', () => {
      closeModal();
      if (pendingResolve) pendingResolve(false);
    });
  }

  function closeModal() {
    document.getElementById('search-modal').classList.add('hidden');
    pendingResolve = null;
  }

  async function ask(query) {
    document.getElementById('search-query-preview').textContent = query;
    document.getElementById('search-modal').classList.remove('hidden');
    const allowed = await new Promise(resolve => { pendingResolve = resolve; });
    if (!allowed) return null;
    window.open(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, '_blank');
    return "I opened DuckDuckGo in a new tab for you! 🔍";
  }

  return { init, ask };
})();
