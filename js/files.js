const Files = (() => {

  const store = {};

  // ── Helper: parse color theme from description ──────────
  function parseTheme(desc) {
    const d = desc.toLowerCase();
    if (d.includes('dark')) return { bg:'#1a1a2e', surface:'#16213e', card:'#0f3460', text:'#eaeaea', muted:'#a0a0b0', accent:'#e94560', border:'#2a2a4a' };
    if (d.includes('forest') || d.includes('green') || d.includes('nature')) return { bg:'#1a2e1a', surface:'#1e3a1e', card:'#2d5a27', text:'#e8f5e9', muted:'#a5d6a7', accent:'#69f0ae', border:'#2e5c2e' };
    if (d.includes('ocean') || d.includes('blue') || d.includes('sea')) return { bg:'#0d1b2a', surface:'#1b2a3b', card:'#1e3a5f', text:'#e8f4fd', muted:'#90caf9', accent:'#40c4ff', border:'#1e3a5f' };
    if (d.includes('warm') || d.includes('cozy') || d.includes('orange')) return { bg:'#1c1200', surface:'#2a1c00', card:'#3d2b00', text:'#fff8e1', muted:'#ffcc80', accent:'#ffa000', border:'#3d2b00' };
    if (d.includes('pink') || d.includes('rose') || d.includes('girly')) return { bg:'#1a0a14', surface:'#2a1020', card:'#3d1530', text:'#fce4ec', muted:'#f48fb1', accent:'#f06292', border:'#3d1530' };
    // default light
    return { bg:'#f8f9fa', surface:'#ffffff', card:'#f0f2f5', text:'#1a1a2e', muted:'#6c757d', accent:'#5469d4', border:'#dee2e6' };
  }

  function baseCSS(theme) {
    return `* { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: ${theme.bg}; color: ${theme.text}; line-height: 1.7; min-height: 100vh; }
    a { color: ${theme.accent}; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
    h1 { font-size: 2.2rem; font-weight: 800; margin-bottom: 8px; color: ${theme.accent}; }
    h2 { font-size: 1.4rem; font-weight: 700; margin: 32px 0 12px; color: ${theme.text}; }
    h3 { font-size: 1.1rem; font-weight: 600; margin: 20px 0 8px; color: ${theme.muted}; }
    p { margin-bottom: 14px; color: ${theme.text}; }
    .card { background: ${theme.surface}; border: 1px solid ${theme.border}; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .tag { display: inline-block; background: ${theme.accent}22; color: ${theme.accent}; border-radius: 20px; padding: 3px 12px; font-size: 0.8rem; font-weight: 600; margin: 3px; }
    .muted { color: ${theme.muted}; font-size: 0.9rem; }
    hr { border: none; border-top: 1px solid ${theme.border}; margin: 28px 0; }
    ul, ol { padding-left: 22px; margin-bottom: 14px; }
    li { margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: ${theme.card}; color: ${theme.accent}; font-weight: 700; text-align: left; padding: 12px 16px; border-bottom: 2px solid ${theme.border}; }
    td { padding: 10px 16px; border-bottom: 1px solid ${theme.border}; }
    tr:hover td { background: ${theme.card}; }
    .btn { display: inline-block; background: ${theme.accent}; color: #fff; border-radius: 8px; padding: 10px 22px; font-weight: 700; font-size: 0.95rem; cursor: pointer; border: none; margin: 4px; }
    .btn:hover { opacity: 0.85; }
    .btn-outline { background: transparent; border: 2px solid ${theme.accent}; color: ${theme.accent}; }
    header { background: ${theme.surface}; border-bottom: 1px solid ${theme.border}; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    nav a { color: ${theme.text}; margin-left: 20px; font-weight: 500; }
    nav a:hover { color: ${theme.accent}; text-decoration: none; }
    footer { background: ${theme.surface}; border-top: 1px solid ${theme.border}; padding: 24px; text-align: center; color: ${theme.muted}; font-size: 0.85rem; margin-top: 60px; }
    input, textarea, select { background: ${theme.card}; border: 1px solid ${theme.border}; color: ${theme.text}; border-radius: 8px; padding: 10px 14px; font-size: 1rem; width: 100%; margin-bottom: 14px; font-family: inherit; }
    input:focus, textarea:focus { outline: 2px solid ${theme.accent}; border-color: ${theme.accent}; }
    label { display: block; font-weight: 600; margin-bottom: 5px; color: ${theme.muted}; font-size: 0.88rem; }
    .hero { text-align: center; padding: 60px 24px; }
    .hero h1 { font-size: 3rem; margin-bottom: 16px; }
    .hero p { font-size: 1.15rem; color: ${theme.muted}; max-width: 600px; margin: 0 auto 28px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin: 20px 0; }
    .badge { display: inline-block; background: ${theme.accent}; color: #fff; border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; font-weight: 700; }
    @media (max-width: 600px) { .hero h1 { font-size: 2rem; } .container { padding: 20px 16px; } }`;
  }

  // ── Rich template builders ───────────────────────────────

  function buildPortfolio(name, desc, theme) {
    const t = parseTheme(desc + ' ' + theme);
    const css = baseCSS(t);
    const title = name || 'My Portfolio';
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}
    .avatar { width: 110px; height: 110px; border-radius: 50%; background: ${t.accent}22; border: 3px solid ${t.accent}; display: flex; align-items: center; justify-content: center; font-size: 2.8rem; margin: 0 auto 20px; }
    .skill-bar { background: ${t.card}; border-radius: 20px; height: 8px; margin: 6px 0 14px; overflow: hidden; }
    .skill-fill { height: 100%; border-radius: 20px; background: ${t.accent}; }
    .project-card { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 12px; overflow: hidden; transition: transform 0.2s; }
    .project-card:hover { transform: translateY(-4px); }
    .project-img { height: 160px; background: ${t.card}; display: flex; align-items: center; justify-content: center; font-size: 3rem; }
    .project-body { padding: 18px; }
    </style></head><body>
    <header><div style="font-weight:800;font-size:1.1rem;color:${t.accent}">${title}</div><nav><a href="#about">About</a><a href="#projects">Projects</a><a href="#skills">Skills</a><a href="#contact">Contact</a></nav></header>
    <div class="hero" style="background:${t.surface};">
      <div class="avatar">👤</div>
      <h1>${title}</h1>
      <p class="muted">Designer · Developer · Creator</p>
      <p>Building beautiful digital experiences with passion and precision.</p>
      <button class="btn">View My Work</button>
      <button class="btn btn-outline" style="margin-left:8px">Contact Me</button>
    </div>
    <div class="container">
      <section id="about"><h2>About Me</h2>
      <div class="card"><p>Hi! I'm a passionate creator with a love for building things that make a difference. I specialize in bringing ideas to life through thoughtful design and clean code.</p>
      <p>When I'm not working, I love exploring new technologies, reading, and finding inspiration in everyday life.</p>
      <div><span class="tag">Creative</span><span class="tag">Detail-oriented</span><span class="tag">Problem solver</span><span class="tag">Team player</span></div>
      </div></section>
      <section id="projects"><h2>Projects</h2>
      <div class="grid">
        <div class="project-card"><div class="project-img">🚀</div><div class="project-body"><h3>Project One</h3><p class="muted">A powerful tool that streamlines workflows and saves time.</p><span class="tag">Web App</span><span class="tag">React</span></div></div>
        <div class="project-card"><div class="project-img">🎨</div><div class="project-body"><h3>Project Two</h3><p class="muted">A beautiful design system built for scale and accessibility.</p><span class="tag">Design</span><span class="tag">CSS</span></div></div>
        <div class="project-card"><div class="project-img">📱</div><div class="project-body"><h3>Project Three</h3><p class="muted">A mobile-first experience loved by thousands of users.</p><span class="tag">Mobile</span><span class="tag">UX</span></div></div>
      </div></section>
      <section id="skills"><h2>Skills</h2>
      <div class="card">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 30px">
          <div><p style="font-weight:600;margin-bottom:4px">HTML &amp; CSS</p><div class="skill-bar"><div class="skill-fill" style="width:90%"></div></div></div>
          <div><p style="font-weight:600;margin-bottom:4px">JavaScript</p><div class="skill-bar"><div class="skill-fill" style="width:85%"></div></div></div>
          <div><p style="font-weight:600;margin-bottom:4px">Design</p><div class="skill-bar"><div class="skill-fill" style="width:80%"></div></div></div>
          <div><p style="font-weight:600;margin-bottom:4px">Problem Solving</p><div class="skill-bar"><div class="skill-fill" style="width:95%"></div></div></div>
        </div>
      </div></section>
      <section id="contact"><h2>Contact</h2>
      <div class="card">
        <label>Name</label><input type="text" placeholder="Your name">
        <label>Email</label><input type="email" placeholder="your@email.com">
        <label>Message</label><textarea rows="4" placeholder="Tell me about your project..."></textarea>
        <button class="btn">Send Message</button>
      </div></section>
    </div>
    <footer>Made with ❤️ · ${title} · ${new Date().getFullYear()}</footer>
    </body></html>`;
  }

  function buildLanding(name, desc, theme) {
    const t = parseTheme(desc + ' ' + theme);
    const css = baseCSS(t);
    const title = name || 'My Product';
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}
    .feature-icon { font-size: 2.5rem; margin-bottom: 14px; }
    .testimonial { background: ${t.surface}; border-left: 4px solid ${t.accent}; padding: 20px 24px; border-radius: 0 12px 12px 0; margin-bottom: 16px; }
    .price-card { background: ${t.surface}; border: 2px solid ${t.border}; border-radius: 16px; padding: 32px 24px; text-align: center; }
    .price-card.featured { border-color: ${t.accent}; }
    .price { font-size: 3rem; font-weight: 800; color: ${t.accent}; }
    .price small { font-size: 1rem; color: ${t.muted}; }
    </style></head><body>
    <header><div style="font-weight:800;font-size:1.1rem;color:${t.accent}">${title}</div><nav><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#contact">Contact</a><button class="btn" style="padding:8px 18px;margin-left:16px">Get Started</button></nav></header>
    <div class="hero">
      <p><span class="badge">New</span></p>
      <h1>${title}</h1>
      <p>The better way to do what matters. Fast, beautiful, and built for you.</p>
      <button class="btn" style="font-size:1.05rem;padding:14px 32px">Start Free Trial</button>
      <button class="btn btn-outline" style="margin-left:10px">Watch Demo ▶</button>
      <p class="muted" style="margin-top:16px">No credit card required · Free forever plan available</p>
    </div>
    <div class="container">
      <section id="features"><h2 style="text-align:center">Why ${title}?</h2>
      <div class="grid" style="margin-top:24px">
        <div class="card" style="text-align:center"><div class="feature-icon">⚡</div><h3>Lightning Fast</h3><p class="muted">Optimized for speed so you can focus on what matters.</p></div>
        <div class="card" style="text-align:center"><div class="feature-icon">🔒</div><h3>Secure</h3><p class="muted">Your data is protected with industry-leading encryption.</p></div>
        <div class="card" style="text-align:center"><div class="feature-icon">🎨</div><h3>Beautiful</h3><p class="muted">Designed to delight — every detail carefully crafted.</p></div>
        <div class="card" style="text-align:center"><div class="feature-icon">🤝</div><h3>Collaborative</h3><p class="muted">Work together seamlessly with your team in real time.</p></div>
      </div></section>
      <hr>
      <section><h2 style="text-align:center">What people say</h2>
      <div class="testimonial"><p>"${title} changed the way we work. We can't imagine going back."</p><p class="muted" style="margin-top:8px">— Alex M., Product Manager</p></div>
      <div class="testimonial"><p>"Incredible product. The team behind it really cares about quality."</p><p class="muted" style="margin-top:8px">— Jordan T., Designer</p></div>
      </section>
      <hr>
      <section id="pricing"><h2 style="text-align:center">Simple Pricing</h2>
      <div class="grid" style="margin-top:24px">
        <div class="price-card"><h3>Free</h3><div class="price">$0<small>/mo</small></div><ul style="text-align:left;margin:20px 0"><li>Up to 3 projects</li><li>Basic features</li><li>Community support</li></ul><button class="btn btn-outline" style="width:100%">Get Started</button></div>
        <div class="price-card featured"><span class="badge">Most Popular</span><h3>Pro</h3><div class="price">$12<small>/mo</small></div><ul style="text-align:left;margin:20px 0"><li>Unlimited projects</li><li>All features</li><li>Priority support</li><li>Advanced analytics</li></ul><button class="btn" style="width:100%">Start Free Trial</button></div>
      </div></section>
      <hr>
      <section id="contact" style="text-align:center;padding:40px 0"><h2>Ready to get started?</h2>
      <p class="muted">Join thousands of happy customers today.</p>
      <div style="max-width:400px;margin:20px auto;display:flex;gap:10px"><input type="email" placeholder="your@email.com" style="margin:0;flex:1"><button class="btn" style="white-space:nowrap">Sign Up Free</button></div>
      </section>
    </div>
    <footer>${title} · Built with ❤️ · ${new Date().getFullYear()}</footer>
    </body></html>`;
  }

  function buildRecipe(name, desc, theme) {
    const t = parseTheme(theme || '');
    const css = baseCSS(t);
    const title = name || 'My Recipe';
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}
    .recipe-header { background: ${t.surface}; border-radius: 16px; padding: 32px; margin-bottom: 24px; display: flex; gap: 24px; align-items: center; flex-wrap: wrap; }
    .recipe-emoji { font-size: 5rem; }
    .stat { text-align: center; background: ${t.card}; border-radius: 10px; padding: 14px 20px; min-width: 100px; }
    .stat-value { font-size: 1.5rem; font-weight: 800; color: ${t.accent}; }
    .stat-label { font-size: 0.75rem; color: ${t.muted}; text-transform: uppercase; letter-spacing: 0.5px; }
    .steps li { background: ${t.card}; border-radius: 10px; padding: 14px 18px; margin-bottom: 10px; list-style: none; display: flex; gap: 14px; align-items: flex-start; }
    .step-num { background: ${t.accent}; color: #fff; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 0.85rem; }
    .ing-list li { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid ${t.border}; list-style: none; }
    </style></head><body>
    <div class="container">
      <div class="recipe-header">
        <div class="recipe-emoji">🍽️</div>
        <div style="flex:1"><h1>${title}</h1><p style="color:${t.muted}">${desc || 'A delicious homemade recipe.'}</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:16px">
          <div class="stat"><div class="stat-value">15</div><div class="stat-label">Prep (min)</div></div>
          <div class="stat"><div class="stat-value">30</div><div class="stat-label">Cook (min)</div></div>
          <div class="stat"><div class="stat-value">4</div><div class="stat-label">Servings</div></div>
          <div class="stat"><div class="stat-value">⭐⭐⭐⭐⭐</div><div class="stat-label">Rating</div></div>
        </div></div>
      </div>
      <div style="display:grid;grid-template-columns:300px 1fr;gap:24px;flex-wrap:wrap">
        <div><div class="card"><h2 style="margin-top:0">Ingredients</h2>
        <ul class="ing-list">
          <li><span>Ingredient 1</span><span class="muted">1 cup</span></li>
          <li><span>Ingredient 2</span><span class="muted">2 tbsp</span></li>
          <li><span>Ingredient 3</span><span class="muted">500g</span></li>
          <li><span>Ingredient 4</span><span class="muted">To taste</span></li>
          <li><span>Ingredient 5</span><span class="muted">3 pieces</span></li>
        </ul></div></div>
        <div><h2>Instructions</h2>
        <ol class="steps">
          <li><div class="step-num">1</div><div>Prepare all your ingredients. Wash, chop, and measure everything before you begin cooking.</div></li>
          <li><div class="step-num">2</div><div>Heat your pan or pot over medium heat. Add oil and let it warm up for about 1 minute.</div></li>
          <li><div class="step-num">3</div><div>Add the main ingredients and cook according to the recipe, stirring occasionally.</div></li>
          <li><div class="step-num">4</div><div>Season with salt, pepper, and any additional spices. Taste and adjust as needed.</div></li>
          <li><div class="step-num">5</div><div>Serve hot and enjoy! Garnish with fresh herbs for extra flavor and presentation.</div></li>
        </ol>
        <div class="card" style="background:${t.accent}11;border-color:${t.accent}44"><h3 style="color:${t.accent}">💡 Chef's Tip</h3><p class="muted">Add your personal tips here — substitutions, storage instructions, or serving suggestions.</p></div>
        </div>
      </div>
    </div>
    </body></html>`;
  }

  function buildReport(name, desc, theme) {
    const t = parseTheme(theme || '');
    const css = baseCSS(t);
    const title = name || 'Report';
    const today = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}
    .cover { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; background: ${t.surface}; padding: 40px; }
    .cover h1 { font-size: 2.8rem; margin-bottom: 12px; }
    .toc-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dotted ${t.border}; color: ${t.accent}; cursor: pointer; }
    .toc-item:hover { color: ${t.text}; }
    .section-num { color: ${t.accent}; font-weight: 800; margin-right: 8px; }
    blockquote { border-left: 4px solid ${t.accent}; padding: 14px 20px; background: ${t.card}; border-radius: 0 8px 8px 0; margin: 16px 0; color: ${t.muted}; }
    .callout { background: ${t.accent}11; border: 1px solid ${t.accent}33; border-radius: 10px; padding: 16px 20px; margin: 16px 0; }
    </style></head><body>
    <div class="cover">
      <div style="font-size:4rem;margin-bottom:24px">📊</div>
      <h1>${title}</h1>
      <p class="muted" style="font-size:1.1rem">${desc || 'A comprehensive analysis and overview.'}</p>
      <hr style="width:80px;border-color:${t.accent};margin:24px auto">
      <p class="muted">Prepared: ${today}</p>
    </div>
    <div class="container">
      <div class="card"><h2 style="margin-top:0">Table of Contents</h2>
        <div class="toc-item"><span><span class="section-num">1.</span>Executive Summary</span><span class="muted">2</span></div>
        <div class="toc-item"><span><span class="section-num">2.</span>Background &amp; Context</span><span class="muted">3</span></div>
        <div class="toc-item"><span><span class="section-num">3.</span>Key Findings</span><span class="muted">4</span></div>
        <div class="toc-item"><span><span class="section-num">4.</span>Analysis</span><span class="muted">6</span></div>
        <div class="toc-item"><span><span class="section-num">5.</span>Recommendations</span><span class="muted">8</span></div>
        <div class="toc-item"><span><span class="section-num">6.</span>Conclusion</span><span class="muted">9</span></div>
      </div>
      <h2><span class="section-num">1.</span>Executive Summary</h2>
      <p>This report provides a comprehensive overview of ${title.toLowerCase()}. The findings presented here are based on thorough research and analysis, offering actionable insights and recommendations for stakeholders.</p>
      <blockquote>Key takeaway: Replace this with your most important finding or conclusion.</blockquote>
      <h2><span class="section-num">2.</span>Background &amp; Context</h2>
      <p>Provide background information here. Explain why this report was created, what problem it addresses, and what the reader should know before diving into the findings.</p>
      <h2><span class="section-num">3.</span>Key Findings</h2>
      <div class="grid">
        <div class="card" style="text-align:center"><div style="font-size:2.5rem;font-weight:800;color:${t.accent}">Finding 1</div><p class="muted">Description of first key finding</p></div>
        <div class="card" style="text-align:center"><div style="font-size:2.5rem;font-weight:800;color:${t.accent}">Finding 2</div><p class="muted">Description of second key finding</p></div>
        <div class="card" style="text-align:center"><div style="font-size:2.5rem;font-weight:800;color:${t.accent}">Finding 3</div><p class="muted">Description of third key finding</p></div>
      </div>
      <h2><span class="section-num">4.</span>Analysis</h2>
      <p>Provide your in-depth analysis here. Break it into subsections as needed. Use data, charts, tables, and specific evidence to support your points.</p>
      <div class="callout"><strong>📌 Important Note:</strong> Replace this callout with a key insight or warning that deserves special attention.</div>
      <table style="margin:16px 0"><tr><th>Category</th><th>Value</th><th>Status</th></tr>
        <tr><td>Item One</td><td>100</td><td><span class="badge">Good</span></td></tr>
        <tr><td>Item Two</td><td>75</td><td><span class="badge" style="background:#f59e0b">Review</span></td></tr>
        <tr><td>Item Three</td><td>90</td><td><span class="badge">Good</span></td></tr>
      </table>
      <h2><span class="section-num">5.</span>Recommendations</h2>
      <ol><li>First recommendation — explain the action and expected outcome.</li>
      <li>Second recommendation — explain the action and expected outcome.</li>
      <li>Third recommendation — explain the action and expected outcome.</li></ol>
      <h2><span class="section-num">6.</span>Conclusion</h2>
      <p>Summarize the report's main points, reinforce the most important recommendations, and close with a forward-looking statement about next steps.</p>
    </div>
    <footer>${title} · ${today}</footer>
    </body></html>`;
  }

  function buildBlog(name, desc, theme) {
    const t = parseTheme(theme || desc || '');
    const css = baseCSS(t);
    const title = name || 'My Blog';
    const today = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}
    .post-hero { background: ${t.surface}; border-bottom: 1px solid ${t.border}; padding: 60px 24px; text-align: center; }
    .reading-time { display: inline-block; background: ${t.accent}22; color: ${t.accent}; padding: 4px 14px; border-radius: 20px; font-size: 0.82rem; font-weight: 600; margin-bottom: 16px; }
    .author-row { display: flex; align-items: center; gap: 12px; margin: 24px 0; }
    .author-avatar { width: 46px; height: 46px; border-radius: 50%; background: ${t.accent}33; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; }
    .article { max-width: 720px; margin: 0 auto; }
    .article p { font-size: 1.08rem; }
    .article h2 { font-size: 1.5rem; }
    .highlight { background: ${t.accent}22; border-radius: 4px; padding: 2px 6px; color: ${t.accent}; font-weight: 600; }
    </style></head><body>
    <header><div style="font-weight:800;font-size:1.1rem;color:${t.accent}">${title}</div><nav><a href="#">Home</a><a href="#">Articles</a><a href="#">About</a></nav></header>
    <div class="post-hero">
      <div class="reading-time">📖 5 min read</div>
      <h1 style="max-width:700px;margin:0 auto 16px">${title}</h1>
      <p style="color:${t.muted};max-width:600px;margin:0 auto">${desc || 'An in-depth look at an interesting topic.'}</p>
    </div>
    <div class="container">
    <div class="article">
      <div class="author-row"><div class="author-avatar">✍️</div>
      <div><div style="font-weight:700">Author Name</div><div class="muted">${today}</div></div>
      <div style="margin-left:auto"><span class="tag">Topic</span><span class="tag">Writing</span></div></div>
      <hr>
      <p>Start your introduction here. Hook the reader with an interesting fact, question, or story that draws them in immediately.</p>
      <h2>The Main Point</h2>
      <p>Develop your first major point in detail. Use clear, engaging prose. Don't be afraid to use specific examples — they make abstract ideas concrete and memorable.</p>
      <p>You can use <span class="highlight">highlights</span> to call attention to particularly important terms or phrases within your text.</p>
      <blockquote style="border-left:4px solid ${t.accent};padding:16px 20px;background:${t.card};border-radius:0 8px 8px 0;margin:20px 0">"A meaningful quote that reinforces your point goes here. Make it memorable."</blockquote>
      <h2>Going Deeper</h2>
      <p>Explore the nuances of your topic. This is where you can get into the details, address counterarguments, or share research that supports your main thesis.</p>
      <ul><li>Supporting point one — with context and explanation</li><li>Supporting point two — with context and explanation</li><li>Supporting point three — with context and explanation</li></ul>
      <h2>What This Means for You</h2>
      <p>Connect the content back to the reader. Why does this matter? What should they do with this information? Be practical and specific.</p>
      <div class="card" style="background:${t.accent}11;border-color:${t.accent}44"><h3 style="color:${t.accent};margin-top:0">Key Takeaways</h3><ol><li>First major insight from this article</li><li>Second major insight from this article</li><li>Third major insight from this article</li></ol></div>
      <hr>
      <p class="muted" style="font-size:0.9rem;text-align:center">Thanks for reading! Share this article if you found it helpful. 🙏</p>
    </div></div>
    <footer>${title} · ${today}</footer>
    </body></html>`;
  }

  function buildResume(name, desc, theme) {
    const t = parseTheme(theme || '');
    const css = baseCSS(t);
    const title = name || 'Resume';
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}
    body { font-size: 0.92rem; }
    .resume-header { background: ${t.surface}; border-bottom: 3px solid ${t.accent}; padding: 32px 40px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; }
    .name { font-size: 2.2rem; font-weight: 800; color: ${t.accent}; }
    .contact-info { text-align: right; color: ${t.muted}; font-size: 0.85rem; line-height: 1.9; }
    .section-title { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: ${t.accent}; border-bottom: 2px solid ${t.accent}; padding-bottom: 6px; margin: 24px 0 14px; }
    .job { margin-bottom: 18px; }
    .job-header { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px; }
    .job-title { font-weight: 700; font-size: 1rem; }
    .job-company { color: ${t.accent}; font-weight: 600; }
    .job-date { color: ${t.muted}; font-size: 0.85rem; }
    .skill-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    </style></head><body>
    <div class="resume-header">
      <div><div class="name">${name || 'Your Name'}</div><div style="color:${t.muted};margin-top:4px">${desc || 'Your Professional Title'}</div></div>
      <div class="contact-info"><div>📧 email@example.com</div><div>📱 (555) 000-0000</div><div>🔗 linkedin.com/in/yourname</div><div>🌐 yourwebsite.com</div></div>
    </div>
    <div class="container" style="padding-top:24px">
      <div class="section-title">Summary</div>
      <p>Passionate and experienced professional with a track record of delivering high-quality results. Known for strong problem-solving skills, attention to detail, and the ability to work effectively both independently and as part of a team.</p>
      <div class="section-title">Experience</div>
      <div class="job">
        <div class="job-header"><div><div class="job-title">Senior Position</div><div class="job-company">Company Name</div></div><div class="job-date">Jan 2022 – Present</div></div>
        <ul style="margin-top:8px"><li>Led key initiatives resulting in significant improvements across core metrics</li><li>Collaborated with cross-functional teams to deliver projects on time and within scope</li><li>Mentored junior team members and contributed to team culture and growth</li></ul>
      </div>
      <div class="job">
        <div class="job-header"><div><div class="job-title">Previous Position</div><div class="job-company">Previous Company</div></div><div class="job-date">Jun 2019 – Dec 2021</div></div>
        <ul style="margin-top:8px"><li>Developed and maintained key systems and processes for the organization</li><li>Identified and resolved complex challenges, improving efficiency by measurable amounts</li></ul>
      </div>
      <div class="section-title">Education</div>
      <div class="job"><div class="job-header"><div><div class="job-title">Degree Name</div><div class="job-company">University Name</div></div><div class="job-date">2015 – 2019</div></div>
      <p class="muted" style="margin-top:4px">Relevant coursework, honors, or activities</p></div>
      <div class="section-title">Skills</div>
      <div class="skill-tags"><span class="tag">Skill One</span><span class="tag">Skill Two</span><span class="tag">Skill Three</span><span class="tag">Skill Four</span><span class="tag">Skill Five</span><span class="tag">Skill Six</span><span class="tag">Leadership</span><span class="tag">Communication</span></div>
    </div></body></html>`;
  }

  function buildDashboard(name, desc, theme) {
    const t = parseTheme(theme || desc || '');
    const css = baseCSS(t);
    const title = name || 'Dashboard';
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}
    body { display: flex; min-height: 100vh; }
    .sidebar { width: 220px; background: ${t.surface}; border-right: 1px solid ${t.border}; padding: 24px 0; flex-shrink: 0; }
    .sidebar-logo { padding: 0 20px 24px; font-weight: 800; font-size: 1.1rem; color: ${t.accent}; }
    .nav-item { display: block; padding: 10px 20px; color: ${t.text}; font-weight: 500; cursor: pointer; }
    .nav-item:hover, .nav-item.active { background: ${t.accent}15; color: ${t.accent}; border-right: 3px solid ${t.accent}; text-decoration: none; }
    .main { flex: 1; overflow: auto; }
    .topbar { background: ${t.surface}; border-bottom: 1px solid ${t.border}; padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; }
    .content { padding: 24px; }
    .stat-card { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 12px; padding: 20px 24px; }
    .stat-value { font-size: 2.2rem; font-weight: 800; color: ${t.accent}; }
    .stat-change { font-size: 0.8rem; font-weight: 600; }
    .positive { color: #22c55e; }
    .negative { color: #ef4444; }
    .chart-bar { background: ${t.card}; border-radius: 8px; height: 180px; display: flex; align-items: flex-end; gap: 8px; padding: 12px; }
    .bar { background: ${t.accent}; border-radius: 4px 4px 0 0; flex: 1; min-height: 10px; opacity: 0.85; transition: opacity 0.2s; }
    .bar:hover { opacity: 1; }
    </style></head><body>
    <div class="sidebar">
      <div class="sidebar-logo">📊 ${title}</div>
      <a class="nav-item active" href="#">🏠 Overview</a>
      <a class="nav-item" href="#">📈 Analytics</a>
      <a class="nav-item" href="#">👥 Users</a>
      <a class="nav-item" href="#">📦 Products</a>
      <a class="nav-item" href="#">💬 Messages</a>
      <a class="nav-item" href="#">⚙️ Settings</a>
    </div>
    <div class="main">
      <div class="topbar"><h2 style="margin:0;font-size:1.1rem">Overview</h2>
      <div style="display:flex;gap:12px;align-items:center"><input type="text" placeholder="Search..." style="width:200px;margin:0;padding:8px 12px"><div style="width:36px;height:36px;border-radius:50%;background:${t.accent}33;display:flex;align-items:center;justify-content:center">👤</div></div></div>
      <div class="content">
        <div class="grid">
          <div class="stat-card"><p class="muted">Total Revenue</p><div class="stat-value">$48,295</div><p class="stat-change positive">↑ 12.5% from last month</p></div>
          <div class="stat-card"><p class="muted">Active Users</p><div class="stat-value">3,842</div><p class="stat-change positive">↑ 8.1% from last month</p></div>
          <div class="stat-card"><p class="muted">New Orders</p><div class="stat-value">284</div><p class="stat-change negative">↓ 3.2% from last month</p></div>
          <div class="stat-card"><p class="muted">Conversion Rate</p><div class="stat-value">4.6%</div><p class="stat-change positive">↑ 0.8% from last month</p></div>
        </div>
        <div class="card" style="margin-top:20px"><h3 style="margin-top:0">Monthly Revenue</h3>
        <div class="chart-bar">
          <div class="bar" style="height:40%" title="Jan"></div><div class="bar" style="height:55%" title="Feb"></div>
          <div class="bar" style="height:45%" title="Mar"></div><div class="bar" style="height:70%" title="Apr"></div>
          <div class="bar" style="height:60%" title="May"></div><div class="bar" style="height:85%" title="Jun"></div>
          <div class="bar" style="height:75%" title="Jul"></div><div class="bar" style="height:90%" title="Aug"></div>
          <div class="bar" style="height:80%" title="Sep"></div><div class="bar" style="height:95%" title="Oct"></div>
          <div class="bar" style="height:88%" title="Nov"></div><div class="bar" style="height:100%" title="Dec"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;padding:0 12px">
          <span class="muted" style="font-size:0.75rem">Jan</span><span class="muted" style="font-size:0.75rem">Jun</span><span class="muted" style="font-size:0.75rem">Dec</span>
        </div></div>
        <div class="card"><h3 style="margin-top:0">Recent Activity</h3>
        <table><tr><th>User</th><th>Action</th><th>Time</th><th>Status</th></tr>
        <tr><td>Alex M.</td><td>Placed order #1042</td><td>2 min ago</td><td><span class="badge">Complete</span></td></tr>
        <tr><td>Jordan T.</td><td>Submitted support ticket</td><td>15 min ago</td><td><span class="badge" style="background:#f59e0b">Pending</span></td></tr>
        <tr><td>Sam K.</td><td>Upgraded to Pro plan</td><td>1 hr ago</td><td><span class="badge">Complete</span></td></tr>
        <tr><td>Riley J.</td><td>Cancelled subscription</td><td>3 hr ago</td><td><span class="badge" style="background:#ef4444">Cancelled</span></td></tr>
        </table></div>
      </div>
    </div>
    </body></html>`;
  }

  function buildGenericHTML(name, desc, theme) {
    const t = parseTheme(theme || desc || '');
    const css = baseCSS(t);
    const title = name || 'My Page';
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}</style></head><body>
    <header><div style="font-weight:800;font-size:1.1rem;color:${t.accent}">${title}</div><nav><a href="#">Home</a><a href="#">About</a><a href="#">Contact</a></nav></header>
    <div class="hero" style="background:${t.surface}"><h1>${title}</h1><p>${desc || 'Welcome to your new page. Start building here!'}</p><button class="btn">Get Started</button></div>
    <div class="container">
      <div class="grid">
        <div class="card"><h3>Section One</h3><p class="muted">Add your first content block here.</p></div>
        <div class="card"><h3>Section Two</h3><p class="muted">Add your second content block here.</p></div>
        <div class="card"><h3>Section Three</h3><p class="muted">Add your third content block here.</p></div>
      </div>
    </div>
    <footer>${title} · ${new Date().getFullYear()}</footer>
    </body></html>`;
  }

  // ── Detect document kind from description ────────────────
  function detectDocKind(desc) {
    const d = desc.toLowerCase();
    if (/portfolio|my work|showcase|projects/.test(d)) return 'portfolio';
    if (/landing|product|saas|startup|service|app landing/.test(d)) return 'landing';
    if (/recipe|cooking|dish|food|meal|ingredients|baking/.test(d)) return 'recipe';
    if (/report|analysis|research|findings|study/.test(d)) return 'report';
    if (/blog|article|post|essay|story/.test(d)) return 'blog';
    if (/resume|cv|curriculum|job application|hire me/.test(d)) return 'resume';
    if (/dashboard|analytics|admin|stats|metrics|data/.test(d)) return 'dashboard';
    return 'generic';
  }

  // ── Parse type and description from brain signal ─────────
  function parse(input) {
    const lower = input.toLowerCase();
    const typeMap = { javascript:'js', typescript:'ts', markdown:'md', text:'txt', python:'py', bash:'sh', shell:'sh' };
    const typeMatch = lower.match(/\b(html|css|js|javascript|ts|typescript|md|markdown|txt|text|json|py|python|sh|bash|shell|svg|csv)\b/);
    if (!typeMatch) return null;
    let type = typeMatch[1];
    type = typeMap[type] || type;
    let name = 'untitled';
    const nameMatch = input.match(/(?:called|named|for|titled?)\s+["']?([a-zA-Z0-9_\-. ]+?)["']?(?:\s+file|\s+page|\s+site|\s+app)?$/i);
    if (nameMatch) name = nameMatch[1].trim().replace(/\s+/g,'-');
    const desc = input;
    return { type, name, desc };
  }

  // ── Create ───────────────────────────────────────────────
  function create(type, name, fullDesc) {
    const ext  = (type || '').toLowerCase();
    const base = name || 'untitled';
    const desc = fullDesc || '';
    let content;

    if (ext === 'html') {
      const kind = detectDocKind(desc + ' ' + base);
      if      (kind === 'portfolio') content = buildPortfolio(base, desc, desc);
      else if (kind === 'landing')   content = buildLanding(base, desc, desc);
      else if (kind === 'recipe')    content = buildRecipe(base, desc, desc);
      else if (kind === 'report')    content = buildReport(base, desc, desc);
      else if (kind === 'blog')      content = buildBlog(base, desc, desc);
      else if (kind === 'resume')    content = buildResume(base, desc, desc);
      else if (kind === 'dashboard') content = buildDashboard(base, desc, desc);
      else                           content = buildGenericHTML(base, desc, desc);
    } else {
      const templates = {
        css:  (n) => `/* ${n}.css */\n\n* { box-sizing: border-box; margin: 0; padding: 0; }\n\nbody {\n  font-family: 'Segoe UI', system-ui, sans-serif;\n  background: #f8f9fa;\n  color: #1a1a2e;\n  line-height: 1.7;\n  padding: 24px;\n}\n\n.container {\n  max-width: 900px;\n  margin: 0 auto;\n}\n\n/* Add your styles below */\n`,
        js:   (n) => `// ${n}.js\n\n'use strict';\n\n/**\n * ${n}\n * ${desc || 'Description of what this script does.'}\n */\n\nfunction init() {\n  console.log('${n} initialized');\n}\n\ndocument.addEventListener('DOMContentLoaded', init);\n`,
        ts:   (n) => `// ${n}.ts\n\n/**\n * ${desc || n}\n */\n\ninterface Config {\n  name: string;\n  version: string;\n}\n\nconst config: Config = {\n  name: '${n}',\n  version: '1.0.0',\n};\n\nfunction greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}\n\nconsole.log(greet(config.name));\n`,
        md:   (n) => `# ${n}\n\n> ${desc || 'A brief description of this document.'}\n\n## Overview\n\nWrite your introduction here. What is this about and why does it matter?\n\n## Content\n\n### Section One\n\nAdd your first section content here.\n\n### Section Two\n\nAdd your second section content here.\n\n## Key Points\n\n- First important point\n- Second important point\n- Third important point\n\n## Notes\n\nAny additional notes or references go here.\n`,
        txt:  (n) => `${n}\n${'─'.repeat(n.length + 2)}\n\n${desc || 'Start writing here.'}\n\n`,
        json: (n) => `{\n  "name": "${n}",\n  "description": "${desc || ''}",\n  "version": "1.0.0",\n  "created": "${new Date().toISOString()}",\n  "data": []\n}\n`,
        py:   (n) => `#!/usr/bin/env python3\n"""${n}.py\n\n${desc || 'Description of what this script does.'}\n"""\n\n\ndef main() -> None:\n    """Main entry point."""\n    print(f"${n} running...")\n    # Add your code here\n\n\nif __name__ == "__main__":\n    main()\n`,
        sh:   (n) => `#!/bin/bash\n# ${n}.sh\n# ${desc || 'Description of what this script does.'}\n\nset -euo pipefail\n\necho "Starting ${n}..."\n\n# Add your commands here\n\necho "Done."\n`,
        svg:  (n) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">\n  <defs>\n    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">\n      <stop offset="0%" style="stop-color:#5469d4;stop-opacity:1" />\n      <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />\n    </linearGradient>\n  </defs>\n  <rect width="400" height="300" fill="url(#grad)" rx="16"/>\n  <rect x="40" y="60" width="320" height="180" fill="rgba(255,255,255,0.1)" rx="12"/>\n  <text x="200" y="155" text-anchor="middle" font-family="system-ui,sans-serif" font-size="24" font-weight="700" fill="white">${n}</text>\n  <text x="200" y="185" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" fill="rgba(255,255,255,0.7)">${desc || 'Your SVG graphic'}</text>\n</svg>`,
        csv:  (n) => `id,name,value,category,date,notes\n1,Item One,100,Category A,${new Date().toISOString().slice(0,10)},First item\n2,Item Two,200,Category B,${new Date().toISOString().slice(0,10)},Second item\n3,Item Three,150,Category A,${new Date().toISOString().slice(0,10)},Third item\n`,
      };
      const fn = templates[ext];
      if (!fn) return `I can make: html, css, js, ts, md, txt, json, py, sh, svg, csv files. Which type do you want?`;
      content = fn(base);
    }

    const mimeTypes = { html:'text/html', css:'text/css', js:'text/javascript', ts:'text/plain', md:'text/markdown', txt:'text/plain', json:'application/json', py:'text/plain', sh:'text/plain', svg:'image/svg+xml', csv:'text/csv' };
    const filename = base.endsWith('.'+ext) ? base : base+'.'+ext;
    const mime = mimeTypes[ext] || 'text/plain';
    const id = 'f' + Date.now();
    store[id] = { filename, content, mime, ext };
    return '__HTML__:' + buildCard(id, store[id]);
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
        html += '<tr>' + row.map(cell => i === 0
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
    document.getElementById('viewer-download-btn').onclick = () => download(id);
    document.getElementById('viewer-modal').classList.remove('hidden');
  }

  function download(id) {
    const f = store[id];
    if (!f) return;
    const url = 'data:' + f.mime + ';charset=utf-8,' + encodeURIComponent(f.content);
    const a = document.createElement('a');
    a.href = url; a.download = f.filename; a.click();
  }

  function extIcon(ext) {
    const icons = { html:'🌐', css:'🎨', js:'⚡', ts:'📘', md:'📝', txt:'📄', json:'🗂', py:'🐍', sh:'🖥', svg:'🖼', csv:'📊' };
    return icons[ext] || '📄';
  }

  function edit(id, instruction) {
    const f = store[id];
    if (!f) return "I can't find that file — it may have been lost when the page reloaded. Make it again and I'll edit it!";
    const lower = instruction.toLowerCase();

    // Rename
    const renameMatch = instruction.match(/rename\s+(?:it\s+)?to\s+["']?([a-zA-Z0-9_\-. ]+?)["']?$/i);
    if (renameMatch) {
      const newBase = renameMatch[1].trim().replace(/\s+/g,'-');
      f.filename = newBase.endsWith('.'+f.ext) ? newBase : newBase+'.'+f.ext;
      store[id] = f;
      return '__HTML__:' + buildCard(id, f) + '<br><small style="color:var(--text-muted)">✓ Renamed to ' + f.filename + '</small>';
    }

    // Make dark / light
    if ((lower.includes('dark') || lower.includes('light')) && f.ext === 'html') {
      const dark = lower.includes('dark');
      const bg = dark ? '#1a1a2e' : '#f8f9fa';
      const text = dark ? '#eaeaea' : '#1a1a2e';
      const surface = dark ? '#16213e' : '#ffffff';
      f.content = f.content.replace(/background:\s*#[0-9a-fA-F]{3,6};/, `background: ${bg};`)
                           .replace(/color:\s*#[0-9a-fA-F]{3,6};/, `color: ${text};`);
      store[id] = f;
      return '__HTML__:' + buildCard(id, f) + `<br><small style="color:var(--text-muted)">✓ ${dark?'Dark':'Light'} mode applied</small>`;
    }

    // Change accent/color
    const colorMatch = instruction.match(/(?:change|make|set)\s+(?:the\s+)?(?:color|accent|theme)\s+(?:to\s+)?(\w+)/i);
    if (colorMatch && f.ext === 'html') {
      const colorMap = { blue:'#3b82f6', red:'#ef4444', green:'#22c55e', purple:'#8b5cf6', orange:'#f97316', pink:'#ec4899', yellow:'#eab308', teal:'#14b8a6', cyan:'#06b6d4' };
      const newColor = colorMap[colorMatch[1].toLowerCase()];
      if (newColor) {
        f.content = f.content.replace(/#5469d4|#e94560|#40c4ff|#69f0ae|#ffa000|#f06292/g, newColor);
        store[id] = f;
        return '__HTML__:' + buildCard(id, f) + `<br><small style="color:var(--text-muted)">✓ Color changed to ${colorMatch[1]}</small>`;
      }
    }

    // Change title
    const titleMatch = instruction.match(/(?:change|set|update)\s+(?:the\s+)?title\s+to\s+["']?(.+?)["']?$/i);
    if (titleMatch && f.ext === 'html') {
      const newTitle = titleMatch[1].trim();
      f.content = f.content.replace(/<title>[^<]*<\/title>/, `<title>${newTitle}</title>`);
      f.content = f.content.replace(/<h1[^>]*>[^<]*<\/h1>/, `<h1>${newTitle}</h1>`);
      store[id] = f;
      return '__HTML__:' + buildCard(id, f) + `<br><small style="color:var(--text-muted)">✓ Title updated</small>`;
    }

    // Replace text
    const replaceMatch = instruction.match(/(?:change|replace)\s+["'](.+?)["']\s+(?:to|with)\s+["'](.+?)["']/i);
    if (replaceMatch) {
      f.content = f.content.split(replaceMatch[1]).join(replaceMatch[2]);
      store[id] = f;
      return '__HTML__:' + buildCard(id, f) + `<br><small style="color:var(--text-muted)">✓ Text replaced</small>`;
    }

    // Delete sections / elements
    if (/delete|remove|clear|strip|get rid of/i.test(instruction)) {
      if (f.ext === 'html') {
        const targets = instruction.match(/(?:the|all(?: the)?)\s+(.+?)(?:\s+(?:at|from|in|on).+)?$/i);
        const what = targets ? targets[2].toLowerCase() : '';
        if (/section|div|block|card|grid/i.test(what)) {
          // Remove all divs with 'section' or 'card' class, or <section> tags, below the header/hero
          f.content = f.content
            .replace(/<section[^>]*>[\s\S]*?<\/section>/gi, '')
            .replace(/<div class="card[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
            .replace(/<div class="grid[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
        } else if (/nav|navigation|menu/i.test(what)) {
          f.content = f.content.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
        } else if (/footer/i.test(what)) {
          f.content = f.content.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
        } else if (/header/i.test(what)) {
          f.content = f.content.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
        } else if (/hero/i.test(what)) {
          f.content = f.content.replace(/<div class="hero[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
        } else {
          // Generic: remove everything after </header> inside .container
          f.content = f.content.replace(/(<div class="container[^"]*"[^>]*>)[\s\S]*?(<\/div>\s*<footer)/i, '$1
  <p style="padding:24px;color:#888">Content removed.</p>
$2');
        }
        store[id] = f;
        return '__HTML__:' + buildCard(id, f) + '<br><small style="color:var(--text-muted)">✓ Removed</small>';
      }
      // Non-HTML: clear content
      f.content = '';
      store[id] = f;
      return '__HTML__:' + buildCard(id, f) + '<br><small style="color:var(--text-muted)">✓ Content cleared</small>';
    }

    // Add paragraph / content
    const addMatch = instruction.match(/add\s+(?:the\s+(?:text|line|paragraph|code)\s+)?["']?(.+?)["']?\s+(?:to\s+(?:it|the file|the end))?$/i);
    if (addMatch) {
      const toAdd = addMatch[1].trim();
      if (['txt','md','csv'].includes(f.ext)) f.content += '\n' + toAdd;
      else if (f.ext === 'html') f.content = f.content.replace('</body>', `  <p style="padding:16px 24px">${toAdd}</p>\n</body>`);
      else if (['js','ts','py','sh'].includes(f.ext)) f.content += '\n// ' + toAdd;
      else f.content += '\n' + toAdd;
      store[id] = f;
      return '__HTML__:' + buildCard(id, f) + `<br><small style="color:var(--text-muted)">✓ Content added</small>`;
    }

    return `I understood you want to edit ${f.filename} but I'm not sure how. Try:\n• 'add [text] to it'\n• 'change the title to [name]'\n• 'rename it to [name]'\n• 'make it dark' or 'make it light'\n• 'change the color to blue/red/green/purple'\n• 'replace \\'old\\' with \\'new\\''`;
  }

  function buildCard(id, f) {
    return `<div class="file-card">
      <div class="file-card-icon">${extIcon(f.ext)}</div>
      <div class="file-card-info">
        <span class="file-card-name">${f.filename}</span>
        <div class="file-card-actions">
          <button class="file-btn" onclick="Files.view('${id}')">👁 View</button>
          <button class="file-btn file-btn-dl" onclick="Files.download('${id}')">⬇ Download</button>
        </div>
      </div>
    </div>`;
  }

  return { create, view, download, parse, edit };
})();
