import type { SfxName } from "./types";

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private drone: { oscs: OscillatorNode[]; gain: GainNode } | null = null;
  muted = false;
  unlocked = false;

  private ac(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();

      // Master Compressor for punchy, heavy, cinematic dynamics
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(8, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.002, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);
      this.compressor.connect(this.ctx.destination);

      this.master = this.ctx.createGain();
      this.master.gain.value = 0.38;
      this.master.connect(this.compressor);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  unlock() {
    const ctx = this.ac();
    if (!ctx || this.unlocked) return;
    this.unlocked = true;
    this.startDrone();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.38;
    if (!this.muted) this.unlock();
    return this.muted;
  }

  private startDrone() {
    const ctx = this.ac();
    if (!ctx || !this.master || this.drone) return;
    const gain = ctx.createGain();
    gain.gain.value = 0.04;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    gain.connect(filter);
    filter.connect(this.master);
    const oscs: OscillatorNode[] = [];
    for (const freq of [82.4, 123.5, 164.8]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = freq < 100 ? 0.7 : 0.28;
      o.connect(g);
      g.connect(gain);
      o.start();
      oscs.push(o);
    }
    this.drone = { oscs, gain };
  }

  private noise(duration: number, gainV: number, freq: number, type: BiquadFilterType = "bandpass", q = 1.5) {
    const ctx = this.ac();
    if (!ctx || !this.master) return;
    const n = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.4);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, ctx.currentTime);
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainV, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  }

  private tone(freq: number, duration: number, type: OscillatorType, gainV: number, slide = 1) {
    const ctx = this.ac();
    if (!ctx || !this.master) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(24, freq * slide), ctx.currentTime + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainV, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(ctx.currentTime + duration + 0.02);
  }

  private subThud(freqStart: number, freqEnd: number, duration: number, gainV: number) {
    const ctx = this.ac();
    if (!ctx || !this.master) return;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freqStart, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), ctx.currentTime + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainV, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(ctx.currentTime + duration + 0.02);
  }

  play(name: SfxName) {
    if (this.muted) return;
    this.unlock();
    switch (name) {
      case "swing":
        this.noise(0.12, 0.22, 1100, "bandpass", 2.2);
        this.tone(260, 0.09, "triangle", 0.06, 0.45);
        break;
      case "combo":
        this.noise(0.14, 0.26, 1400, "bandpass", 2.5);
        this.tone(340, 0.1, "sine", 0.08, 0.6);
        break;
      case "whoosh":
        this.noise(0.16, 0.18, 750, "highpass");
        this.subThud(120, 45, 0.12, 0.08);
        break;
      case "dash":
        this.noise(0.18, 0.25, 600, "bandpass", 1.2);
        this.subThud(140, 50, 0.14, 0.12);
        break;
      case "jump":
        this.subThud(130, 60, 0.14, 0.18);
        this.noise(0.12, 0.16, 950, "highpass");
        this.tone(280, 0.1, "triangle", 0.08, 1.4);
        break;
      case "dodge":
        this.noise(0.15, 0.24, 750, "bandpass", 1.5);
        this.subThud(150, 45, 0.12, 0.14);
        this.tone(190, 0.08, "sine", 0.06, 0.5);
        break;
      case "click":
        this.tone(880, 0.04, "sine", 0.09, 1.3);
        this.noise(0.03, 0.12, 3200, "highpass");
        break;
      case "hit":
        // Layer 1: Heavy sub-bass body thud
        this.subThud(140, 36, 0.18, 0.38);
        // Layer 2: Sharp cutting slice noise
        this.noise(0.09, 0.32, 1100, "bandpass", 2.0);
        // Layer 3: Metallic blade clatter
        this.tone(580, 0.12, "triangle", 0.14, 0.4);
        break;
      case "heavyhit":
        // Visceral heavy impact (thrust / finisher)
        this.subThud(110, 26, 0.32, 0.55);
        this.noise(0.14, 0.42, 700, "lowpass");
        this.noise(0.08, 0.3, 2400, "bandpass", 3.0);
        this.tone(420, 0.22, "sawtooth", 0.12, 0.25);
        break;
      case "crit":
        this.subThud(125, 28, 0.35, 0.6);
        this.noise(0.16, 0.45, 1800, "bandpass", 2.8);
        this.tone(960, 0.24, "sine", 0.16, 0.5);
        this.tone(1440, 0.2, "triangle", 0.12, 0.6);
        break;
      case "parry":
        // Resonant Crystalline Chime Chord (C6 - G6 - C7)
        this.tone(1046.5, 0.38, "triangle", 0.22, 1.02);
        this.tone(1568.0, 0.34, "sine", 0.18, 1.01);
        this.tone(2093.0, 0.28, "sine", 0.14, 1.0);
        // Sharp metallic spark transient
        this.noise(0.07, 0.38, 3800, "highpass");
        // Reverberating shockwave punch
        this.subThud(180, 32, 0.28, 0.48);
        break;
      case "clash":
        // Dual vibrating steel blades
        this.tone(520, 0.16, "square", 0.12, 0.85);
        this.tone(780, 0.14, "sawtooth", 0.1, 1.2);
        this.noise(0.11, 0.32, 1800, "bandpass", 3.0);
        this.subThud(160, 48, 0.16, 0.28);
        break;
      case "block":
        this.subThud(110, 42, 0.14, 0.22);
        this.tone(280, 0.1, "triangle", 0.14, 0.5);
        this.noise(0.09, 0.18, 650, "lowpass");
        break;
      case "break":
      case "shatter":
        // Guard Break: Glass / Iron crushing shatter
        this.subThud(90, 22, 0.34, 0.48);
        this.noise(0.2, 0.35, 900, "bandpass", 1.0);
        this.tone(220, 0.26, "sawtooth", 0.16, 0.2);
        this.tone(1200, 0.15, "triangle", 0.1, 0.3);
        break;
      case "bash":
        // Heavy shield slam
        this.subThud(95, 30, 0.22, 0.44);
        this.noise(0.12, 0.28, 350, "lowpass");
        this.tone(180, 0.14, "sine", 0.16, 0.4);
        break;
      case "land":
        this.subThud(85, 34, 0.12, 0.18);
        this.noise(0.08, 0.14, 250, "lowpass");
        break;
      case "throw":
        this.noise(0.08, 0.18, 2200, "highpass");
        this.tone(640, 0.09, "sine", 0.08, 1.8);
        break;
      case "web":
        this.tone(320, 0.24, "sine", 0.1, 2.2);
        this.noise(0.18, 0.12, 1200, "bandpass", 2.0);
        break;
      case "ko":
        // Seismic Slow-Mo Finisher Bass Drop
        this.subThud(75, 18, 0.65, 0.65);
        this.tone(196, 0.5, "triangle", 0.16, 0.3);
        this.tone(392, 0.4, "sine", 0.12, 0.4);
        this.noise(0.35, 0.32, 450, "lowpass");
        break;
      case "engage":
        this.tone(261.6, 0.24, "sine", 0.1, 1);
        this.tone(392.0, 0.28, "triangle", 0.08, 1);
        this.tone(523.2, 0.32, "sine", 0.06, 1);
        break;
      case "tick":
        this.tone(784, 0.05, "sine", 0.05, 1.2);
        break;
      default:
        break;
    }
  }
}
