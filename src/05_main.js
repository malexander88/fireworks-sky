/* ================= game loop + input ================= */
let pointer = null; // {x,y,sx,sy,sparkler,id}
let running = false;

function onPointerDown(ev) {
  ev.preventDefault();
  unlockAudio();
  const t = ev.changedTouches ? ev.changedTouches[0] : ev;
  const x = t.clientX, y = t.clientY;
  // ignore the credits button
  const el = document.elementFromPoint(x, y);
  if (el && (el.id === 'credits' || el.id === 'creditPanel' || (el.closest && el.closest('#creditPanel')))) return;
  pointer = { x, y, sx: x, sy: y, sparkler: false, id: t.identifier, lastEmit: 0 };
}
function onPointerMove(ev) {
  if (!pointer) return;
  ev.preventDefault();
  const t = ev.changedTouches ? findTouch(ev, pointer.id) : ev;
  if (!t) return;
  const x = t.clientX, y = t.clientY;
  const dx = x - pointer.sx, dy = y - pointer.sy;
  if (!pointer.sparkler && Math.hypot(dx, dy) > 14) pointer.sparkler = true;
  if (pointer.sparkler) {
    const vx = (x - pointer.x) / Math.max(0.008, now - (pointer.lastT || now));
    const vy = (y - pointer.y) / Math.max(0.008, now - (pointer.lastT || now));
    if (now - pointer.lastEmit > 0.016) {
      emitSparkler(x, y, vx, vy);
      pointer.lastEmit = now;
    }
  }
  pointer.x = x; pointer.y = y; pointer.lastT = now;
}
function onPointerUp(ev) {
  if (!pointer) return;
  ev.preventDefault();
  const t = ev.changedTouches ? findTouch(ev, pointer.id) : ev;
  const x = t ? t.clientX : pointer.x;
  const y = t ? t.clientY : pointer.y;
  if (!pointer.sparkler) handleTap(x, y);
  pointer = null;
}
function findTouch(ev, id) {
  const list = ev.changedTouches || ev.touches;
  if (!list) return ev;
  for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
  return list[0];
}

function handleTap(x, y) {
  hintOn = false;
  // tapping the moon is a little easter egg
  if (moonHit(x, y) && now - lastMoonReact > 0.6) {
    lastMoonReact = now;
    moonGiggle();
  }
  launchRocket(x, y);
  score += 1;
  tapsSinceFinale += 1;
  if (tapsSinceFinale >= 20 && !finale) {
    tapsSinceFinale = 0;
    startFinale();
  }
}

function frame(ts) {
  const tsec = ts * 0.001;
  const dt = clamp(tsec - (lastT || tsec), 0, 0.05);
  lastT = tsec;
  now = tsec;
  if (finaleFlash > 0) finaleFlash = Math.max(0, finaleFlash - dt * 0.7);
  tickMusic();
  updateFinale();
  updateRockets();
  updateParticles(dt);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (skyCanvas) ctx.drawImage(skyCanvas, 0, 0, W, H);
  else { ctx.fillStyle = '#0a0820'; ctx.fillRect(0, 0, W, H); }
  drawStars();
  drawMoon();
  drawRockets();
  drawParticles();
  if (cityCanvas) drawCityLive();
  drawSparklerTrail();
  drawHud();
  requestAnimationFrame(frame);
}

function boot() {
  initSprites();
  layout();
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 120));
  const cv = canvas;
  cv.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
  cv.addEventListener('touchstart', onPointerDown, { passive: false });
  window.addEventListener('touchmove', onPointerMove, { passive: false });
  window.addEventListener('touchend', onPointerUp, { passive: false });
  window.addEventListener('touchcancel', onPointerUp, { passive: false });
  // credits
  const btn = document.getElementById('credits');
  const panel = document.getElementById('creditPanel');
  panel.innerHTML = CREDITS_HTML;
  btn.addEventListener('click', ev => {
    ev.stopPropagation();
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  });
  panel.addEventListener('click', () => { panel.style.display = 'none'; });
  requestAnimationFrame(frame);
}

window.__FW = {
  tap(x, y) { handleTap(x, y); },
  burst(x, y, type, pal, scale) { burst(x, y, type, pal, scale); },
  launch(x, y, type) { launchRocket(x, y, type); },
  finale() { tapsSinceFinale = 20; if (!finale) { tapsSinceFinale = 0; startFinale(); } },
  state() {
    return {
      score, particles: particles.length, rockets: rockets.length,
      finale: !!finale, types: TYPES.slice(), W, H, groundY,
      moon: { x: moon.x, y: moon.y, r: moon.r },
      wink: now < moon.winkUntil, giggle: now < moon.giggleUntil
    };
  }
};

boot();
