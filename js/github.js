const GitHub = (() => {
  const REPO  = 'akivamac/Mj.ai';
  const BRANCH = 'main';
  const BASE  = 'https://api.github.com';

  function token() {
    return (typeof CONFIG !== 'undefined' && CONFIG.githubToken) ? CONFIG.githubToken : null;
  }

  function headers() {
    return {
      'Authorization': 'token ' + token(),
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json',
    };
  }

  async function getSHA(path) {
    const res = await fetch(`${BASE}/repos/${REPO}/contents/${path}?ref=${BRANCH}`, { headers: headers() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sha;
  }

  async function pushFile(path, content, message) {
    if (!token()) return { ok: false, error: 'No GitHub token in config.js' };
    try {
      const sha  = await getSHA(path);
      const body = {
        message: message || `Update ${path} via Monkey Joe`,
        content: btoa(unescape(encodeURIComponent(content))),
        branch:  BRANCH,
      };
      if (sha) body.sha = sha;
      const res = await fetch(`${BASE}/repos/${REPO}/contents/${path}`, {
        method: 'PUT', headers: headers(), body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.message || res.statusText };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  return { pushFile, getFile: (id) => null };
})();
