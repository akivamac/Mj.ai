const MCP = (() => {
  let serverUrl = '';

  function init() {
    serverUrl = Storage.getMcpUrl();
  }

  async function send(toolName, input) {
    if (!serverUrl) return { error: 'No MCP server configured. Go to Settings to add one.' };
    // Only POST chat data to an explicit https:// (or localhost) endpoint, so a
    // malformed/hijacked setting can't exfiltrate to an arbitrary scheme. (v82)
    let parsed;
    try { parsed = new URL(serverUrl); } catch(_) { return { error: 'MCP server URL is not valid.' }; }
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      return { error: 'MCP server must use https:// (or localhost).' };
    }
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
