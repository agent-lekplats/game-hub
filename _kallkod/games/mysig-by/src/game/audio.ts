// Tiny procedural sound effects via Web Audio. No assets required.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
const lastPlayed: Record<string, number> = {};
let budget = 0, budgetT = 0;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
  } catch { ctx = null; }
}
export function setMuted(m: boolean) { muted = m; if (master) master.gain.value = m ? 0 : 0.35; }
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

type SfxName = 'click' | 'place' | 'upgrade' | 'pass' | 'deliver' | 'error' | 'victory' | 'defeat' | 'elephant' | 'coin' | 'chop' | 'hammer' | 'goal' | 'march' | 'unlock' | 'pickup';

function tone(freq: number, dur: number, type: OscillatorType, vol: number, t0: number, slide = 0, attack = 0.005) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur: number, vol: number, t0: number, freq = 1200) {
  if (!ctx || !master) return;
  const n = Math.floor(ctx.sampleRate * dur); const buf = ctx.createBuffer(1, n, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const g = ctx.createGain(); g.gain.value = vol; src.connect(f); f.connect(g); g.connect(master); src.start(t0);
}

export function sfx(name: SfxName, vol = 1) {
  if (!ctx || !master || muted) return;
  const now = ctx.currentTime;
  const perf = performance.now();
  if (perf - budgetT > 250) { budget = 0; budgetT = perf; }
  if (budget > 10) return; budget++;
  const minGap: Partial<Record<SfxName, number>> = { pass: 70, deliver: 120, chop: 200, hammer: 200, pickup: 90, coin: 100 };
  const gap = minGap[name] || 30;
  if (lastPlayed[name] && perf - lastPlayed[name] < gap) return;
  lastPlayed[name] = perf;
  switch (name) {
    case 'click': tone(880, 0.05, 'square', 0.05 * vol, now); break;
    case 'place': noise(0.12, 0.25 * vol, now, 400); tone(140, 0.18, 'triangle', 0.25 * vol, now, -60); break;
    case 'upgrade': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.16 * vol, now + i * 0.07)); noise(0.2, 0.15, now, 600); break;
    case 'pass': tone(1400 + Math.random() * 500, 0.035, 'sine', 0.045 * vol, now, -400); break;
    case 'pickup': tone(700 + Math.random() * 200, 0.05, 'triangle', 0.05 * vol, now, 200); break;
    case 'deliver': tone(1046, 0.09, 'sine', 0.08 * vol, now); tone(1568, 0.12, 'sine', 0.06 * vol, now + 0.05); break;
    case 'coin': tone(1760, 0.08, 'square', 0.04 * vol, now); tone(2349, 0.15, 'square', 0.035 * vol, now + 0.06); break;
    case 'error': tone(160, 0.2, 'sawtooth', 0.08 * vol, now, -40); break;
    case 'chop': noise(0.06, 0.2 * vol, now, 900); tone(220, 0.06, 'triangle', 0.08 * vol, now, -80); break;
    case 'hammer': tone(1800, 0.05, 'square', 0.04 * vol, now, -600); noise(0.05, 0.12 * vol, now, 3000); break;
    case 'victory': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18 * vol, now + i * 0.12)); break;
    case 'defeat': [400, 350, 300, 220].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.08 * vol, now + i * 0.18, -30)); break;
    case 'elephant': tone(180, 0.6, 'sawtooth', 0.12 * vol, now, 260, 0.1); tone(90, 0.7, 'triangle', 0.15 * vol, now, 60); break;
    case 'goal': [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'sine', 0.14 * vol, now + i * 0.09)); break;
    case 'unlock': [659, 880, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12 * vol, now + i * 0.1)); break;
    case 'march': for (let i = 0; i < 4; i++) noise(0.08, 0.15 * vol, now + i * 0.22, 300); tone(196, 0.5, 'triangle', 0.08 * vol, now); break;
  }
}
