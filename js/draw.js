const Draw = (() => {
  let canvas, ctx, drawing = false;
  let onSubmit = null;

  function init() {
    canvas = document.getElementById('draw-canvas');
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#e8956d';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointerleave', stop);

    document.getElementById('draw-btn').addEventListener('click', () => open(null));
    document.getElementById('draw-clear').addEventListener('click', clear);
    document.getElementById('draw-cancel').addEventListener('click', () => {
      document.getElementById('draw-modal').classList.add('hidden');
    });
    document.getElementById('draw-submit').addEventListener('click', submit);
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

  function start(e) { drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(e)  { if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
  function stop()   { drawing = false; }
  function clear()  { ctx.clearRect(0, 0, canvas.width, canvas.height); }

  function open(callback) {
    clear();
    onSubmit = callback;
    document.getElementById('draw-modal').classList.remove('hidden');
  }

  function submit() {
    const dataUrl = canvas.toDataURL('image/png');
    document.getElementById('draw-modal').classList.add('hidden');
    if (onSubmit) onSubmit(dataUrl);
    else Chat.addMessage('user', '<img src="' + dataUrl + '" style="max-width:200px;border-radius:6px;" />', true);
  }

  return { init, open };
})();
