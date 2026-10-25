// ---------- synthesized sound engine (no assets) ----------

type ToneOpts = {
  freq: number;
  freq2?: number;
  type?: OscillatorType;
  dur: number;
  vol?: number;
  delay?: number;
  attack?: number;
};

type NoiseOpts = {
  dur: number;
  vol?: number;
  ftype?: BiquadFilterType;
  freq?: number;
  q?: number;
  delay?: number;
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.42;
      this.master.connect(this.ctx.destination);
      this.startWind();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.42, this.ctx.currentTime, 0.05);
    }
  }

  private tone(o: ToneOpts) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + (o.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const v = o.vol ?? 0.5;
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.freq2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq2), t0 + o.dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.05);
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
    g.gain.value = 0.045;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 0.025;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
    lfo.start();
  }

  // ---- concrete sfx ----
  ui() { this.tone({ freq: 1150, dur: 0.05, vol: 0.22, type: "triangle" }); }
  error() { this.tone({ freq: 140, dur: 0.12, vol: 0.3, type: "square" }); }
  chop() { this.noise({ dur: 0.09, vol: 0.5, ftype: "bandpass", freq: 900, q: 1.5 }); this.tone({ freq: 150, freq2: 70, dur: 0.08, vol: 0.35 }); }
  rockHit() { this.noise({ dur: 0.07, vol: 0.4, ftype: "highpass", freq: 1600 }); this.tone({ freq: 480, freq2: 300, dur: 0.06, vol: 0.2, type: "triangle" }); }
  crystalHit() { this.tone({ freq: 1150, freq2: 1500, dur: 0.14, vol: 0.25, type: "sine" }); this.tone({ freq: 1720, dur: 0.1, vol: 0.12, delay: 0.03 }); }
  deposit() { this.tone({ freq: 620, freq2: 880, dur: 0.09, vol: 0.28, type: "triangle" }); }
  click() { this.tone({ freq: 300, freq2: 180, dur: 0.05, vol: 0.3, type: "square" }); this.noise({ dur: 0.05, vol: 0.25, freq: 1400 }); }
  coin() { this.tone({ freq: 880, dur: 0.08, vol: 0.25, type: "triangle" }); this.tone({ freq: 1245, dur: 0.14, vol: 0.25, type: "triangle", delay: 0.07 }); }
  quest() { [660, 830, 990].forEach((f, i) => this.tone({ freq: f, dur: 0.12, vol: 0.28, type: "triangle", delay: i * 0.09 })); }
  build() { this.noise({ dur: 0.16, vol: 0.5, freq: 500 }); this.tone({ freq: 190, freq2: 90, dur: 0.22, vol: 0.4 }); this.tone({ freq: 520, dur: 0.1, vol: 0.15, type: "triangle", delay: 0.12 }); }
  hire() { this.tone({ freq: 440, freq2: 660, dur: 0.12, vol: 0.3, type: "triangle" }); this.tone({ freq: 660, dur: 0.1, vol: 0.2, type: "triangle", delay: 0.09 }); }
  train() { this.tone({ freq: 95, freq2: 50, dur: 0.25, vol: 0.45 }); this.noise({ dur: 0.14, vol: 0.2, ftype: "highpass", freq: 3800, delay: 0.1 }); }
  hit() { this.noise({ dur: 0.06, vol: 0.3, ftype: "bandpass", freq: 1400, q: 2 }); }
  arrow() { this.noise({ dur: 0.12, vol: 0.16, ftype: "bandpass", freq: 2600, q: 3 }); }
  death() { this.tone({ freq: 220, freq2: 60, dur: 0.25, vol: 0.3, type: "sawtooth" }); }
  horn() { [98, 98.8].forEach((f) => this.tone({ freq: f, freq2: f * 0.99, dur: 0.9, vol: 0.28, type: "sawtooth", attack: 0.18 })); }
  drum() { this.tone({ freq: 75, freq2: 45, dur: 0.3, vol: 0.55 }); this.noise({ dur: 0.08, vol: 0.2, freq: 300 }); }
  warDrums() { this.drum(); this.tone({ freq: 70, freq2: 42, dur: 0.32, vol: 0.5, delay: 0.28 }); this.tone({ freq: 70, freq2: 42, dur: 0.4, vol: 0.5, delay: 0.62 }); }
  strike() { this.tone({ freq: 900, freq2: 90, dur: 0.2, vol: 0.5, type: "sawtooth" }); this.noise({ dur: 0.18, vol: 0.35, ftype: "highpass", freq: 2000 }); }
  victory() { [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.16, vol: 0.3, type: "triangle", delay: i * 0.11 })); }
  defeat() { this.tone({ freq: 240, freq2: 90, dur: 0.6, vol: 0.3, type: "triangle" }); }
  raidAlarm() { this.tone({ freq: 700, freq2: 500, dur: 0.16, vol: 0.35, type: "square" }); this.tone({ freq: 700, freq2: 500, dur: 0.16, vol: 0.35, type: "square", delay: 0.22 }); }
}

export const S = new SoundEngine();
