/* ================= helpers + scenery ================= */
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) * (1 - t);
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function hexRgb(h) {
  h = String(h).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgba(h, a) {
  const [r, g, b] = Array.isArray(h) ? h : hexRgb(h);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
let W = 0, H = 0, DPR = 1, groundY = 0, unit = 60;
let now = 0, lastT = 0;

const PALETTES = [
  ['#ff3d7a', '#ff7eb3', '#ffd166', '#ffef8a'],
  ['#1ec8ff', '#2dff9a', '#7ae1ff', '#b8fff0'],
  ['#b44dff', '#ff4ec8', '#ff9ad8', '#e8c4ff'],
  ['#ff5a1f', '#ff9a2e', '#ffd166', '#ffe08a'],
  ['#4d7cff', '#8a5cff', '#c3a6ff', '#9ad8ff'],
  ['#8adf2a', '#3dff88', '#d4ff4d', '#fff47a'],
  ['#ff2d7a', '#20d0ff', '#ffe066', '#ff9ad8'],
  ['#ff6ea0', '#ffb347', '#ffd1a1', '#ffe08a']
];

/* ---- glow sprites (white + a few tints), reused every frame ---- */
let glowW, glowCore;
function makeRadial(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const grd = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [p, col] of stops) grd.addColorStop(p, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}
function initSprites() {
  glowW = makeRadial(64, [[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,255,255,.9)'], [0.42, 'rgba(255,255,255,.28)'], [1, 'rgba(255,255,255,0)']]);
  glowCore = makeRadial(32, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);
}

function drawGlow(x, y, size, color, alpha) {
  const s = Math.max(2, size);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  // tinted soft disc via a compact radial – cheaper than shadowBlur
  ctx.beginPath();
  ctx.arc(x, y, s, 0, TAU);
  ctx.fill();
  if (s > 2.2) {
    ctx.globalAlpha = alpha * 0.9;
    ctx.drawImage(glowCore, x - s * 0.55, y - s * 0.55, s * 1.1, s * 1.1);
  }
}

/* ---- scenery caches ---- */
let skyCanvas = null, cityCanvas = null, cacheKey = '';
let stars = [], buildings = [], hills = [];
let moon = { x: 0, y: 0, r: 60, phase: 0, winkUntil: 0, winkEye: 1, giggleUntil: 0, giggleT0: 0 };
let shooting = null;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function layout() {
  W = window.innerWidth;
  H = window.innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  const portrait = H > W * 1.05;
  groundY = portrait ? H * 0.92 : H * 0.90;
  unit = Math.min(W, H) / 12;
  moon.r = Math.min(Math.min(W, H) * (portrait ? 0.13 : 0.145), H * 0.17, W * 0.14);
  moon.x = W * (portrait ? 0.78 : 0.84);
  moon.y = Math.max(moon.r + 16, H * (portrait ? 0.155 : 0.24));
  const key = W + 'x' + H + 'x' + DPR;
  if (key !== cacheKey) {
    cacheKey = key;
    rebuildScenery();
  }
}

function rebuildScenery() {
  const rng = mulberry32(0x5F1E2 ^ (Math.round(W) * 97 + Math.round(H)));
  // stars
  stars = [];
  const nStar = Math.round(80 + Math.min(W, H) * 0.12);
  for (let i = 0; i < nStar; i++) {
    stars.push({
      x: rng() * W,
      y: rng() * groundY * 0.92,
      s: rng() < 0.15 ? rng() * 1.6 + 1.3 : rng() * 0.9 + 0.4,
      tw: rng() * TAU,
      sp: rng() * 1.8 + 0.6,
      spark: rng() < 0.08
    });
  }
  // hills: 2 rolling layers just behind the city
  hills = [];
  for (let layer = 0; layer < 2; layer++) {
    const pts = [];
    const base = groundY - (layer === 0 ? H * 0.1 : H * 0.055);
    const amp = (layer === 0 ? H * 0.06 : H * 0.04);
    const steps = 8 + layer * 2;
    for (let i = 0; i <= steps; i++) {
      pts.push({ x: (i / steps) * W, y: base - Math.abs(Math.sin(i * 1.2 + layer * 2.1 + rng())) * amp - rng() * amp * 0.35 });
    }
    hills.push({ pts, col: layer === 0 ? '#14102c' : '#0e0b22' });
  }
  // city
  buildings = [];
  let x = -8;
  const maxH = (groundY - H * 0.62);
  while (x < W + 20) {
    const w = 16 + rng() * Math.min(52, W * 0.07);
    const h = 28 + rng() * maxH;
    const floors = Math.max(2, Math.floor(h / 14));
    const cols = Math.max(1, Math.floor(w / 11));
    const windows = [];
    for (let fy = 0; fy < floors; fy++) {
      for (let cx = 0; cx < cols; cx++) {
        if (rng() < 0.22) continue;
        windows.push({
          fx: (cx + 0.5) / cols,
          fy: (fy + 0.55) / floors,
          lit: rng() < 0.62,
          phase: rng() * 20,
          ww: 0.28 / cols,
          hh: 0.28 / floors
        });
      }
    }
    const roofs = ['flat', 'flat', 'tri', 'tri', 'dome', 'anten'];
    buildings.push({ x, w, h, roof: roofs[Math.floor(rng() * roofs.length)], windows, seed: rng() });
    x += w + 2 + rng() * 10;
  }

  // sky + hills cache
  skyCanvas = document.createElement('canvas');
  skyCanvas.width = canvas.width;
  skyCanvas.height = canvas.height;
  const sg = skyCanvas.getContext('2d');
  sg.setTransform(DPR, 0, 0, DPR, 0, 0);
  const sky = sg.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#07061a');
  sky.addColorStop(0.35, '#120c32');
  sky.addColorStop(0.7, '#1c1348');
  sky.addColorStop(0.88, '#2a1860');
  sky.addColorStop(1, '#3a1d58');
  sg.fillStyle = sky;
  sg.fillRect(0, 0, W, H);
  // soft nebulae
  function nebula(x, y, r, col) {
    const g = sg.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = g;
    sg.fillRect(x - r, y - r, r * 2, r * 2);
  }
  nebula(W * 0.28, H * 0.22, Math.max(W, H) * 0.38, 'rgba(80,40,140,.28)');
  nebula(W * 0.7, H * 0.12, Math.max(W, H) * 0.28, 'rgba(40,70,140,.2)');
  nebula(W * 0.5, H * 0.55, Math.max(W, H) * 0.32, 'rgba(90,30,90,.16)');
  // hills
  for (const hill of hills) {
    sg.beginPath();
    sg.moveTo(0, H);
    sg.lineTo(hill.pts[0].x, hill.pts[0].y);
    for (const p of hill.pts) sg.lineTo(p.x, p.y);
    sg.lineTo(W, H);
    sg.closePath();
    sg.fillStyle = hill.col;
    sg.fill();
  }

  // city silhouette cache (no windows)
  cityCanvas = document.createElement('canvas');
  cityCanvas.width = canvas.width;
  cityCanvas.height = canvas.height;
  const cg = cityCanvas.getContext('2d');
  cg.setTransform(DPR, 0, 0, DPR, 0, 0);
  cg.fillStyle = '#080616';
  for (const b of buildings) drawBuildingBody(cg, b);
  // ground strip
  cg.fillStyle = '#060412';
  cg.fillRect(0, groundY - 2, W, H - groundY + 2);
  // a few tiny ground shrubs / lamp hints
  cg.fillStyle = '#0a0818';
  for (let i = 0; i < 8; i++) {
    const lx = (i + 0.5) / 8 * W + (i % 2 ? 12 : -8);
    cg.fillRect(lx, groundY - 18, 3, 18);
    cg.beginPath();
    cg.arc(lx + 1.5, groundY - 20, 4, 0, TAU);
    cg.fillStyle = 'rgba(255,210,100,.18)';
    cg.fill();
    cg.fillStyle = '#0a0818';
  }
}

function drawBuildingBody(g, b) {
  const x = b.x, y = groundY - b.h, w = b.w, h = b.h;
  g.fillStyle = '#080616';
  g.fillRect(x, y, w, h + 3);
  if (b.roof === 'tri') {
    g.beginPath();
    g.moveTo(x - 2, y);
    g.lineTo(x + w / 2, y - Math.min(22, w * 0.7));
    g.lineTo(x + w + 2, y);
    g.closePath();
    g.fill();
  } else if (b.roof === 'dome') {
    g.beginPath();
    g.ellipse(x + w / 2, y + 1, w * 0.42, Math.min(16, w * 0.35), 0, TAU * 0.5, TAU, true);
    g.fill();
  } else if (b.roof === 'anten') {
    g.fillRect(x + w * 0.45, y - 16, 2, 16);
    g.beginPath();
    g.arc(x + w * 0.45 + 1, y - 16, 2.4, 0, TAU);
    g.fill();
  } else {
    // flat, maybe a parapet
    g.fillRect(x - 1, y - 3, w + 2, 4);
  }
}

function drawStars() {
  for (const s of stars) {
    const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now * s.sp + s.tw));
    ctx.globalAlpha = tw;
    ctx.fillStyle = '#fff8e8';
    if (s.spark) {
      const r = s.s * (0.8 + 0.4 * tw);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r * 2.2);
      ctx.lineTo(s.x + r * 0.35, s.y);
      ctx.lineTo(s.x, s.y + r * 2.2);
      ctx.lineTo(s.x - r * 0.35, s.y);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s.x - r * 2.2, s.y);
      ctx.lineTo(s.x, s.y + r * 0.35);
      ctx.lineTo(s.x + r * 2.2, s.y);
      ctx.lineTo(s.x, s.y - r * 0.35);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  if (shooting) {
    const s = shooting;
    const u = (now - s.t0) / s.dur;
    if (u >= 1) shooting = null;
    else {
      const x = lerp(s.x0, s.x1, u), y = lerp(s.y0, s.y1, u);
      const a = (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba('#fff4d0', a * 0.85);
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - s.dx * 0.08, y - s.dy * 0.08);
      ctx.stroke();
      ctx.fillStyle = rgba('#fff', a);
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  } else if (Math.random() < 0.003) {
    const x0 = rand(W * 0.05, W * 0.7), y0 = rand(10, groundY * 0.35);
    shooting = { t0: now, dur: rand(0.6, 1.1), x0, y0, x1: x0 + rand(80, 220), y1: y0 + rand(30, 90), dx: 140, dy: 50 };
  }
}

function drawMoon() {
  const m = moon;
  const gig = now < m.giggleUntil ? Math.sin((now - m.giggleT0) * 18) * 2.2 : 0;
  const bounce = Math.sin(now * 0.7 + m.phase) * 2.2 + gig;
  const x = m.x, y = m.y + bounce, r = m.r;
  ctx.save();
  // glow
  const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.4);
  g.addColorStop(0, 'rgba(255,236,170,.42)');
  g.addColorStop(0.45, 'rgba(255,220,140,.12)');
  g.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, TAU);
  ctx.fill();
  // body
  const body = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
  body.addColorStop(0, '#fff6c8');
  body.addColorStop(0.6, '#ffe58a');
  body.addColorStop(1, '#f0c45a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  // soft craters
  ctx.fillStyle = 'rgba(210,160,60,.22)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.28, y + r * 0.18, r * 0.18, r * 0.13, -0.4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + r * 0.32, y - r * 0.08, r * 0.12, r * 0.09, 0.3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + r * 0.08, y + r * 0.42, r * 0.1, r * 0.07, 0, 0, TAU); ctx.fill();
  // cheeks
  const giggleOpen = now < m.giggleUntil ? clamp((m.giggleUntil - now) / 0.7, 0, 1) : 0;
  ctx.fillStyle = rgba('#ff9aa2', 0.45 + giggleOpen * 0.25);
  ctx.beginPath(); ctx.ellipse(x - r * 0.42, y + r * 0.22, r * 0.16, r * 0.12, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + r * 0.42, y + r * 0.22, r * 0.16, r * 0.12, 0, 0, TAU); ctx.fill();
  // eyes
  ctx.fillStyle = '#3a2040';
  ctx.strokeStyle = '#3a2040';
  ctx.lineWidth = Math.max(2, r * 0.055);
  ctx.lineCap = 'round';
  const winking = now < m.winkUntil;
  function sleepyEye(ex, ey, side) {
    const winkingNow = winking && side === m.winkEye;
    ctx.save();
    ctx.lineCap = 'round';
    if (giggleOpen > 0.4) {
      ctx.strokeStyle = '#3a2040';
      ctx.lineWidth = Math.max(2, r * 0.06);
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.13, ey + r * 0.04);
      ctx.quadraticCurveTo(ex, ey - r * 0.1, ex + r * 0.13, ey + r * 0.04);
      ctx.stroke();
    } else if (winkingNow) {
      ctx.strokeStyle = '#3a2040';
      ctx.lineWidth = Math.max(2, r * 0.06);
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.14, ey + r * 0.02);
      ctx.quadraticCurveTo(ex, ey + r * 0.05, ex + r * 0.14, ey + r * 0.02);
      ctx.stroke();
    } else {
      // visible eye white + pupil, then a heavy sleepy lid covering the top half
      ctx.fillStyle = '#fffdf6';
      ctx.beginPath();
      ctx.ellipse(ex, ey + r * 0.025, r * 0.135, r * 0.11, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#3a2040';
      ctx.beginPath();
      ctx.ellipse(ex + side * r * 0.015, ey + r * 0.04, r * 0.07, r * 0.075, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex - r * 0.02, ey + r * 0.015, r * 0.028, 0, TAU);
      ctx.fill();
      // droopy lid (moon-coloured) covering the upper half of the eye
      ctx.fillStyle = '#ffe58a';
      ctx.beginPath();
      ctx.ellipse(ex, ey - r * 0.02, r * 0.16, r * 0.12, 0, Math.PI, TAU);
      ctx.fill();
      // lid edge
      ctx.strokeStyle = '#3a2040';
      ctx.lineWidth = Math.max(2, r * 0.05);
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.145, ey + r * 0.01);
      ctx.quadraticCurveTo(ex, ey + r * 0.07, ex + r * 0.145, ey + r * 0.01);
      ctx.stroke();
    }
    ctx.restore();
  }
  sleepyEye(x - r * 0.28, y - r * 0.08, -1);
  sleepyEye(x + r * 0.28, y - r * 0.08, 1);
  // smile
  ctx.strokeStyle = '#3a2040';
  ctx.lineWidth = Math.max(2, r * 0.055);
  ctx.beginPath();
  if (giggleOpen > 0.15) {
    ctx.fillStyle = '#3a2040';
    ctx.ellipse(x, y + r * 0.32, r * 0.16, r * (0.08 + 0.1 * giggleOpen), 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff8a9a';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.36, r * 0.1, r * 0.06 * giggleOpen, 0, 0, Math.PI);
    ctx.fill();
  } else {
    ctx.arc(x, y + r * 0.18, r * 0.28, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

function moonHit(x, y) {
  const dx = x - moon.x, dy = y - moon.y;
  return dx * dx + dy * dy <= moon.r * moon.r * 1.6;
}
function moonWink() {
  moon.winkUntil = now + 0.55;
  moon.winkEye = Math.random() < 0.5 ? -1 : 1;
}
function moonGiggle() {
  moon.giggleUntil = now + 0.85;
  moon.giggleT0 = now;
  sfxGiggle();
}

function drawCityLive() {
  ctx.drawImage(cityCanvas, 0, 0, W, H);
  // windows
  for (const b of buildings) {
    for (const w of b.windows) {
      const flicker = 0.75 + 0.25 * Math.sin(now * (0.4 + (w.phase % 1)) + w.phase);
      const on = w.lit && flicker > 0.58;
      if (!on) continue;
      const wx = b.x + w.fx * b.w;
      const wy = groundY - b.h + w.fy * b.h;
      const ww = Math.max(2, b.w * w.ww);
      const hh = Math.max(2, b.h * w.hh);
      ctx.fillStyle = rgba('#ffe08a', 0.7 + 0.25 * flicker);
      ctx.fillRect(wx - ww / 2, wy - hh / 2, ww, hh);
    }
  }
}

function drawHud() {
  const pad = Math.max(14, Math.min(28, H * 0.03));
  const x = pad + (window.visualViewport ? 0 : 0);
  const y = Math.max(pad, (typeof window !== 'undefined' && window.visualViewport) ? 0 : 0) + Math.max(12, 10);
  const safeTop = 10 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)')) || 0);
  const hx = Math.max(16, W * 0.03);
  const hy = Math.max(18, safeTop + 8);
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.font = '700 ' + Math.round(Math.min(28, unit * 0.55)) + 'px system-ui,sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const label = '✦  ' + score;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillText(label, hx + 1, hy + 15);
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText(label, hx, hy + 14);
  if (finaleFlash > 0) {
    ctx.globalAlpha = clamp(finaleFlash, 0, 1);
    ctx.font = '800 ' + Math.round(Math.min(44, unit * 0.9)) + 'px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff6c8';
    ctx.strokeStyle = 'rgba(80,30,100,.45)';
    ctx.lineWidth = 6;
    ctx.strokeText('Finale!', W / 2, H * 0.18);
    ctx.fillText('Finale!', W / 2, H * 0.18);
  }
  if (hintOn) {
    const a = 0.65 + 0.25 * Math.sin(now * 2.2);
    ctx.globalAlpha = a;
    ctx.font = '600 ' + Math.round(Math.min(22, unit * 0.42)) + 'px system-ui,sans-serif';
    ctx.textAlign = 'center';
    const hy2 = Math.min(groundY - Math.min(H * 0.22, 140), H * 0.52);
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(8,6,24,.55)';
    ctx.strokeText('Tap the sky!  ·  swipe for sparklers', W / 2, hy2);
    ctx.fillStyle = '#efe6ff';
    ctx.fillText('Tap the sky!  ·  swipe for sparklers', W / 2, hy2);
  }
  ctx.restore();
}

function launchRoof(targetX) {
  // nearest rooftop to the tap's x, with a little randomness
  let best = null, bestD = 1e9;
  for (const b of buildings) {
    const cx = b.x + b.w * 0.5;
    const d = Math.abs(cx - targetX);
    if (d < bestD) { bestD = d; best = b; }
  }
  if (!best) return { x: clamp(targetX, 8, W - 8), y: groundY };
  return { x: best.x + best.w * 0.5, y: groundY - best.h - 2 };
}
