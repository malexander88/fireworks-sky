/* ================= fireworks, rockets, sparklers ================= */
const MAXP = 1100;
const particles = [];
const rockets = [];
const sparklerPts = [];
const pool = [];
let score = 0, hintOn = true, finaleFlash = 0;
let tapsSinceFinale = 0;
let finale = null; // { t0, launched, plan:[{delay,x,y,type}] }
let lastMoonReact = -10;

function P() {
  return pool.pop() || {
    x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 4, g: 200,
    r: 255, gcol: 200, b: 80, fade: 1, drag: 0.5, kind: 'dot',
    px: 0, py: 0, twinkle: 0, delay: 0, spin: 0, seed: 0
  };
}
function release(p) { pool.push(p); }

function cullIfNeeded(need) {
  const room = MAXP - particles.length;
  if (room >= need) return;
  const extra = need - room;
  // drop the most faded first
  particles.sort((a, b) => (a.life / a.max) - (b.life / b.max));
  const n = Math.min(extra, Math.floor(particles.length * 0.25));
  for (let i = 0; i < n; i++) release(particles.pop());
}

function parseCol(col) {
  if (!col) return [255, 255, 255];
  if (Array.isArray(col)) return col;
  if (typeof col === 'string' && col[0] !== '#') {
    const m = col.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : [255, 255, 255];
  }
  return hexRgb(col);
}
function addParticle(opt) {
  if (particles.length >= MAXP) {
    const old = particles.pop();
    release(old);
  }
  const p = P();
  p.x = opt.x; p.y = opt.y;
  p.px = opt.x; p.py = opt.y;
  p.vx = opt.vx || 0; p.vy = opt.vy || 0;
  p.life = 0; p.max = opt.max || 1;
  p.size = opt.size || 3;
  p.g = opt.g == null ? 220 : opt.g;
  const rgb = parseCol(opt.col);
  p.r = rgb[0]; p.gcol = rgb[1]; p.b = rgb[2];
  p.fade = 1; p.drag = opt.drag == null ? 0.55 : opt.drag;
  p.kind = opt.kind || 'dot';
  p.twinkle = opt.twinkle || 0;
  p.delay = opt.delay || 0;
  p.spin = opt.spin || 0;
  p.seed = opt.seed || Math.random();
  particles.push(p);
  return p;
}

const TYPES = ['peony', 'ring', 'heart', 'star', 'smiley', 'spiral', 'crackle', 'willow', 'multi'];

function heartPt(t, s) {
  // classic parametric heart, t in 0..TAU, y up is negative on canvas so flip
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  return { x: x * s / 16, y: y * s / 16 };
}
function starPt(k, n, s) {
  // k in 0..n along a 5-point star outline
  const tips = 5, segs = n / (tips * 2);
  const i = k / (n / (tips * 2));
  const a0 = -Math.PI / 2;
  const step = TAU / tips;
  const seg = Math.floor(k / (n / (tips * 2)));
  const tip = Math.floor(seg / 2);
  const odd = seg % 2;
  const f = (k / (n / (tips * 2))) - seg;
  const r1 = s, r2 = s * 0.4;
  const a1 = a0 + tip * step;
  const a2 = a0 + (tip + 0.5) * step;
  const a3 = a0 + (tip + 1) * step;
  let a, r;
  if (!odd) { a = lerp(a1, a2, f); r = lerp(r1, r2, f); }
  else { a = lerp(a2, a3, f); r = lerp(r2, r1, f); }
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

function burst(x, y, type, pal, scale) {
  type = type || pick(TYPES);
  pal = pal || pick(PALETTES);
  scale = scale || rand(0.85, 1.2);
  const col = () => pick(pal);
  const speed = unit * 3.6 * scale;
  if (type === 'peony') {
    const n = randi(70, 110);
    cullIfNeeded(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.05, 0.05);
      const sp = speed * (Math.random() < 0.28 ? rand(0.12, 0.45) : rand(0.55, 1.05));
      addParticle({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, max: rand(0.9, 1.6), size: rand(2.4, 5.2) * scale, col: col(), g: 180, kind: 'dot' });
    }
    sfxBoom(0.7);
  } else if (type === 'ring') {
    const n = randi(44, 64);
    cullIfNeeded(n);
    const sp = speed * rand(0.75, 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      addParticle({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, max: rand(1.0, 1.5), size: rand(2.6, 4.8) * scale, col: col(), g: 80, drag: 0.7, kind: 'dot' });
    }
    sfxPop();
  } else if (type === 'heart') {
    const n = randi(56, 84);
    cullIfNeeded(n);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU;
      const pt = heartPt(t, unit * 0.34 * scale);
      const sp = speed * 0.55;
      // outward from shape
      addParticle({ x: x + pt.x, y: y + pt.y, vx: pt.x * sp * 0.08 + rand(-8, 8), vy: pt.y * sp * 0.08 + rand(-8, 8), max: rand(1.1, 1.7), size: rand(2.6, 5) * scale, col: col(), g: 140, kind: 'dot' });
    }
    sfxPop();
  } else if (type === 'star') {
    const n = randi(50, 80);
    cullIfNeeded(n);
    for (let i = 0; i < n; i++) {
      const pt = starPt(i, n, unit * 0.85 * scale);
      addParticle({ x: x + pt.x * 0.15, y: y + pt.y * 0.15, vx: pt.x * 3.4, vy: pt.y * 3.4, max: rand(1.0, 1.6), size: rand(2.5, 5) * scale, col: col(), g: 120, kind: 'dot' });
    }
    sfxPop();
  } else if (type === 'smiley') {
    const nRing = 48, nEye = 10, nSmile = 20;
    cullIfNeeded(nRing + nEye * 2 + nSmile);
    const R = unit * 0.85 * scale;
    const sp = speed * 0.62;
    for (let i = 0; i < nRing; i++) {
      const a = (i / nRing) * TAU;
      const px = Math.cos(a) * R, py = Math.sin(a) * R;
      addParticle({ x: x + px * 0.12, y: y + py * 0.12, vx: px * 3.2, vy: py * 3.2, max: rand(1.1, 1.6), size: rand(2.8, 5) * scale, col: col(), g: 90, kind: 'dot' });
    }
    for (const eye of [[-0.32, -0.22], [0.32, -0.22]]) {
      for (let i = 0; i < nEye; i++) {
        const a = rand(0, TAU), rr = rand(0, R * 0.1);
        const px = eye[0] * R + Math.cos(a) * rr, py = eye[1] * R + Math.sin(a) * rr;
        addParticle({ x: x + px * 0.12, y: y + py * 0.12, vx: px * 3.2, vy: py * 3.2, max: rand(1.0, 1.5), size: rand(2.4, 4.4) * scale, col: '#3a2040', g: 90, kind: 'dot' });
      }
    }
    for (let i = 0; i < nSmile; i++) {
      const a = lerp(0.25, Math.PI - 0.25, i / (nSmile - 1));
      const px = Math.cos(a) * R * 0.55, py = Math.sin(a) * R * 0.55 + R * 0.05;
      addParticle({ x: x + px * 0.12, y: y + py * 0.12, vx: px * 3.2, vy: py * 3.2, max: rand(1.0, 1.5), size: rand(2.4, 4.4) * scale, col: '#3a2040', g: 90, kind: 'dot' });
    }
    sfxPop();
  } else if (type === 'spiral') {
    const arms = 3, n = 28;
    cullIfNeeded(arms * n);
    const dir = Math.random() < 0.5 ? 1 : -1;
    for (let arm = 0; arm < arms; arm++) {
      for (let i = 0; i < n; i++) {
        const a = dir * (i * 0.28) + (arm * TAU / arms);
        const rad = (i / n) * speed;
        addParticle({ x, y, vx: Math.cos(a) * rad, vy: Math.sin(a) * rad, max: rand(1.2, 1.9), size: rand(2.4, 4.8) * scale, col: pal[i % pal.length], g: 100, drag: 0.4, kind: 'dot', spin: dir * 1.8 });
      }
    }
    sfxPop();
  } else if (type === 'crackle') {
    const n = randi(36, 55);
    cullIfNeeded(n);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = speed * rand(0.3, 0.95);
      addParticle({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, max: rand(0.7, 1.3), size: rand(2, 3.6) * scale, col: col(), g: 160, kind: 'crackle', delay: rand(0.15, 0.55), twinkle: 1 });
    }
    sfxBoom(0.45);
    sfxCrackle(0.7);
  } else if (type === 'willow') {
    const n = randi(48, 70);
    cullIfNeeded(n);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * 0.5 + rand(-1.2, 1.2);
      const sp = speed * rand(0.45, 1.05);
      addParticle({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - speed * 0.15, max: rand(1.8, 2.8), size: rand(2.2, 4) * scale, col: col(), g: 260, drag: 0.25, kind: 'willow' });
    }
    sfxBoom(0.55);
  } else if (type === 'multi') {
    // first ring, then delayed secondary peonies stored as delayed particles
    const n = randi(36, 50);
    cullIfNeeded(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, sp = speed * rand(0.5, 0.9);
      addParticle({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, max: rand(0.7, 1.1), size: rand(2.6, 4.6) * scale, col: col(), g: 80, kind: 'seed', seed: scale, delay: rand(0.28, 0.48) });
    }
    sfxBoom(0.6);
  } else {
    burst(x, y, 'peony', pal, scale);
    return type;
  }
  maybeMoonReact(x, y);
  return type;
}

function maybeMoonReact(x, y) {
  if (now - lastMoonReact < 1.4) return;
  if (moonHit(x, y)) {
    lastMoonReact = now;
    if (Math.random() < 0.55) moonGiggle();
    else moonWink();
  } else if (tapsSinceFinale > 0 && tapsSinceFinale % 9 === 0 && Math.random() < 0.7) {
    lastMoonReact = now;
    if (Math.random() < 0.4) moonGiggle();
    else moonWink();
  }
}

function popSeed(p) {
  const n = randi(14, 22);
  cullIfNeeded(n);
  const pal = pick(PALETTES);
  const sp = unit * 2.2 * (p.seed || 1);
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = sp * rand(0.4, 1);
    addParticle({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, max: rand(0.6, 1.1), size: rand(2, 3.8), col: pick(pal), g: 180, kind: 'dot' });
  }
  sfxPop(0.6);
}

function popCrackle(p) {
  const n = randi(5, 9);
  cullIfNeeded(n);
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = unit * rand(0.6, 1.6);
    addParticle({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, max: rand(0.3, 0.7), size: rand(1.4, 2.8), col: rgba([p.r, p.gcol, p.b], 1), g: 80, kind: 'dot', twinkle: 1 });
  }
}

// rgba() with array works via hexRgb? hexRgb on array would fail. I passed rgba([r,g,b],1) as col to addParticle which does hexRgb(opt.col). That's a bug.
// addParticle should accept rgb arrays too. I'll fix addParticle - already does hexRgb. Let me pass a hex or fix addParticle.

function launchRocket(tx, ty, type, pal, opts) {
  opts = opts || {};
  ty = Math.min(ty, groundY - 30);
  const origin = opts.origin || launchRoof(tx);
  let flight = opts.flight;
  if (flight == null) {
    const dist = Math.hypot(tx - origin.x, ty - origin.y);
    flight = clamp(0.45 + dist / Math.max(H, 200) * 0.7, 0.45, 1.15);
    flight = snapToBeat(flight);
  }
  const palettes = pal || pick(PALETTES);
  rockets.push({
    x: origin.x, y: origin.y, x0: origin.x, y0: origin.y, x1: tx, y1: ty,
    t0: now, flight, type: type || pick(TYPES), pal: palettes,
    scale: opts.scale || rand(0.9, 1.25),
    hue: palettes[0]
  });
  sfxWhoosh(flight);
}

function startFinale() {
  const plan = [];
  const n = randi(10, 14);
  const types = TYPES.slice();
  for (let i = 0; i < n; i++) {
    const marginX = W * 0.08, marginY = H * 0.1;
    plan.push({
      delay: i * rand(0.18, 0.32),
      x: rand(marginX, W - marginX),
      y: rand(marginY, groundY * 0.62),
      type: i === n - 1 ? 'multi' : types[i % types.length],
      scale: i === n - 1 ? 1.45 : rand(0.95, 1.3)
    });
  }
  finale = { t0: now, i: 0, plan };
  finaleFlash = 1.2;
}

function updateFinale() {
  if (!finale) return;
  const t = now - finale.t0;
  while (finale.i < finale.plan.length && t >= finale.plan[finale.i].delay) {
    const p = finale.plan[finale.i++];
    launchRocket(p.x, p.y, p.type, pick(PALETTES), { scale: p.scale });
  }
  if (finale.i >= finale.plan.length && rockets.length === 0) finale = null;
}

function updateRockets() {
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    const u = (now - r.t0) / r.flight;
    if (u >= 1) {
      burst(r.x1, r.y1, r.type, r.pal, r.scale);
      rockets.splice(i, 1);
      continue;
    }
    const e = 1 - Math.pow(1 - u, 1.15);
    r.x = lerp(r.x0, r.x1, e);
    r.y = lerp(r.y0, r.y1, e);
    // spark trail
    if (particles.length < MAXP - 4) {
      addParticle({
        x: r.x + rand(-1.5, 1.5), y: r.y + rand(-1.5, 1.5),
        vx: rand(-12, 12), vy: rand(10, 40),
        max: rand(0.2, 0.45), size: rand(1.6, 3),
        col: pick([r.hue, '#fff4d0', '#ffd166']),
        g: 80, kind: 'dot', drag: 1.2
      });
    }
  }
}

function updateParticles(dt) {
  const Gscale = Math.max(H, 400);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.delay > 0) {
      p.delay -= dt;
      // still drift a little while waiting for crackle/seed pop
      p.px = p.x; p.py = p.y;
      p.vy += p.g * dt * 0.4;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.delay <= 0) {
        if (p.kind === 'seed') { popSeed(p); particles.splice(i, 1); release(p); continue; }
        if (p.kind === 'crackle') popCrackle(p);
      }
    }
    p.life += dt;
    if (p.life >= p.max) { particles.splice(i, 1); release(p); continue; }
    p.px = p.x; p.py = p.y;
    const drag = Math.exp(-p.drag * dt);
    p.vx *= drag;
    p.vy *= drag;
    if (p.spin) {
      const a = Math.atan2(p.vy, p.vx) + p.spin * dt;
      const sp = Math.hypot(p.vx, p.vy);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
    }
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'willow' && Math.random() < 0.12 && particles.length < MAXP - 20) {
      addParticle({
        x: p.x, y: p.y, vx: p.vx * 0.2, vy: p.vy * 0.15,
        max: rand(0.25, 0.5), size: p.size * 0.55,
        col: rgba([p.r, p.gcol, p.b], 1), g: 40, kind: 'dot', drag: 1.5
      });
    }
  }
}

function drawRockets() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const r of rockets) {
    const dx = r.x1 - r.x0, dy = r.y1 - r.y0;
    const ang = Math.atan2(r.y - (r._ly == null ? r.y0 : r._ly), r.x - (r._lx == null ? r.x0 : r._lx));
    r._lx = r.x; r._ly = r.y;
    const a = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.quadraticCurveTo(3.5, -2, 3, 7);
    ctx.lineTo(-3, 7);
    ctx.quadraticCurveTo(-3.5, -2, 0, -8);
    ctx.fill();
    ctx.fillStyle = rgba(r.hue, 0.9);
    ctx.beginPath();
    ctx.arc(0, -3, 2.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const p of particles) {
    if (p.delay > 0 && p.kind === 'seed') {
      // dim while rising to second burst
    }
    const u = clamp(p.life / p.max, 0, 1);
    let a = u < 0.08 ? u / 0.08 : 1 - Math.pow(Math.max(0, (u - 0.55) / 0.45), 1.2);
    if (p.twinkle) a *= 0.55 + 0.45 * Math.abs(Math.sin(now * 28 + p.seed * 10));
    a = clamp(a, 0, 1);
    const col = 'rgb(' + p.r + ',' + p.gcol + ',' + p.b + ')';
    const sz = p.size * (1.05 - u * 0.35);
    // trail
    const dx = p.x - p.px, dy = p.y - p.py;
    if (dx * dx + dy * dy > 1.5) {
      ctx.globalAlpha = a * 0.55;
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1, sz * 0.7);
      ctx.beginPath();
      ctx.moveTo(p.px, p.py);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.fillStyle = col;
    drawGlow(p.x, p.y, sz * 1.35, col, a * 0.4);
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.9, sz * 0.5), 0, TAU);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.globalAlpha = a * 0.75;
    ctx.beginPath();
    ctx.arc(p.x - sz * 0.08, p.y - sz * 0.08, Math.max(0.4, sz * 0.18), 0, TAU);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ---- sparkler swipe ---- */
function emitSparkler(x, y, vx, vy) {
  const n = 6;
  cullIfNeeded(n);
  for (let i = 0; i < n; i++) {
    addParticle({
      x: x + rand(-2, 2), y: y + rand(-2, 2),
      vx: (vx || 0) * 0.25 + rand(-50, 50),
      vy: (vy || 0) * 0.25 + rand(-70, 30),
      max: rand(0.25, 0.7), size: rand(1.6, 3.4),
      col: pick(['#fff4d0', '#ffd166', '#ffe08a', '#fff', '#ffb070']),
      g: 120, kind: 'dot', twinkle: 1, drag: 1.1
    });
  }
  sparklerPts.push({ x, y, t: now });
  if (sparklerPts.length > 40) sparklerPts.shift();
  sfxSparkler();
}

function drawSparklerTrail() {
  // prune
  while (sparklerPts.length && now - sparklerPts[0].t > 0.35) sparklerPts.shift();
  if (sparklerPts.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < sparklerPts.length; i++) {
    const a = 1 - (now - sparklerPts[i].t) / 0.35;
    ctx.strokeStyle = rgba('#fff3c0', clamp(a, 0, 1) * 0.85);
    ctx.lineWidth = 3.5 * a + 1;
    ctx.beginPath();
    ctx.moveTo(sparklerPts[i - 1].x, sparklerPts[i - 1].y);
    ctx.lineTo(sparklerPts[i].x, sparklerPts[i].y);
    ctx.stroke();
  }
  ctx.restore();
}
