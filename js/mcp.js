const MCP = (() => {
  let serverUrl = '';

  function init() {
    serverUrl = Storage.getMcpUrl();
  }

  async function send(toolName, input) {
    if (!serverUrl) return { error: 'No MCP server configured. Go to Settings to add one.' };
    try {
      const r = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: toolName, input })
      });
      return await r.json();
    } catch(e) {
      return { error: 'MCP error: ' + e.message };
    }
  }

  return { init, send };
})();
