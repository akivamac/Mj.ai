const Files = (() => {

  const store = {}; // id → { filename, content, type }

  const templates = {
    html: (name) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
  <style>
    body { font-family: sans-serif; padding: 20px; max-width: 800px; margin: auto; }
  </style>
</head>
<body>
  <h1>${name}</h1>
  <p>Start building here.</p>
</body>
</html>`,
    css:  (name) => `/* ${name}.css */\n\n* { box-sizing: border-box; margin: 0; padding: 0; }\n\nbody {\n  font-family: sans-serif;\n  background: #f5f5f5;\n  color: #1a1a1a;\n  padding: 20px;\n}`,
    js:   (name) => `// ${name}.js\n\n(function() {\n  'use strict';\n\n  function init() {\n    console.log('${name} loaded');\n  }\n\n  document.addEventListener('DOMContentLoaded', init);\n})();`,
    ts:   (name) => `// ${name}.ts\n\nfunction greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}\n\nconsole.log(greet('World'));`,
    md:   (name) => `# ${name}\n\n## Overview\n\nWrite your content here.\n\n## Notes\n\n- Item one\n- Item two\n`,
    txt:  (name) => `${name}\n${'='.repeat(name.length)}\n\n`,
    json: (name) => `{\n  "name": "${name}",\n  "data": []\n}`,
    py:   (name) => `# ${name}.py\n\ndef main():\n    print("Hello from ${name}")\n\nif __name__ == "__main__":\n    main()\n`,
    sh:   (name) => `#!/bin/bash\n# ${name}.sh\n\necho "Running ${name}"\n`,
    svg:  (name) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">\n  <rect width="200" height="200" fill="#f5f5f5"/>\n  <text x="100" y="105" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#333">${name}</text>\n</svg>`,
    csv:  (name) => `name,value,notes\n${name},0,example\n`
  };

  const mimeTypes = {
    html:'text/html', css:'text/css', js:'text/javascript',
    ts:'text/plain', md:'text/markdown', txt:'text/plain',
    json:'application/json', py:'text/plain', sh:'text/plain',
    svg:'image/svg+xml', csv:'text/csv'
  };

  function create(type, name) {
    const ext      = type.toLowerCase();
    const base     = name || 'untitled';
    const fn       = templates[ext];
    if (!fn) return `I don't have a template for .${ext} yet. I can make: ${Object.keys(templates).join(', ')}.`;

    const content  = fn(base);
    const filename = base.endsWith('.' + ext) ? base : base + '.' + ext;
    const mime     = mimeTypes[ext] || 'text/plain';
    const id       = 'f' + Date.now();
    store[id]      = { filename, content, mime, ext };

    return `__HTML__:<div class="file-card">
      <div class="file-card-icon">${extIcon(ext)}</div>
      <div class="file-card-info">
        <span class="file-card-name">${filename}</span>
        <div class="file-card-actions">
          <button class="file-btn" onclick="Files.view('${id}')">👁 View</button>
          <button class="file-btn file-btn-dl" onclick="Files.download('${id}')">⬇ Download</button>
        </div>
      </div>
    </div>`;
  }

  function view(id) {
    const f = store[id];
    if (!f) return;
    document.getElementById('viewer-title').textContent = f.filename;

    const body = document.getElementById('viewer-body');
    body.innerHTML = '';

    if (f.ext === 'html') {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:6px;';
      iframe.srcdoc = f.content;
      body.appendChild(iframe);
    } else if (f.ext === 'svg') {
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;';
      div.innerHTML = f.content;
      body.appendChild(div);
    } else if (f.ext === 'csv') {
      const rows = f.content.trim().split('\n').map(r => r.split(','));
      let html = '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">';
      rows.forEach((row, i) => {
        html += '<tr>' + row.map(cell =>
          i === 0
            ? `<th style="padding:8px;border:1px solid var(--border);background:var(--surface);text-align:left">${cell}</th>`
            : `<td style="padding:8px;border:1px solid var(--border);">${cell}</td>`
        ).join('') + '</tr>';
      });
      html += '</table>';
      const div = document.createElement('div');
      div.style.cssText = 'overflow:auto;height:100%;';
      div.innerHTML = html;
      body.appendChild(div);
    } else {
      const pre = document.createElement('pre');
      pre.style.cssText = 'white-space:pre-wrap;word-break:break-word;font-size:0.82rem;line-height:1.6;height:100%;overflow:auto;margin:0;';
      pre.textContent = f.content;
      body.appendChild(pre);
    }

    // Wire download button in viewer
    document.getElementById('viewer-download-btn').onclick = () => download(id);
    document.getElementById('viewer-modal').classList.remove('hidden');
  }

  function download(id) {
    const f = store[id];
    if (!f) return;
    const blob = new Blob([f.content], { type: f.mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = f.filename; a.click();
    URL.revokeObjectURL(url);
  }

  function parse(input) {
    const lower = input.toLowerCase();
    const typeMap = { javascript:'js', typescript:'ts', markdown:'md', text:'txt', python:'py', bash:'sh', shell:'sh' };
    const typeMatch = lower.match(/\b(html|css|js|javascript|ts|typescript|md|markdown|txt|text|json|py|python|sh|bash|shell|svg|csv)\b/);
    if (!typeMatch) return null;
    let type = typeMatch[1];
    type = typeMap[type] || type;
    let name = 'untitled';
    const nameMatch = input.match(/(?:called|named|for)\s+["']?([a-zA-Z0-9_\-. ]+?)["']?(?:\s+file)?$/i);
    if (nameMatch) name = nameMatch[1].trim().replace(/\s+/g, '-');
    return { type, name };
  }

  function extIcon(ext) {
    const icons = { html:'🌐', css:'🎨', js:'⚡', ts:'📘', md:'📝', txt:'📄', json:'🗂', py:'🐍', sh:'🖥', svg:'🖼', csv:'📊' };
    return icons[ext] || '📄';
  }

  return { create, view, download, parse };
})();
