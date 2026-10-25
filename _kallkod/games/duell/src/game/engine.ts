import { Sfx } from "./audio";
import { beginAttract, beginDuel, createWorld, setIntensity, updateWorld } from "./logic";
import { render, type Rose, type View } from "./render";
import {
  WORLD_W,
  clamp,
  lerp,
  type GameEvent,
  type Intensity,
  type Snapshot,
  type World,
} from "./types";

export interface EngineHooks {
  onFrame: (s: Snapshot) => void;
}

const GESTURE_KEYS = new Set([
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyS",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
]);

export class DuelEngine {
  world: World;
  private ctx: CanvasRenderingContext2D;
  private sfx = new Sfx();
  private raf = 0;
  private dead = false;
  private acc = 0;
  private last = 0;
  private paused = false;
  private cssW = 1280;
  private cssH = 720;
  private dpr = 1;
  private camX = 1050;
  private camY = 640;
  private zoom = 1;
  private shakeX = 0;
  private shakeY = 0;
  private keys = new Set<string>();
  private keyAt = new Map<string, number>();
  private events: GameEvent[] = [];
  private shieldBtn = false;
  private gestureShield = false;
  private padX = 0;
  private ro: ResizeObserver | null = null;
  private aimX = 1050;
  private aimY = 500;
  private aimOk = false;
  private pointerId: number | null = null;
  private psx = 0;
  private psy = 0;
  private px = 0;
  private py = 0;
  private pt = 0;
  private holdFired = false;
  private lastTapT = 0;
  private lastTapX = 0;
  private lastTapY = 0;
  private pending = { x: 0, y: 0, t: 0 };
  private rose: Rose = { x: 0, y: 0, dx: 0, dy: 0, active: false, life: 0 };
  private bg: HTMLImageElement | null = null;
  private stone: CanvasPattern | null = null;
  private fine = true;

  constructor(
    private canvas: HTMLCanvasElement,
    private hooks: EngineHooks,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    this.ctx = ctx;
    this.world = createWorld("measured");
    this.fine = window.matchMedia("(pointer: fine)").matches;
    this.bind();
    this.loadArt();
    this.resize();
    this.layoutSpawns();
  }

  start() {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.unbind();
  }

  startDuel() {
    this.paused = false;
    this.resize();
    beginDuel(this.world);
    this.layoutSpawns();
    this.sfx.unlock();
  }

  leave() {
    this.paused = false;
    beginAttract(this.world);
    this.layoutSpawns();
  }

  togglePause() {
    if (this.world.attract || this.world.mode === "match") return;
    this.paused = !this.paused;
  }

  setIntensity(i: Intensity) {
    setIntensity(this.world, i);
  }

  toggleMute() {
    return this.sfx.toggleMute();
  }

  setShield(v: boolean) {
    this.shieldBtn = v;
    if (v) this.sfx.unlock();
  }

  setPad(x: number) {
    this.padX = x;
    if (x !== 0) this.sfx.unlock();
  }

  attack() {
    this.events.push({ kind: "tap", dx: 0, dy: 0 });
    this.sfx.unlock();
  }

  thrust() {
    this.events.push({ kind: "double", dx: 0, dy: 0 });
    this.sfx.unlock();
  }

  jump() {
    this.events.push({ kind: "swipe", dx: 0, dy: -1 });
    this.sfx.unlock();
  }

  dodge(dir?: number) {
    const opp = this.world.rival;
    const p = this.world.player;
    const toOpp = p.x < opp.x ? 1 : -1;
    const d = dir ?? toOpp;
    this.events.push({ kind: "swipe", dx: d, dy: 0.85 });
    this.sfx.unlock();
  }

  parry() {
    const p = this.world.player;
    p.parryWindow = 0.16;
    p.autoShield = 0.28;
    this.events.push({ kind: "swipe", dx: -p.facing, dy: 0 });
    this.sfx.unlock();
  }

  flick(dx: number, dy: number) {
    this.events.push({ kind: "swipe", dx, dy });
    this.sfx.unlock();
  }

  fit() {
    this.resize();
    if (this.world.attract && this.world.time < 0.6) this.layoutSpawns();
  }

  knife() {
    this.events.push({ kind: "knife", dx: 0, dy: 0 });
    this.sfx.unlock();
  }

  grapple() {
    this.events.push({ kind: "grapple", dx: 0, dy: 0 });
    this.sfx.unlock();
  }

  private loadArt() {
    const bg = new Image();
    bg.src = "./images/arena-dusk.jpg";
    bg.onload = () => {
      this.bg = bg;
    };
    const stone = new Image();
    stone.src = "./images/stone-face.jpg";
    stone.onload = () => {
      this.stone = this.ctx.createPattern(stone, "repeat");
    };
  }

  private resize = () => {
    const rect = this.canvas.getBoundingClientRect();
    const vv = window.visualViewport;
    const w = rect.width > 2 ? rect.width : (vv?.width ?? window.innerWidth);
    const h = rect.height > 2 ? rect.height : (vv?.height ?? window.innerHeight);
    this.cssW = Math.max(1, w);
    this.cssH = Math.max(1, h);
    const cap = this.cssW < 700 ? 1.5 : 2;
    this.dpr = Math.min(cap, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(this.cssW * this.dpr);
    this.canvas.height = Math.floor(this.cssH * this.dpr);
  };

  private layoutSpawns() {
    const tight = this.cssW < 900 || this.cssH < 520;
    const left = tight ? 880 : 340;
    const right = tight ? 1260 : 1760;
    this.world.player.x = left;
    this.world.rival.x = right;
    this.world.player.y = 800;
    this.world.rival.y = 800;
    this.world.player.vx = 0;
    this.world.rival.vx = 0;
    this.world.player.facing = 1;
    this.world.rival.facing = -1;
    this.camX = (left + right) / 2;
    this.camY = 690;
    this.zoom = this.cssW / (tight ? 760 : 1280);
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) {
      if (e.button === 2) this.shieldBtn = true;
      return;
    }
    this.sfx.unlock();
    const rect = this.canvas.getBoundingClientRect();
    this.pointerId = e.pointerId;
    this.psx = e.clientX;
    this.psy = e.clientY;
    this.px = e.clientX;
    this.py = e.clientY;
    this.pt = performance.now();
    this.holdFired = false;
    this.canvas.setPointerCapture(e.pointerId);
    this.rose = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      dx: 0,
      dy: 0,
      active: true,
      life: 0.8,
    };
  };

  private onMove = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (this.fine) {
      const wpt = this.screenToWorld(sx, sy);
      this.aimX = wpt.x;
      this.aimY = wpt.y;
      this.aimOk = true;
    }
    if (this.pointerId !== e.pointerId) return;
    this.px = e.clientX;
    this.py = e.clientY;
    const dx = this.px - this.psx;
    const dy = this.py - this.psy;
    this.rose.dx = dx;
    this.rose.dy = dy;
    this.rose.life = 0.8;
    const dist = Math.hypot(dx, dy);
    if (!this.holdFired && performance.now() - this.pt > 220 && dist < 20) {
      this.holdFired = true;
      this.gestureShield = true;
    }
    if (dist > 28) this.gestureShield = false;
  };

  private onUp = (e: PointerEvent) => {
    if (e.button === 2) {
      this.shieldBtn = false;
      return;
    }
    if (this.pointerId !== e.pointerId) return;
    const dt = performance.now() - this.pt;
    const dx = this.px - this.psx;
    const dy = this.py - this.psy;
    const dist = Math.hypot(dx, dy);
    const speed = dist / Math.max(16, dt);
    const coarse = this.cssW < 900;
    const tapSlop = coarse ? 32 : 18;
    const flickSpeed = coarse ? 0.4 : 0.62;
    const flickDist = coarse ? 40 : 64;
    if (this.holdFired) {
      this.gestureShield = false;
    } else if (dist < tapSlop && dt < 300) {
      const now = performance.now();
      if (now - this.lastTapT < 280 && Math.hypot(this.psx - this.lastTapX, this.psy - this.lastTapY) < 48) {
        this.events.push({ kind: "double", dx: 0, dy: 0 });
        this.lastTapT = 0;
      } else {
        this.events.push({ kind: "tap", dx: 0, dy: 0 });
        this.lastTapT = now;
        this.lastTapX = this.psx;
        this.lastTapY = this.psy;
      }
    } else if (speed > flickSpeed || (dist > flickDist && dt < 380)) {
      this.events.push({ kind: "swipe", dx, dy });
    }
    this.pointerId = null;
    this.gestureShield = false;
    this.rose.active = false;
    this.rose.life = 0.35;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (GESTURE_KEYS.has(e.code) || e.code === "Space") e.preventDefault();
    this.sfx.unlock();
    this.keys.add(e.code);
    this.keyAt.set(e.code, performance.now());
    if (e.code === "Escape") {
      this.togglePause();
      return;
    }
    if (e.code === "Backquote") {
      this.world.debug = !this.world.debug;
      return;
    }
    if (this.paused) return;
    if (e.code === "Space") {
      e.preventDefault();
      this.events.push({ kind: "swipe", dx: 0, dy: -1 });
    } else if (e.code === "KeyJ" || e.code === "KeyZ") {
      this.events.push({ kind: "tap", dx: 0, dy: 0 });
    } else if (e.code === "KeyK" || e.code === "KeyX") {
      this.events.push({ kind: "double", dx: 0, dy: 0 });
    } else if (e.code === "KeyF") {
      this.events.push({ kind: "knife", dx: 0, dy: 0 });
    } else if (e.code === "KeyE" || e.code === "KeyQ") {
      this.events.push({ kind: "grapple", dx: 0, dy: 0 });
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const t0 = this.keyAt.get(e.code) ?? performance.now();
    this.keys.delete(e.code);
    this.keyAt.delete(e.code);
    if (!GESTURE_KEYS.has(e.code)) return;
    if (performance.now() - t0 > 175) return;
    const dir = keyVec(e.code);
    const now = performance.now();
    if (now - this.pending.t < 80) {
      this.pending.x += dir.x;
      this.pending.y += dir.y;
      this.pending.t = now;
    } else {
      this.flushDir();
      this.pending = { x: dir.x, y: dir.y, t: now };
    }
  };

  private onContext = (e: Event) => e.preventDefault();

  private bind() {
    window.addEventListener("resize", this.resize);
    window.visualViewport?.addEventListener("resize", this.resize);
    window.visualViewport?.addEventListener("scroll", this.resize);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas);
    this.canvas.addEventListener("pointerdown", this.onDown);
    this.canvas.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("contextmenu", this.onContext);
  }

  private unbind() {
    window.removeEventListener("resize", this.resize);
    window.visualViewport?.removeEventListener("resize", this.resize);
    window.visualViewport?.removeEventListener("scroll", this.resize);
    this.ro?.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("contextmenu", this.onContext);
  }

  private flushDir() {
    if (!this.pending.t) return;
    if (performance.now() - this.pending.t < 55) return;
    const mag = Math.hypot(this.pending.x, this.pending.y) || 1;
    this.events.push({ kind: "swipe", dx: this.pending.x / mag, dy: this.pending.y / mag });
    this.pending.t = 0;
    this.pending.x = 0;
    this.pending.y = 0;
  }

  private screenToWorld(sx: number, sy: number) {
    return {
      x: (sx - this.cssW / 2 - this.shakeX) / this.zoom + this.camX,
      y: (sy - this.cssH / 2 - this.shakeY) / this.zoom + this.camY,
    };
  }

  private stickX() {
    if (this.pointerId === null || this.gestureShield) return 0;
    const dx = this.px - this.psx;
    const dy = this.py - this.psy;
    const dist = Math.hypot(dx, dy);
    if (dist < 18) return 0;
    const speed = dist / Math.max(16, performance.now() - this.pt);
    if (speed > 0.9) return 0;
    return clamp(dx / 80, -1, 1);
  }

  private sample() {
    let moveX = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) moveX -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) moveX += 1;
    const stick = this.stickX();
    if (Math.abs(stick) > Math.abs(moveX)) moveX = stick;
    if (Math.abs(this.padX) > Math.abs(moveX)) moveX = this.padX;
    const shield =
      this.shieldBtn ||
      this.gestureShield ||
      this.keys.has("ShiftLeft") ||
      this.keys.has("ShiftRight");
    return {
      moveX,
      shield,
      events: this.events.slice(),
      aimX: this.aimX,
      aimY: this.aimY,
      aimOk: this.aimOk,
    };
  }

  private playQueue() {
    const q = this.world.sfx;
    for (let i = 0; i < q.length; i++) this.sfx.play(q[i]);
    q.length = 0;
  }

  private updateCamera(dt: number) {
    const p = this.world.player;
    const r = this.world.rival;
    const dist = Math.abs(p.x - r.x);
    const midX = (p.x + r.x) / 2 + (p.vx + r.vx) * 0.06;
    const feetY = (p.y + r.y) / 2;
    const highY = Math.min(p.y, r.y) - 108;
    const short = this.cssH < 520;
    const narrow = this.cssW < 820;
    const dock = short ? 92 : narrow ? 148 : 84;
    const topHud = short ? 46 : narrow ? 62 : 72;
    const minChar = short ? 50 : narrow ? 58 : 86;
    const idealChar = clamp(this.cssH * (short ? 0.2 : 0.22), minChar, short ? 108 : 168);
    const zoomIdeal = idealChar / 96;
    const zoomBoth = this.cssW / Math.max(480, dist + (narrow || short ? 200 : 320));
    let zoom = Math.min(zoomIdeal, zoomBoth);
    const zoomFloor = minChar / 96;
    if (zoom < zoomFloor) zoom = zoomFloor;
    let focusX = midX;
    const viewW = this.cssW / zoom;
    if (dist + 70 > viewW) {
      focusX = this.world.attract
        ? Math.abs(this.camX - p.x) <= Math.abs(this.camX - r.x)
          ? p.x
          : r.x
        : p.x;
    }
    if (this.world.mode === "ko") zoom *= 1.1;
    zoom *= 1 + this.world.punch;
    const playTop = topHud;
    const playBot = this.cssH - dock;
    const targetScreenY = playTop + Math.max(40, playBot - playTop) * 0.68;
    let targetY = feetY - (targetScreenY - this.cssH / 2) / Math.max(0.2, zoom);
    const headScreen = (highY - targetY) * zoom + this.cssH / 2;
    if (headScreen < playTop + 6) targetY -= (playTop + 6 - headScreen) / Math.max(0.2, zoom);
    const k = 1 - Math.pow(0.0012, Math.max(0.001, dt));
    this.camX = lerp(this.camX, clamp(focusX, 140, WORLD_W - 140), k);
    this.camY = lerp(this.camY, targetY, k);
    this.zoom = lerp(this.zoom, zoom, k);
    if (this.world.shake > 0.4) {
      this.shakeX = (Math.random() - 0.5) * this.world.shake;
      this.shakeY = (Math.random() - 0.5) * this.world.shake * 0.65;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  private snapshot(): Snapshot {
    const w = this.world;
    return {
      mode: w.mode,
      attract: w.attract,
      paused: this.paused,
      hpP: w.player.health,
      hpR: w.rival.health,
      hpLagP: w.player.healthLag,
      hpLagR: w.rival.healthLag,
      stamP: w.player.stamina,
      stamR: w.rival.stamina,
      knivesP: w.player.knives,
      knivesR: w.rival.knives,
      scoreP: w.scoreP,
      scoreR: w.scoreR,
      round: w.round,
      message: w.message,
      sub: w.submessage,
      messageA: clamp(w.messageT / 0.55, 0, 1),
      coach: w.coach,
      log: w.log.map((l) => ({ who: l.who, text: l.text, side: l.side })),
      winner: w.winner,
      matchWinner: w.matchWinner,
      intensity: w.intensity,
      muted: this.sfx.muted,
      low: !w.attract && w.player.health > 0 && w.player.health < 32 && (w.mode === "fight" || w.mode === "ko"),
    };
  }

  private frame = (t: number) => {
    if (this.dead) return;
    const dt = Math.min(0.05, this.last ? (t - this.last) / 1000 : 0.016);
    this.last = t;
    this.flushDir();
    if (!this.paused) {
      this.acc += dt;
      const step = 1 / 60;
      let n = 0;
      while (this.acc >= step && n < 5) {
        updateWorld(this.world, step, this.sample());
        this.events = [];
        this.acc -= step;
        n++;
      }
    } else {
      this.events = [];
    }
    this.playQueue();
    this.updateCamera(dt);
    if (!this.rose.active) this.rose.life = Math.max(0, this.rose.life - dt);
    const view: View = {
      cssW: this.cssW,
      cssH: this.cssH,
      dpr: this.dpr,
      camX: this.camX,
      camY: this.camY,
      zoom: this.zoom,
      shakeX: this.shakeX,
      shakeY: this.shakeY,
      rose: this.rose.life > 0 || this.rose.active ? this.rose : null,
      showAim: this.aimOk && this.fine && !this.world.attract,
      aimX: this.aimX,
      aimY: this.aimY,
    };
    render(this.ctx, this.world, view, { bg: this.bg, stone: this.stone });
    this.hooks.onFrame(this.snapshot());
    this.raf = requestAnimationFrame(this.frame);
  };
}

function keyVec(code: string) {
  switch (code) {
    case "KeyA":
    case "ArrowLeft":
      return { x: -1, y: 0 };
    case "KeyD":
    case "ArrowRight":
      return { x: 1, y: 0 };
    case "KeyW":
    case "ArrowUp":
      return { x: 0, y: -1 };
    default:
      return { x: 0, y: 1 };
  }
}
