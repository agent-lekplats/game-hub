let ctx: AudioContext | null = null;
let muted = false;
export function setMuted(m: boolean) { muted = m; }
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { ctx = null; } }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}
let last: Record<string, number> = {};
export function sfx(kind: 'chop' | 'deliver' | 'hit' | 'build' | 'coin' | 'conquer' | 'place' | 'spawn' | 'die') {
  if (muted) return;
  const c = ac(); if (!c) return;
  const now = c.currentTime;
  if (last[kind] && now - last[kind] < 0.05) return;
  last[kind] = now;
  const o = c.createOscillator(); const g = c.createGain();
  o.connect(g); g.connect(c.destination);
  const env = (v: number, d: number) => { g.gain.setValueAtTime(v, now); g.gain.exponentialRampToValueAtTime(0.0001, now + d); o.start(now); o.stop(now + d); };
  switch (kind) {
    case 'chop': o.type = 'square'; o.frequency.setValueAtTime(140 + Math.random() * 40, now); o.frequency.exponentialRampToValueAtTime(60, now + 0.08); env(0.05, 0.09); break;
    case 'deliver': o.type = 'sine'; o.frequency.setValueAtTime(520, now); o.frequency.setValueAtTime(780, now + 0.06); env(0.05, 0.16); break;
    case 'hit': o.type = 'sawtooth'; o.frequency.setValueAtTime(220, now); o.frequency.exponentialRampToValueAtTime(90, now + 0.1); env(0.04, 0.1); break;
    case 'build': o.type = 'triangle'; o.frequency.setValueAtTime(300 + Math.random() * 100, now); env(0.04, 0.07); break;
    case 'coin': o.type = 'sine'; o.frequency.setValueAtTime(1046, now); o.frequency.setValueAtTime(1568, now + 0.05); env(0.05, 0.2); break;
    case 'conquer': o.type = 'triangle'; o.frequency.setValueAtTime(392, now); o.frequency.setValueAtTime(523, now + 0.12); o.frequency.setValueAtTime(659, now + 0.24); o.frequency.setValueAtTime(784, now + 0.36); env(0.1, 0.8); break;
    case 'place': o.type = 'sine'; o.frequency.setValueAtTime(330, now); o.frequency.exponentialRampToValueAtTime(220, now + 0.15); env(0.06, 0.18); break;
    case 'spawn': o.type = 'square'; o.frequency.setValueAtTime(440, now); o.frequency.setValueAtTime(660, now + 0.08); env(0.03, 0.15); break;
    case 'die': o.type = 'sawtooth'; o.frequency.setValueAtTime(160, now); o.frequency.exponentialRampToValueAtTime(40, now + 0.25); env(0.05, 0.25); break;
  }
}
export function resetThrottle() { last = {}; }
