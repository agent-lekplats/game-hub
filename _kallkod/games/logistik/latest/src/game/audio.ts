// ---------- synthesized sound engine 2.0 (hyper-juicy procedural WebAudio) ----------

type ToneOpts = {
  freq: number;
  freq2?: number;
  type?: OscillatorType;
  dur: number;
  vol?: number;
  delay?: number;
  attack?: number;
  detune?: number;
};

type NoiseOpts = {
  dur: number;
  vol?: number;
  ftype?: BiquadFilterType;
  freq?: number;
  q?: number;
  delay?: number;
};

const PENTATONIC = [1, 1.122, 1.26, 1.498, 1.682, 2.0, 2.245, 2.52, 2.996];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private hoverGate = 0;
  private depositStep = 0;
  private lastDepositT = 0;
  muted = false;

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 18;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.14;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.48;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.startWind();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.48, this.ctx.currentTime, 0.04);
    }
  }

  private tone(o: ToneOpts) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + (o.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const v = o.vol ?? 0.5;
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(Math.max(20, o.freq), t0);
    if (o.detune) osc.detune.setValueAtTime(o.detune, t0);
    if (o.freq2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq2), t0 + o.dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack ?? 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.04);
  }

  private noise(o: NoiseOpts) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + (o.delay ?? 0);
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * o.dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = o.ftype ?? "lowpass";
    f.frequency.value = o.freq ?? 800;
    f.Q.value = o.q ?? 0.8;
    const g = this.ctx.createGain();
    const v = o.vol ?? 0.4;
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  private startWind() {
    if (!this.ctx || !this.master) return;
    const len = this.ctx.sampleRate * 3;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.value = 0.04;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 0.02;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
    lfo.start();
  }

  private pitchForCombo(combo = 0) {
    const idx = Math.min(PENTATONIC.length - 1, Math.max(0, combo));
    return PENTATONIC[idx] * (0.98 + Math.random() * 0.04);
  }

  // ---- hyper-tactile UI sfx ----
  uiHover() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.hoverGate < 0.035) return;
    this.hoverGate = now;
    this.tone({ freq: 1850 + Math.random() * 140, freq2: 2350, dur: 0.024, vol: 0.09, type: "sine", attack: 0.002 });
  }

  ui() {
    this.tone({ freq: 920, freq2: 1480, dur: 0.045, vol: 0.24, type: "triangle", attack: 0.002 });
    this.tone({ freq: 180, freq2: 85, dur: 0.04, vol: 0.18, type: "sine", attack: 0.002 });
  }

  click() {
    this.tone({ freq: 380, freq2: 160, dur: 0.055, vol: 0.34, type: "triangle", attack: 0.002 });
    this.tone({ freq: 1250, freq2: 740, dur: 0.035, vol: 0.18, type: "sine", attack: 0.002 });
    this.noise({ dur: 0.04, vol: 0.22, ftype: "bandpass", freq: 1800, q: 1.8 });
  }

  error() {
    this.tone({ freq: 170, freq2: 115, dur: 0.11, vol: 0.32, type: "sawtooth" });
    this.tone({ freq: 135, freq2: 88, dur: 0.14, vol: 0.28, type: "square", delay: 0.06 });
  }

  // ---- harvesting & world hits ----
  chop(combo = 0, isCrit = false) {
    const p = this.pitchForCombo(combo);
    // sub thump
    this.tone({ freq: 155 * p, freq2: 52, dur: 0.1, vol: 0.48, type: "sine", attack: 0.002 });
    // wood crack
    this.tone({ freq: 340 * p, freq2: 130, dur: 0.065, vol: 0.32, type: "triangle", attack: 0.002 });
    this.noise({ dur: 0.085, vol: 0.52, ftype: "bandpass", freq: 950 * p, q: 1.7 });
    if (isCrit) this.crit(p);
  }

  rockHit(combo = 0, isCrit = false) {
    const p = this.pitchForCombo(combo);
    // pickaxe transient + sub
    this.tone({ freq: 135, freq2: 48, dur: 0.09, vol: 0.4, type: "sine", attack: 0.002 });
    this.noise({ dur: 0.07, vol: 0.45, ftype: "highpass", freq: 1700 });
    this.tone({ freq: 560 * p, freq2: 320 * p, dur: 0.065, vol: 0.28, type: "triangle", attack: 0.002 });
    this.tone({ freq: 1420 * p, freq2: 980 * p, dur: 0.05, vol: 0.16, type: "sine", delay: 0.01 });
    if (isCrit) this.crit(p);
  }

  crystalHit(combo = 0, isCrit = false) {
    const p = this.pitchForCombo(combo);
    this.tone({ freq: 1120 * p, freq2: 1560 * p, dur: 0.16, vol: 0.3, type: "sine", attack: 0.002 });
    this.tone({ freq: 1680 * p, freq2: 2240 * p, dur: 0.14, vol: 0.2, type: "triangle", delay: 0.025 });
    this.tone({ freq: 2520 * p, dur: 0.12, vol: 0.12, type: "sine", delay: 0.05 });
    if (isCrit) this.crit(p);
  }

  crit(p = 1) {
    this.tone({ freq: 880 * p, freq2: 1760 * p, dur: 0.14, vol: 0.32, type: "triangle", attack: 0.002 });
    this.tone({ freq: 1320 * p, freq2: 2640 * p, dur: 0.16, vol: 0.24, type: "sine", delay: 0.03 });
    this.noise({ dur: 0.09, vol: 0.28, ftype: "highpass", freq: 3200 });
  }

  nodeFell() {
    this.tone({ freq: 140, freq2: 38, dur: 0.26, vol: 0.55, type: "sine", attack: 0.003 });
    this.noise({ dur: 0.2, vol: 0.48, ftype: "lowpass", freq: 680 });
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.13, vol: 0.22, type: "triangle", delay: 0.03 + i * 0.045 })
    );
  }

  deposit() {
    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (now - this.lastDepositT < 0.65) {
        this.depositStep = (this.depositStep + 1) % PENTATONIC.length;
      } else {
        this.depositStep = 0;
      }
      this.lastDepositT = now;
    }
    const p = PENTATONIC[this.depositStep];
    this.tone({ freq: 587.33 * p, freq2: 880 * p, dur: 0.095, vol: 0.28, type: "triangle", attack: 0.003 });
    this.tone({ freq: 1174.66 * p, dur: 0.07, vol: 0.12, type: "sine", delay: 0.02 });
  }

  jump() {
    this.tone({ freq: 210, freq2: 540, dur: 0.11, vol: 0.22, type: "sine", attack: 0.004 });
    this.noise({ dur: 0.05, vol: 0.12, ftype: "bandpass", freq: 1200, q: 1.5 });
  }

  land() {
    this.tone({ freq: 120, freq2: 45, dur: 0.08, vol: 0.26, type: "sine", attack: 0.002 });
    this.noise({ dur: 0.05, vol: 0.16, ftype: "lowpass", freq: 450 });
  }

  groundTap() {
    this.tone({ freq: 240, freq2: 95, dur: 0.05, vol: 0.2, type: "sine", attack: 0.002 });
    this.noise({ dur: 0.035, vol: 0.14, ftype: "bandpass", freq: 1500, q: 2 });
  }

  rallyPlant() {
    this.tone({ freq: 140, freq2: 48, dur: 0.16, vol: 0.45, type: "sine", attack: 0.002 });
    this.noise({ dur: 0.12, vol: 0.32, ftype: "bandpass", freq: 1100, q: 1.4 });
    this.tone({ freq: 440, dur: 0.14, vol: 0.24, type: "triangle", delay: 0.02 });
    this.tone({ freq: 659.25, dur: 0.2, vol: 0.26, type: "triangle", delay: 0.08 });
  }

  coin() {
    this.tone({ freq: 160, freq2: 60, dur: 0.09, vol: 0.35, type: "sine", attack: 0.002 });
    this.tone({ freq: 880, dur: 0.09, vol: 0.28, type: "triangle" });
    this.tone({ freq: 1318.5, dur: 0.15, vol: 0.28, type: "triangle", delay: 0.055 });
    this.tone({ freq: 1760, dur: 0.18, vol: 0.2, type: "sine", delay: 0.11 });
  }

  quest() {
    [587.33, 740, 880, 1174.66].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.16, vol: 0.28, type: "triangle", delay: i * 0.075 })
    );
  }

  build() {
    // heavy drop slam + chord
    this.tone({ freq: 190, freq2: 42, dur: 0.28, vol: 0.58, type: "sine", attack: 0.003 });
    this.noise({ dur: 0.18, vol: 0.52, freq: 540 });
    this.tone({ freq: 392, dur: 0.12, vol: 0.22, type: "triangle", delay: 0.06 });
    this.tone({ freq: 587.33, dur: 0.16, vol: 0.24, type: "triangle", delay: 0.12 });
  }

  hire() {
    this.jump();
    this.tone({ freq: 440, freq2: 660, dur: 0.12, vol: 0.3, type: "triangle", delay: 0.03 });
    this.tone({ freq: 880, dur: 0.14, vol: 0.24, type: "triangle", delay: 0.1 });
  }

  train() {
    this.tone({ freq: 110, freq2: 46, dur: 0.24, vol: 0.5 });
    this.noise({ dur: 0.14, vol: 0.26, ftype: "highpass", freq: 3400, delay: 0.06 });
    this.tone({ freq: 520, freq2: 780, dur: 0.1, vol: 0.2, type: "triangle", delay: 0.05 });
  }

  hit() {
    this.tone({ freq: 150, freq2: 55, dur: 0.065, vol: 0.34, type: "sine", attack: 0.002 });
    this.noise({ dur: 0.06, vol: 0.34, ftype: "bandpass", freq: 1550, q: 1.8 });
  }

  golemSlam() {
    this.tone({ freq: 95, freq2: 28, dur: 0.34, vol: 0.65, type: "sine", attack: 0.003 });
    this.noise({ dur: 0.24, vol: 0.5, ftype: "lowpass", freq: 420 });
    this.noise({ dur: 0.12, vol: 0.3, ftype: "bandpass", freq: 1400, q: 1.5, delay: 0.04 });
  }

  arrow() {
    this.noise({ dur: 0.11, vol: 0.2, ftype: "bandpass", freq: 2700, q: 2.8 });
    this.tone({ freq: 620, freq2: 280, dur: 0.07, vol: 0.12, type: "sine" });
  }

  death() {
    this.tone({ freq: 240, freq2: 52, dur: 0.24, vol: 0.34, type: "sawtooth" });
    this.noise({ dur: 0.1, vol: 0.24, ftype: "lowpass", freq: 600 });
  }

  horn() {
    [98, 98.8, 146.8].forEach((f, i) =>
      this.tone({ freq: f, freq2: f * 0.99, dur: 0.95, vol: i === 2 ? 0.16 : 0.28, type: "sawtooth", attack: 0.16 })
    );
  }

  drum() {
    this.tone({ freq: 82, freq2: 42, dur: 0.3, vol: 0.58 });
    this.noise({ dur: 0.08, vol: 0.22, freq: 320 });
  }

  warDrums() {
    this.drum();
    this.tone({ freq: 74, freq2: 40, dur: 0.32, vol: 0.52, delay: 0.26 });
    this.tone({ freq: 70, freq2: 38, dur: 0.42, vol: 0.55, delay: 0.58 });
  }

  strike() {
    // thunderous sky-smite
    this.tone({ freq: 180, freq2: 34, dur: 0.28, vol: 0.62, type: "sine", attack: 0.002 });
    this.tone({ freq: 1100, freq2: 85, dur: 0.22, vol: 0.48, type: "sawtooth", attack: 0.002 });
    this.noise({ dur: 0.22, vol: 0.45, ftype: "highpass", freq: 1800 });
    this.tone({ freq: 1760, freq2: 880, dur: 0.14, vol: 0.22, type: "triangle", delay: 0.03 });
  }

  victory() {
    this.tone({ freq: 130.8, freq2: 65.4, dur: 0.35, vol: 0.48, type: "sine" });
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.22, vol: 0.3, type: "triangle", delay: i * 0.095 })
    );
  }

  defeat() {
    this.tone({ freq: 240, freq2: 85, dur: 0.65, vol: 0.35, type: "triangle" });
  }

  raidAlarm() {
    this.tone({ freq: 720, freq2: 500, dur: 0.16, vol: 0.36, type: "square" });
    this.tone({ freq: 720, freq2: 500, dur: 0.16, vol: 0.36, type: "square", delay: 0.22 });
  }
}

export const S = new SoundEngine();
