const Photo = (() => {
  let canvas, ctx, drawing = false;
  // Stroke tracking for DrawAnalyzer (mirrors draw.js).
  let strokeCount = 0, totalPoints = 0, startTime = 0;

  function init() {
    canvas = document.getElementById('photo-canvas');
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#e8956d';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointerleave', stop);

    document.getElementById('attach-photo-btn').addEventListener('click', open);
    document.getElementById('photo-clear').addEventListener('click', clear);
    document.getElementById('photo-cancel').addEventListener('click', () => {
      document.getElementById('photo-modal').classList.add('hidden');
    });
    document.getElementById('photo-submit').addEventListener('click', submit);
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function start(e) {
    drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
    if (!startTime) startTime = Date.now();
    strokeCount++;
  }
  function move(e)  {
    if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
    totalPoints++;
  }
  function stop()   { drawing = false; }
  function clear()  {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokeCount = 0; totalPoints = 0; startTime = 0;
  }

  function open() {
    clear();
    document.getElementById('photo-desc').value = '';
    document.getElementById('photo-modal').classList.remove('hidden');
  }

  function submit() {
    const desc = document.getElementById('photo-desc').value.trim();
    const hasDrawing = isCanvasUsed();
    document.getElementById('photo-modal').classList.add('hidden');

    let userMsg = '';
    if (hasDrawing) {
      const dataUrl = canvas.toDataURL('image/png');
      userMsg += '<img src="' + dataUrl + '" style="max-width:200px;border-radius:6px;display:block;margin-bottom:6px;" />';
    }
    if (desc) userMsg += desc;
    if (!userMsg) return;
    Chat.addMessage('user', userMsg, true);

    // Route through the same analyzer + conversational flow as the ✏️ pad.
    // A bundled description (if typed) rides along in the envelope so Joe
    // observes the drawing AND reacts to the description in one reply.
    let analysis = { empty: true };
    if (hasDrawing) {
      try {
        const strokeStats = {
          strokeCount,
          totalPoints,
          durationMs: startTime ? Date.now() - startTime : 0
        };
        analysis = (typeof DrawAnalyzer !== 'undefined')
          ? DrawAnalyzer.analyze(canvas, strokeStats)
          : { empty: false };
      } catch (e) { /* keep empty fallback */ }
    }
    if (desc) analysis.describedAs = desc;
    Chat.processResponse('__DRAWING__:' + JSON.stringify(analysis));
  }

  function isCanvasUsed() {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return data.some(v => v !== 0);
  }

  return { init };
})();
