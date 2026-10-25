// ---------- central mutable game state ----------
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
}

export interface ProjEnt {
  x1: number; y1: number; x2: number; y2: number;
  t: number; dur: number; dmg: number; friend: boolean;
  targetId: number; kind: "arrow" | "bolt";
}

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  kind: "chip" | "smoke" | "flame" | "spark" | "poof" | "ember" | "leaf" | "glow" | "dust" | "ash" | "zap";
  grav: number;
}

export interface FloatText {
  id: number;
  x: number; y: number;
  life: number; max: number;
  text: string; color: string; size: number;
}

export interface Orb {
  id: number;
  x: number; y: number; sx: number; sy: number; tx: number; ty: number;
  t: number; dur: number;
  res: ResKey; amt: number;
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
}

export interface GameState {
  seed: number;
  time: number;
  paused: boolean;
  started: boolean;
  res: Record<ResKey, number>;
  stockLvl: number;
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
  if (res === "wood") s.stats.gatheredWood += amt;
  s.stats.totalEarned += amt;
  s.stats.earnedRun += amt;
}

export function toast(s: GameState, kind: Toast["kind"], title: string, sub?: string) {
  s.toasts.push({ id: uid(), kind, title, sub, t: 4.5 });
  if (s.toasts.length > 5) s.toasts.shift();
}

export function float(s: GameState, x: number, y: number, text: string, color: string, size = 13) {
  s.floats.push({ id: uid(), x, y, life: 1.4, max: 1.4, text, color, size });
  if (s.floats.length > 70) s.floats.shift();
}

export function addParticle(s: GameState, p: Omit<Particle, "life" | "max"> & { life: number }) {
  s.particles.push({ ...p, max: p.life });
  if (s.particles.length > 420) s.particles.splice(0, s.particles.length - 420);
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
