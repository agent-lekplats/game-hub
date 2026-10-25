// ---------- central mutable game state (with full physical juice state) ----------
import { uid } from "./util";

export type ResKey = "wood" | "stone" | "iron" | "crystal" | "valor";
export type Cost = Partial<Record<ResKey, number>>;

export type NodeType = "tree" | "rock" | "iron" | "crystal" | "ruin";

export interface NodeEnt {
  id: number;
  type: NodeType;
  x: number;
  y: number;
  amount: number;
  max: number;
  regrow: number; // seconds until regrown (0 = alive/full-cycle)
  seed: number;
  hitAnim?: number;
  hitDir?: number;
  flash?: number;
}

export interface WorkerEnt {
  id: number;
  x: number;
  y: number;
  state: "idle" | "toNode" | "harvest" | "toHome";
  targetId: number;
  carryRes: ResKey | null;
  carryN: number;
  prog: number;
  tunic: string;
  phase: number;
  tx: number;
  ty: number;
  jumpZ?: number;
  vz?: number;
  squash?: number;
  stepT?: number;
}

export type UnitKind = "militia" | "archer" | "guardian" | "golem";
export interface UnitEnt {
  id: number;
  type: UnitKind;
  x: number;
  y: number;
  hp: number;
  maxhp: number;
  cd: number;
  lunge: number;
  face: number;
  bob: number;
  formI: number;
  jumpZ?: number;
  vz?: number;
  squash?: number;
  flash?: number;
  kbX?: number;
  kbY?: number;
  stepT?: number;
}

export type EnemyKind = "raider" | "brute" | "shaman" | "warlord";
export interface EnemyEnt {
  id: number;
  type: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxhp: number;
  dmgM: number;
  cd: number;
  lunge: number;
  face: number;
  raid: boolean;
  bob: number;
  jumpZ?: number;
  vz?: number;
  squash?: number;
  flash?: number;
  kbX?: number;
  kbY?: number;
  stepT?: number;
}

export interface ProjEnt {
  x1: number; y1: number; x2: number; y2: number;
  t: number; dur: number; dmg: number; friend: boolean;
  targetId: number; kind: "arrow" | "bolt";
}

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  kind: "chip" | "smoke" | "flame" | "spark" | "poof" | "ember" | "leaf" | "glow" | "dust" | "ash" | "zap" | "star";
  grav: number;
}

export interface FloatText {
  id: number;
  x: number; y: number;
  vx?: number; vy?: number;
  life: number; max: number;
  text: string; color: string; size: number;
  crit?: boolean;
}

export interface Orb {
  id: number;
  x: number; y: number; sx: number; sy: number; tx: number; ty: number;
  t: number; dur: number;
  res: ResKey; amt: number;
}

export interface RingFx {
  id: number;
  x: number; y: number;
  maxR: number;
  life: number; max: number;
  color: string;
  lineW: number;
}

export interface SlashFx {
  id: number;
  x: number; y: number;
  ang: number;
  r: number;
  life: number; max: number;
  color: string;
  dir: number;
}

export interface BoltFx {
  id: number;
  pts: { x: number; y: number }[];
  life: number; max: number;
  color: string;
  width: number;
}

export interface Decor {
  grass: { x: number; y: number; s: number; ph: number }[];
  flowers: { x: number; y: number; c: string; s: number }[];
  pebbles: { x: number; y: number; s: number; a: number }[];
  ash: { x: number; y: number; s: number }[];
  clouds: { x: number; y: number; s: number; v: number }[];
  birds: { x: number; y: number; vx: number; ph: number; seed: number }[];
}

export interface BarracksEnt {
  id: number;
  x: number; y: number;
  queue: UnitKind[];
  prog: number;
}

export interface BuildingEnt {
  key: string;
  x: number; y: number;
  dropAnim?: number;
  pulse?: number;
}

export interface Toast {
  id: number;
  kind: "info" | "war" | "quest" | "warn" | "good";
  title: string;
  sub?: string;
  t: number;
}

export interface Camera {
  x: number; y: number; z: number;
  tx: number; ty: number; tz: number;
  shake: number;
  kickX?: number;
  kickY?: number;
  zoomPunch?: number;
  flash?: number;
  flashColor?: string;
}

export interface GameState {
  seed: number;
  time: number;
  paused: boolean;
  started: boolean;
  res: Record<ResKey, number>;
  resFlash: Record<ResKey, number>;
  stockLvl: number;
  stockPulse: number;
  rallyPulse: number;
  hitstop: number;
  combo: number;
  comboTimer: number;
  maxCombo: number;
  hoverWorld: { x: number; y: number; nodeId: number | null; enemyId: number | null };
  buildings: Record<string, number>;
  buildingEnts: BuildingEnt[];
  barracksEnts: BarracksEnt[];
  upg: Record<string, number>;
  tech: Record<string, number>;
  focus: "auto" | "wood" | "stone" | "iron" | "crystal";
  nodes: NodeEnt[];
  workers: WorkerEnt[];
  units: UnitEnt[];
  enemies: EnemyEnt[];
  projs: ProjEnt[];
  particles: Particle[];
  rings: RingFx[];
  slashes: SlashFx[];
  bolts: BoltFx[];
  floats: FloatText[];
  orbs: Orb[];
  decor: Decor;
  rally: { x: number; y: number };
  conquest: number;
  frontX: number;
  frontAnim: number;
  waveTimer: number;
  waveActive: boolean;
  pendingSpawns: { type: EnemyKind; x: number; y: number; dmgM: number; delay: number }[];
  strikeCd: number;
  stats: {
    gatheredWood: number;
    kills: number;
    wavesWon: number;
    totalEarned: number;
    earnedRun: number;
  };
  questsDone: string[];
  questFlash: string | null;
  depositLog: { t: number; res: ResKey; amt: number }[];
  rates: Record<ResKey, number>;
  auto: Record<UnitKind, boolean>;
  cam: Camera;
  toasts: Toast[];
  lastSave: number;
  savedRates: Record<ResKey, number>;
  dayT: number;
  offline: { dur: number; gains: Cost } | null;
}

// ---- singleton ----
export const G: { s: GameState; uiV: number } = { s: null as unknown as GameState, uiV: 0 };

export function canAfford(s: GameState, cost: Cost): boolean {
  for (const k in cost) {
    const key = k as ResKey;
    if ((s.res[key] ?? 0) < (cost[key] ?? 0)) return false;
  }
  return true;
}

export function pay(s: GameState, cost: Cost): boolean {
  if (!canAfford(s, cost)) return false;
  for (const k in cost) {
    const key = k as ResKey;
    s.res[key] -= cost[key] ?? 0;
  }
  return true;
}

export function capOf(s: GameState): number {
  // stockpile capacity for storable resources
  return Math.round(300 * Math.pow(2, s.stockLvl - 1));
}

export function gain(s: GameState, res: ResKey, amt: number) {
  if (amt <= 0) return;
  if (res === "valor") {
    s.res.valor += amt;
  } else {
    const cap = capOf(s);
    const before = s.res[res];
    s.res[res] = Math.min(cap, before + amt);
    amt = s.res[res] - before;
  }
  if (amt > 0) {
    s.resFlash[res] = 1;
    s.stockPulse = Math.min(1.4, (s.stockPulse ?? 0) + 0.45);
  }
  if (res === "wood") s.stats.gatheredWood += amt;
  s.stats.totalEarned += amt;
  s.stats.earnedRun += amt;
}

export function toast(s: GameState, kind: Toast["kind"], title: string, sub?: string) {
  s.toasts.push({ id: uid(), kind, title, sub, t: 4.5 });
  if (s.toasts.length > 5) s.toasts.shift();
}

export function float(s: GameState, x: number, y: number, text: string, color: string, size = 13, crit = false) {
  const vx = (Math.random() - 0.5) * (crit ? 52 : 28);
  const vy = -(crit ? 68 : 44) - Math.random() * 18;
  const max = crit ? 1.55 : 1.3;
  s.floats.push({ id: uid(), x, y, vx, vy, life: max, max, text, color, size, crit });
  if (s.floats.length > 85) s.floats.shift();
}

export function addParticle(s: GameState, p: Omit<Particle, "life" | "max"> & { life: number }) {
  s.particles.push({ ...p, max: p.life });
  if (s.particles.length > 550) s.particles.splice(0, s.particles.length - 550);
}

export function addRing(s: GameState, x: number, y: number, maxR: number, color = "#ffd76b", dur = 0.42, lineW = 3) {
  s.rings.push({ id: uid(), x, y, maxR, life: dur, max: dur, color, lineW });
  if (s.rings.length > 40) s.rings.shift();
}

export function addSlash(s: GameState, x: number, y: number, ang: number, r = 24, color = "#fff3d8", dur = 0.2, dir = 1) {
  s.slashes.push({ id: uid(), x, y, ang, r, life: dur, max: dur, color, dir });
  if (s.slashes.length > 40) s.slashes.shift();
}

export function addBolt(s: GameState, x1: number, y1: number, x2: number, y2: number, color = "#ffd76b", width = 3.2) {
  const pts: { x: number; y: number }[] = [{ x: x1, y: y1 }];
  const segs = 9;
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const jitter = (1 - Math.abs(t - 0.5) * 1.5) * 28;
    pts.push({
      x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * jitter,
      y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * jitter * 0.4,
    });
  }
  pts.push({ x: x2, y: y2 });
  s.bolts.push({ id: uid(), pts, life: 0.28, max: 0.28, color, width });
  if (s.bolts.length > 20) s.bolts.shift();
}

export function camPunch(s: GameState, shake = 2.5, zoom = 0.018, dx = 0, dy = 0, flash = 0, flashColor = "#ffd89a") {
  s.cam.shake = Math.min(14, s.cam.shake + shake);
  s.cam.zoomPunch = Math.min(0.08, (s.cam.zoomPunch ?? 0) + zoom);
  s.cam.kickX = (s.cam.kickX ?? 0) + dx;
  s.cam.kickY = (s.cam.kickY ?? 0) + dy;
  if (flash > 0) {
    s.cam.flash = Math.min(0.45, Math.max(s.cam.flash ?? 0, flash));
    s.cam.flashColor = flashColor;
  }
}

// ---------------- save / load ----------------
const SAVE_KEY = "emberhold_save_v1";

export function serialize(s: GameState): string {
  const unitCounts: Record<string, number> = {};
  for (const u of s.units) unitCounts[u.type] = (unitCounts[u.type] ?? 0) + 1;
  return JSON.stringify({
    v: 1,
    seed: s.seed,
    time: s.time,
    res: s.res,
    stockLvl: s.stockLvl,
    buildings: s.buildings,
    upg: s.upg,
    tech: s.tech,
    focus: s.focus,
    workerCount: s.workers.length,
    unitCounts,
    rally: s.rally,
    conquest: s.conquest,
    frontX: s.frontX,
    stats: s.stats,
    questsDone: s.questsDone,
    auto: s.auto,
    cam: { x: s.cam.x, y: s.cam.y, z: s.cam.z },
    savedRates: s.rates,
    savedAt: Date.now(),
  });
}

export function writeSave(s: GameState, muted: boolean) {
  try {
    const obj = JSON.parse(serialize(s));
    obj.muted = muted;
    localStorage.setItem(SAVE_KEY, JSON.stringify(obj));
    s.lastSave = s.time;
  } catch {
    /* storage unavailable */
  }
}

export function readSave(): any | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d.v !== 1) return null;
    return d;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* noop */
  }
}
