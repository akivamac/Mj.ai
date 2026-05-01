const Files = (() => {

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
  <script>
    // Your JavaScript here
  </script>
</body>
</html>`,

    css: (name) => `/* ${name}.css */

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: sans-serif;
  background: #f5f5f5;
  color: #1a1a1a;
  padding: 20px;
}`,

    js: (name) => `// ${name}.js

(function() {
  'use strict';

  function init() {
    console.log('${name} loaded');
  }

  document.addEventListener('DOMContentLoaded', init);
})();`,

    ts: (name) => `// ${name}.ts

function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));`,

    md: (name) => `# ${name}

## Overview

Write your content here.

## Notes

- Item one
- Item two
`,

    txt: (name) => `${name}\n${'='.repeat(name.length)}\n\n`,

    json: (name) => `{\n  "name": "${name}",\n  "data": []\n}`,

    py: (name) => `# ${name}.py\n\ndef main():\n    print("Hello from ${name}")\n\nif __name__ == "__main__":\n    main()\n`,

    sh: (name) => `#!/bin/bash\n# ${name}.sh\n\necho "Running ${name}"\n`,

    svg: (name) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">\n  <rect width="200" height="200" fill="#f5f5f5"/>\n  <text x="100" y="105" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#333">${name}</text>\n</svg>`,

    csv: (name) => `name,value,notes\n${name},0,example\n`
  };

  const mimeTypes = {
    html: 'text/html',
    css:  'text/css',
    js:   'text/javascript',
    ts:   'text/plain',
    md:   'text/markdown',
    txt:  'text/plain',
    json: 'application/json',
    py:   'text/plain',
    sh:   'text/plain',
    svg:  'image/svg+xml',
    csv:  'text/csv'
  };

  function create(type, name) {
    const ext  = type.toLowerCase();
    const base = name || 'untitled';
    const fn   = templates[ext];
    if (!fn) return `I don't have a template for .${ext} files yet. I can make: ${Object.keys(templates).join(', ')}.`;

    const content  = fn(base);
    const filename = base.endsWith('.' + ext) ? base : base + '.' + ext;
    const mime     = mimeTypes[ext] || 'text/plain';
    const blob     = new Blob([content], { type: mime });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = filename;
    a.click();
    URL.revokeObjectURL(url);

    return `Here's your ${filename}! It should be downloading now 🐒`;
  }

  // Parse "make a html file called notes" → {type, name}
  function parse(input) {
    const lower = input.toLowerCase();
    const typeMatch = lower.match(/\b(html|css|js|javascript|ts|typescript|md|markdown|txt|text|json|py|python|sh|bash|shell|svg|csv)\b/);
    if (!typeMatch) return null;

    let type = typeMatch[1];
    if (type === 'javascript') type = 'js';
    if (type === 'typescript') type = 'ts';
    if (type === 'markdown')   type = 'md';
    if (type === 'text')       type = 'txt';
    if (type === 'python')     type = 'py';
    if (type === 'bash' || type === 'shell') type = 'sh';

    // Try to extract a name: "called X", "named X", "for X"
    let name = 'untitled';
    const nameMatch = input.match(/(?:called|named|for|called)\s+["']?([a-zA-Z0-9_\-. ]+?)["']?(?:\s+file)?$/i);
    if (nameMatch) name = nameMatch[1].trim().replace(/\s+/g, '-');

    return { type, name };
  }

  return { create, parse };
})();
