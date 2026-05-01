const Backside = (() => {
  const BASE = 'https://api.worktruck.app/api/v1';

  function key() {
    return (typeof CONFIG !== 'undefined' && CONFIG.backsideKey) ? CONFIG.backsideKey : null;
  }

  function headers() {
    return {
      'Authorization': 'Bearer ' + key(),
      'Content-Type': 'application/json'
    };
  }

  function available() { return !!key() && key() !== 'YOUR_BACKSIDE_KEY_HERE'; }

  // ── Low-level ─────────────────────────────────────────────

  async function getNotes(tag) {
    const r = await fetch(`${BASE}/notes?tag=${encodeURIComponent(tag)}&limit=200`, { headers: headers() });
    if (!r.ok) throw new Error('Backside getNotes failed: ' + r.status);
    const d = await r.json();
    return d.data || d.items || d || [];
  }

  async function createNote(title, body, tags, metadata) {
    const r = await fetch(`${BASE}/notes`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ title, body, tags, metadata })
    });
    if (!r.ok) throw new Error('Backside createNote failed: ' + r.status);
    return await r.json();
  }

  async function updateNote(id, body, title, metadata) {
    const payload = {};
    if (body     !== undefined) payload.body     = body;
    if (title    !== undefined) payload.title    = title;
    if (metadata !== undefined) payload.metadata = metadata;
    const r = await fetch(`${BASE}/notes/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('Backside updateNote failed: ' + r.status);
    return await r.json();
  }

  async function deleteNote(id) {
    const r = await fetch(`${BASE}/notes/${id}`, { method: 'DELETE', headers: headers() });
    if (!r.ok) throw new Error('Backside deleteNote failed: ' + r.status);
  }

  // ── Notebooks (Projects) ──────────────────────────────────

  async function getNotebooks() {
    const r = await fetch(`${BASE}/notebooks?limit=200`, { headers: headers() });
    if (!r.ok) throw new Error('Backside getNotebooks failed: ' + r.status);
    const d = await r.json();
    return d.data || d.items || d || [];
  }

  async function createNotebook(name) {
    const r = await fetch(`${BASE}/notebooks`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name })
    });
    if (!r.ok) throw new Error('Backside createNotebook failed: ' + r.status);
    return await r.json();
  }

  async function updateNotebook(id, name) {
    const r = await fetch(`${BASE}/notebooks/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ name })
    });
    if (!r.ok) throw new Error('Backside updateNotebook failed: ' + r.status);
    return await r.json();
  }

  async function deleteNotebook(id) {
    const r = await fetch(`${BASE}/notebooks/${id}`, { method: 'DELETE', headers: headers() });
    if (!r.ok) throw new Error('Backside deleteNotebook failed: ' + r.status);
  }

  return { available, getNotes, createNote, updateNote, deleteNote, getNotebooks, createNotebook, updateNotebook, deleteNotebook };
})();
