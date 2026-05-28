// Mj.ai drawing analyzer (v58). Pure pixel math — no shape recognition.
// Goal: enough quantitative facts to seed a warm conversational opener.
// The output gets framed by brain.js into observations, not numbers.

const DrawAnalyzer = (() => {

  // Map HSL → kid-friendly color names. Coarse on purpose.
  // Hue in 0..360, sat & light in 0..1.
  function nameColor(h, s, l) {
    if (l > 0.9) return 'white';
    if (l < 0.1) return 'black';
    if (s < 0.15) return l < 0.4 ? 'dark grey' : l < 0.7 ? 'grey' : 'light grey';
    const dark = l < 0.35;
    if (h < 15)  return dark ? 'dark red'    : 'red';
    if (h < 40)  return dark ? 'brown'       : 'orange';
    if (h < 70)  return dark ? 'olive'       : 'yellow';
    if (h < 170) return dark ? 'dark green'  : 'green';
    if (h < 200) return dark ? 'teal'        : 'cyan';
    if (h < 260) return dark ? 'dark blue'   : 'blue';
    if (h < 290) return dark ? 'dark purple' : 'purple';
    if (h < 330) return dark ? 'dark pink'   : 'pink';
    return dark ? 'dark red' : 'red';
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      default: h = ((r - g) / d + 4) * 60;
    }
    return [h, s, l];
  }

  function isBackground(r, g, b, a) {
    return a < 16 || (r > 240 && g > 240 && b > 240);
  }

  function analyze(canvas, strokeStats) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;

    // Single pass: collect everything we need.
    const colorBuckets = new Map();
    const zoneInk = new Array(9).fill(0);
    let inked = 0;
    let xmin = w, xmax = 0, ymin = h, ymax = 0;
    let warm = 0, cool = 0, neutral = 0;
    let darkPixels = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if (isBackground(r, g, b, a)) continue;
        inked++;
        if (x < xmin) xmin = x; if (x > xmax) xmax = x;
        if (y < ymin) ymin = y; if (y > ymax) ymax = y;
        const zx = Math.min(2, (x * 3 / w) | 0);
        const zy = Math.min(2, (y * 3 / h) | 0);
        zoneInk[zy * 3 + zx]++;
        const [hh, ss, ll] = rgbToHsl(r, g, b);
        const name = nameColor(hh, ss, ll);
        colorBuckets.set(name, (colorBuckets.get(name) || 0) + 1);
        if (ll < 0.3) darkPixels++;
        // Warm/cool: hue 0-60 (red/orange/yellow) + 300-360 (pink/red) = warm,
        // 150-280 (green/cyan/blue/purple) = cool, else neutral.
        if (ss < 0.15) neutral++;
        else if (hh < 60 || hh >= 300) warm++;
        else if (hh >= 150 && hh < 280) cool++;
        else neutral++;
      }
    }

    if (inked === 0) {
      return { empty: true };
    }

    // Top colors by count.
    const sortedColors = [...colorBuckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const topColors = sortedColors.map(([n]) => n);

    // Coverage and zone busiest.
    const coverage = inked / (w * h);
    const busiestZoneIdx = zoneInk.indexOf(Math.max(...zoneInk));
    const ZONE_NAMES = [
      'top-left', 'top-center', 'top-right',
      'left-middle', 'center', 'right-middle',
      'bottom-left', 'bottom-center', 'bottom-right'
    ];

    // Bounding-box position label.
    const bw = xmax - xmin + 1, bh = ymax - ymin + 1;
    const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
    let position;
    if (bw > w * 0.7 && bh > h * 0.7) position = 'fills the page';
    else if (bw < w * 0.3 && bh < h * 0.3) position = 'small, tucked away';
    else if (cy < h * 0.4) position = 'sitting up high';
    else if (cy > h * 0.6) position = 'down low on the page';
    else if (cx < w * 0.4) position = 'over to the left';
    else if (cx > w * 0.6) position = 'over to the right';
    else position = 'right in the middle';

    // Color temperature.
    let colorTemp;
    const total = warm + cool + neutral;
    if (warm > total * 0.5)      colorTemp = 'warm';
    else if (cool > total * 0.5) colorTemp = 'cool';
    else if (warm > cool * 1.3)  colorTemp = 'mostly warm';
    else if (cool > warm * 1.3)  colorTemp = 'mostly cool';
    else                          colorTemp = 'mixed';
    if (topColors.length === 1) colorTemp = 'one color (' + topColors[0] + ')';

    // Vertical symmetry (cheap version — sample every 4th row, every other col).
    let symMatch = 0, symTotal = 0;
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w / 2; x += 2) {
        const li = (y * w + x) * 4, ri = (y * w + (w - 1 - x)) * 4;
        const la = !isBackground(data[li], data[li+1], data[li+2], data[li+3]);
        const ra = !isBackground(data[ri], data[ri+1], data[ri+2], data[ri+3]);
        if (la || ra) { symTotal++; if (la === ra) symMatch++; }
      }
    }
    const symVertical = symTotal ? symMatch / symTotal : 1;
    let symmetryLabel;
    if (symVertical > 0.85) symmetryLabel = 'very symmetric left-to-right';
    else if (symVertical > 0.65) symmetryLabel = 'pretty symmetric';
    else if (symVertical > 0.45) symmetryLabel = 'a little uneven';
    else symmetryLabel = 'asymmetric';

    // Detail intensity (edge density approximation via per-zone variance fold).
    let intensity;
    if (coverage > 0.30)      intensity = 'busy';
    else if (coverage > 0.10) intensity = 'medium';
    else if (coverage > 0.02) intensity = 'sparse';
    else                       intensity = 'tiny';

    // Mood inference for tone-mapping in the story payoff.
    let mood;
    if (colorTemp === 'warm' || colorTemp === 'mostly warm') mood = 'cozy';
    else if (colorTemp === 'cool' || colorTemp === 'mostly cool') mood = 'mysterious';
    else if (darkPixels > inked * 0.6) mood = 'spooky';
    else if (intensity === 'busy') mood = 'adventure';
    else mood = null;

    return {
      empty: false,
      coverage,
      topColors,
      colorTemp,
      position,
      busiestZone: ZONE_NAMES[busiestZoneIdx],
      symmetryLabel,
      symVertical,
      intensity,
      mood,
      strokeStats: strokeStats || null,
      canvas: { w, h, inked }
    };
  }

  return { analyze, nameColor };
})();
