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
    const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    // window.open can be blocked by a popup blocker (returns null) — fall back
    // to a clickable link so Joe never goes silent on "allow". (Bug 6)
    let win = null;
    try { win = window.open(url, '_blank'); } catch (_) { win = null; }
    return win
      ? "I opened DuckDuckGo in a new tab for you! 🔍"
      : `Your browser blocked the popup, but here's the search — tap to open: ${url}`;
  }

  return { init, ask };
})();
