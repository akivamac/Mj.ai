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
    return doSearch(query);
  }

  async function doSearch(query) {
    try {
      const r = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`
      );
      const data = await r.json();
      if (data.AbstractText) return data.AbstractText;
      if (data.Answer)       return data.Answer;
      if (data.RelatedTopics?.length) {
        return data.RelatedTopics.slice(0, 3).map(t => t.Text).filter(Boolean).join('\n\n');
      }
    } catch(_) {}

    // Fallback: open tab
    window.open(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, '_blank');
    return 'I opened a DuckDuckGo search in a new tab.';
  }

  return { init, ask };
})();
