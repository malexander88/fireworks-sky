/* ================= audio (all synthesized, no samples) ================= */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let actx = null, master, musicBus, sfxBus, noiseBuf, audioReady = false;
const BPM = 100, SPB = 60 / BPM;
let musicStep = 0, nextNote = 0, musicOn = false, musicStartedAt = 0;
let lastSparkleT = 0;

function makeNoise(seconds) {
  const n = Math.floor(actx.sampleRate * seconds);
  const b = actx.createBuffer(1, n, actx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function initAudio() {
  if (actx) {
    if (actx.state !== 'running' && actx.resume) actx.resume();
    return;
  }
  if (!AudioCtx) return;
  try { actx = new AudioCtx(); } catch (e) { return; }
  const comp = actx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.004;
  comp.release.value = 0.22;
  master = actx.createGain();
  master.gain.value = 0.72;          // overall soft, child-friendly
  musicBus = actx.createGain();
  musicBus.gain.value = 0.22;
  sfxBus = actx.createGain();
  sfxBus.gain.value = 0.7;
  musicBus.connect(comp);
  sfxBus.connect(comp);
  comp.connect(master);
  master.connect(actx.destination);
  noiseBuf = makeNoise(2);
  audioReady = true;
  if (actx.resume) actx.resume();
  startMusic();
  document.addEventListener('visibilitychange', () => {
    if (!actx) return;
    if (document.hidden) { if (actx.suspend) actx.suspend(); }
    else if (actx.resume) actx.resume();
  });
}

function unlockAudio() { initAudio(); }

function envGain(t, peak, a, d, dur) {
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

function noiseSrc(t, dur, filterType, freq0, freq1, q, peak, dest) {
  const src = actx.createBufferSource();
  src.buffer = noiseBuf;
  const f = actx.createBiquadFilter();
  f.type = filterType;
  f.Q.value = q || 1;
  f.frequency.setValueAtTime(freq0, t);
  if (freq1 && freq1 !== freq0) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq1), t + dur);
  const g = envGain(t, peak, 0.012, 0.08, dur);
  src.connect(f); f.connect(g); g.connect(dest || sfxBus);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function tone(t, type, f0, f1, dur, peak, dest) {
  const o = actx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = envGain(t, peak, 0.01, 0.05, dur);
  o.connect(g); g.connect(dest || sfxBus);
  o.start(t); o.stop(t + dur + 0.02);
}

function sfxWhoosh(flight) {
  if (!actx || actx.state !== 'running') return;
  const t = actx.currentTime;
  const dur = clamp((flight || 0.7) * 0.75, 0.28, 0.85);
  noiseSrc(t, dur, 'bandpass', 320, 2200, 1.1, 0.16);
  tone(t, 'sine', 180, 520, dur * 0.85, 0.05);
}

function sfxBoom(scale) {
  if (!actx || actx.state !== 'running') return;
  const t = actx.currentTime;
  const s = scale == null ? 1 : scale;
  tone(t, 'sine', 110 * (0.9 + Math.random() * 0.2), 42, 0.55, 0.2 * s);
  tone(t, 'triangle', 180, 70, 0.28, 0.07 * s);
  noiseSrc(t, 0.32, 'lowpass', 900, 200, 0.7, 0.18 * s);
}

function sfxPop(scale) {
  if (!actx || actx.state !== 'running') return;
  const t = actx.currentTime;
  const s = scale == null ? 1 : scale;
  tone(t, 'sine', 280 + Math.random() * 80, 90, 0.22, 0.11 * s);
  noiseSrc(t, 0.14, 'bandpass', 1400, 600, 0.9, 0.1 * s);
}

function sfxCrackle(scale) {
  if (!actx || actx.state !== 'running') return;
  const t = actx.currentTime;
  const n = 10 + Math.floor(Math.random() * 8);
  for (let i = 0; i < n; i++) {
    const ti = t + 0.04 + i * (0.04 + Math.random() * 0.05);
    noiseSrc(ti, 0.04, 'highpass', 1800, 2400, 0.8, 0.07 * (scale || 1));
  }
}

function sfxSparkler() {
  if (!actx || actx.state !== 'running') return;
  const t = actx.currentTime;
  if (t - lastSparkleT < 0.06) return;
  lastSparkleT = t;
  noiseSrc(t, 0.07, 'highpass', 2500, 3500, 0.7, 0.045);
}

function sfxGiggle() {
  if (!actx || actx.state !== 'running') return;
  const t = actx.currentTime;
  const notes = [523, 659, 784, 698, 880];
  for (let i = 0; i < notes.length; i++) {
    tone(t + i * 0.09, 'sine', notes[i], notes[i] * 1.02, 0.14, 0.07);
    tone(t + i * 0.09, 'triangle', notes[i] * 2, notes[i] * 2, 0.1, 0.02);
  }
}

/* ---- gentle procedural music, 100 BPM, C major twinkles ---- */
const CHORDS = [
  [60, 64, 67, 72], // C
  [57, 60, 64, 69], // Am
  [65, 69, 72, 77], // F
  [67, 71, 74, 79]  // G
];
function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

function startMusic() {
  if (musicOn || !actx) return;
  musicOn = true;
  musicStartedAt = actx.currentTime + 0.08;
  musicStep = 0;
  nextNote = musicStartedAt;
  // schedule on a timer; also tick from the frame loop via tickMusic()
}

function tickMusic() {
  if (!musicOn || !actx || actx.state !== 'running') return;
  const ahead = actx.currentTime + 0.18;
  while (nextNote < ahead) {
    playMusicStep(musicStep, nextNote);
    musicStep++;
    nextNote += SPB / 2; // eighth notes
  }
}

function playMusicStep(step, t) {
  const eighth = step;
  const beat = Math.floor(eighth / 2);
  const bar = Math.floor(beat / 4);
  const chord = CHORDS[bar % 4];
  const inBar = beat % 4;
  const isDown = eighth % 2 === 0;

  // soft pad on each bar downbeat
  if (inBar === 0 && isDown) {
    for (const m of chord.slice(0, 3)) {
      const o = actx.createOscillator();
      o.type = 'sine';
      o.frequency.value = mtof(m);
      const g = actx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.045, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + SPB * 4 * 0.95);
      const f = actx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1200;
      o.connect(g); g.connect(f); f.connect(musicBus);
      o.start(t); o.stop(t + SPB * 4);
    }
  }
  // twinkly arpeggio
  if (isDown || Math.random() < 0.35) {
    const pat = [0, 2, 3, 2, 1, 3, 2, 0];
    const idx = pat[eighth % 8];
    const m = chord[idx] + (eighth % 16 >= 8 ? 12 : 0);
    const o = actx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = mtof(m + 12);
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + 0.45);
  }
  // very soft tick on 2 and 4
  if (isDown && (inBar === 1 || inBar === 3)) {
    noiseSrc(t, 0.04, 'highpass', 4000, 4000, 0.6, 0.03, musicBus);
  }
}

function getBeat() {
  if (!actx || !musicOn || actx.state !== 'running') return 0;
  const lat = actx.outputLatency || 0;
  return (actx.currentTime - lat - musicStartedAt) / SPB;
}

function snapToBeat(delay) {
  if (!actx || !musicOn || actx.state !== 'running') return delay;
  const beat = getBeat();
  const frac = ((beat % 1) + 1) % 1;
  const timeToNext = (1 - frac) * SPB;
  // nudge the burst onto a nearby beat if it's close
  if (Math.abs(timeToNext - delay) < 0.14) return Math.max(0.35, timeToNext);
  const timeToPrev = -frac * SPB;
  if (Math.abs(timeToPrev - delay) < 0.08 && delay + timeToPrev > 0.35) return delay + timeToPrev;
  return delay;
}

const CREDITS_HTML = '<h3>Fireworks Sky – sound credits</h3>'
  + '<p>All sound effects (launch whoosh, burst boom and pop, glitter crackle, sparkler fizz, and the moon’s giggle) are synthesized in the browser with the Web Audio API. No third-party recordings are used.</p>'
  + '<p>Background music is a short, gentle arpeggio also generated in the game (C major, 100 BPM). Firework bursts are loosely nudged onto the beat when they would land close to one.</p>'
  + '<p>No attribution is required. Tap to close.</p>';
