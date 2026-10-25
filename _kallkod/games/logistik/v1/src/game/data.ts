// ---------- all game tuning data ----------
import type { ResKey, Cost } from "./state";

export const WORLD = {
  w: 2600,
  h: 1300,
  stockX: 420,
  stockY: 660,
  frontStart: 1600,
  frontMin: 1280,
  frontMax: 2440,
  enemyX: 2570,
  rallyX: 1160,
  rallyY: 660,
  warLeash: 420,
};

export const RES_META: Record<ResKey, { label: string; color: string; dark: string }> = {
  wood: { label: "Wood", color: "#d99a55", dark: "#6b4423" },
  stone: { label: "Stone", color: "#a9b4c0", dark: "#4c5560" },
  iron: { label: "Iron", color: "#e08a4c", dark: "#6f4326" },
  crystal: { label: "Crystal", color: "#7fd9ff", dark: "#2a5d75" },
  valor: { label: "Valor", color: "#f2c14d", dark: "#74601c" },
};

export const STORABLE: ResKey[] = ["wood", "stone", "iron", "crystal"];

// ---------------- workers ----------------
export const WORKER = {
  baseCost: { wood: 20, stone: 15 } as Cost,
  costMult: 1.55,
  speed: 74,
  carry: 5,
  harvestTime: 1.0,
  maxWorkers: 24,
  slotsPerBunk: 2,
};

export const workerCost = (count: number): Cost => ({
  wood: Math.round(WORKER.baseCost.wood! * Math.pow(WORKER.costMult, count)),
  stone: Math.round(WORKER.baseCost.stone! * Math.pow(WORKER.costMult, count)),
});

// ---------------- buildings ----------------
export type BuildKey = "bunkhouse" | "workshop" | "barracks" | "forge";

export const BUILDINGS: Record<
  BuildKey,
  {
    name: string;
    desc: string;
    max: number;
    cost: (owned: number) => Cost;
  }
> = {
  bunkhouse: {
    name: "Bunkhouse",
    desc: "+2 worker beds. More hands, more everything.",
    max: 3,
    cost: (c) => ({ wood: Math.round(40 * Math.pow(1.7, c)), stone: Math.round(26 * Math.pow(1.7, c)) }),
  },
  workshop: {
    name: "Workshop",
    desc: "Unlocks economy upgrades for your crew.",
    max: 1,
    cost: () => ({ wood: 90, stone: 60 }),
  },
  barracks: {
    name: "Barracks",
    desc: "Trains soldiers, +6 army size. Wakes the Horde.",
    max: 3,
    cost: (c) => ({ wood: Math.round(120 * Math.pow(1.85, c)), stone: Math.round(95 * Math.pow(1.85, c)) }),
  },
  forge: {
    name: "Forge",
    desc: "Unlocks war upgrades and valor techniques.",
    max: 1,
    cost: () => ({ stone: 100, iron: 60 }),
  },
};

export const stockpileCap = (lvl: number) => Math.round(300 * Math.pow(2, lvl - 1));
export const stockpileCost = (lvl: number): Cost => ({
  wood: Math.round(45 * Math.pow(lvl, 1.7)),
  stone: Math.round(32 * Math.pow(lvl, 1.6)),
});
export const STOCKPILE_MAX = 6;

// ---------------- upgrades ----------------
export interface UpgradeDef {
  id: string;
  name: string;
  scope: "econ" | "war";
  max: number;
  desc: string;
  cost: (lvl: number) => Cost; // lvl = target level (1-based)
}

export const UPGRADES: UpgradeDef[] = [
  { id: "axes", name: "Sharper Tools", scope: "econ", max: 5, desc: "+1 click power · +20% harvest speed", cost: (l) => ({ wood: Math.round(35 * Math.pow(2.1, l - 1)), stone: Math.round(25 * Math.pow(2.1, l - 1)) }) },
  { id: "packs", name: "Big Baskets", scope: "econ", max: 4, desc: "+4 carry per worker", cost: (l) => ({ wood: Math.round(45 * Math.pow(2.2, l - 1)) }) },
  { id: "boots", name: "Trail Boots", scope: "econ", max: 4, desc: "+15% worker move speed", cost: (l) => ({ wood: Math.round(30 * Math.pow(2.1, l - 1)), stone: Math.round(20 * Math.pow(2.1, l - 1)) }) },
  { id: "blades", name: "Tempered Blades", scope: "war", max: 5, desc: "+18% army damage", cost: (l) => ({ iron: Math.round(25 * Math.pow(2.2, l - 1)), valor: Math.round(8 * Math.pow(2.0, l - 1)) }) },
  { id: "plate", name: "Reinforced Plate", scope: "war", max: 5, desc: "+22% army health", cost: (l) => ({ iron: Math.round(20 * Math.pow(2.2, l - 1)), valor: Math.round(8 * Math.pow(2.0, l - 1)) }) },
  { id: "drums", name: "War Drums", scope: "war", max: 3, desc: "+12% train & rally speed", cost: (l) => ({ wood: Math.round(40 * Math.pow(2.4, l - 1)), valor: Math.round(10 * Math.pow(2.1, l - 1)) }) },
];

// ---------------- valor techs ----------------
export interface TechDef {
  id: string;
  name: string;
  max: number;
  desc: (lvl: number) => string;
  cost: (lvl: number) => Cost;
}

export const TECHS: TechDef[] = [
  { id: "strike", name: "Commander Strike", max: 4, desc: (l) => `Click enemies to smite them (${[30, 60, 110, 200][Math.min(l, 3)]} dmg)`, cost: (l) => ({ valor: Math.round(50 * Math.pow(2, l - 1)) }) },
  { id: "archery", name: "Archery", max: 1, desc: () => "Unlocks Archers — long range volleys", cost: () => ({ valor: 30 }) },
  { id: "heavy", name: "Heavy Platecraft", max: 1, desc: () => "Unlocks Guardians — a living wall", cost: () => ({ valor: 70 }) },
  { id: "tactics", name: "Grand Tactics", max: 2, desc: () => "+6 army size", cost: (l) => ({ valor: Math.round(90 * Math.pow(2.4, l - 1)) }) },
  { id: "golem", name: "Golemancy", max: 1, desc: () => "Unlocks War Golems — slow, unstoppable", cost: () => ({ valor: 160 }) },
];

export const STRIKE_DMG = [0, 30, 60, 110, 200];

// ---------------- units ----------------
export type UnitKey = "militia" | "archer" | "guardian" | "golem";
export interface UnitDef {
  key: UnitKey;
  name: string;
  desc: string;
  cost: Cost;
  hp: number;
  dmg: number;
  rng: number;
  spd: number;
  cd: number;
  train: number;
  tech?: string;
  ranged: boolean;
  aoe?: number;
}

export const UNITS: Record<UnitKey, UnitDef> = {
  militia: { key: "militia", name: "Militia", desc: "Cheap steel, brave hearts.", cost: { wood: 12, stone: 8 }, hp: 45, dmg: 7, rng: 20, spd: 58, cd: 1.0, train: 3.5, ranged: false },
  archer: { key: "archer", name: "Archer", desc: "Death from four fields away.", cost: { wood: 16, iron: 14 }, hp: 30, dmg: 11, rng: 165, spd: 54, cd: 1.5, train: 4.5, tech: "archery", ranged: true },
  guardian: { key: "guardian", name: "Guardian", desc: "The line does not break.", cost: { stone: 26, iron: 18 }, hp: 190, dmg: 13, rng: 22, spd: 42, cd: 1.2, train: 6.5, tech: "heavy", ranged: false },
  golem: { key: "golem", name: "War Golem", desc: "A landslide with a grudge.", cost: { iron: 45, crystal: 12 }, hp: 560, dmg: 36, rng: 30, spd: 30, cd: 1.8, train: 10, tech: "golem", ranged: false, aoe: 75 },
};

export const UNIT_ORDER: UnitKey[] = ["militia", "archer", "guardian", "golem"];
export const armyCap = (barracks: number, tacticsLvl: number) => 8 + barracks * 6 + tacticsLvl * 6;

// ---------------- enemies ----------------
export type EnemyKey = "raider" | "brute" | "shaman" | "warlord";
export interface EnemyDef {
  key: EnemyKey;
  name: string;
  hp: number;
  dmg: number;
  rng: number;
  spd: number;
  cd: number;
  valor: number;
  ranged: boolean;
  scale: number;
}

export const ENEMIES: Record<EnemyKey, EnemyDef> = {
  raider: { key: "raider", name: "Raider", hp: 34, dmg: 6, rng: 18, spd: 48, cd: 1.1, valor: 1, ranged: false, scale: 1 },
  brute: { key: "brute", name: "Brute", hp: 135, dmg: 14, rng: 22, spd: 33, cd: 1.4, valor: 3, ranged: false, scale: 1.45 },
  shaman: { key: "shaman", name: "Shaman", hp: 55, dmg: 12, rng: 135, spd: 38, cd: 1.6, valor: 5, ranged: true, scale: 1.05 },
  warlord: { key: "warlord", name: "Warlord", hp: 750, dmg: 32, rng: 26, spd: 30, cd: 1.5, valor: 25, ranged: false, scale: 2.1 },
};

export function waveComp(n: number): { type: EnemyKey; count: number }[] {
  const out: { type: EnemyKey; count: number }[] = [];
  const raiders = Math.min(30, 2 + Math.ceil(n * 0.9));
  const brutes = Math.min(18, Math.max(0, Math.floor((n - 1) * 0.6)));
  const shamans = Math.min(12, Math.max(0, Math.floor((n - 3) * 0.5)));
  out.push({ type: "raider", count: raiders });
  if (brutes > 0) out.push({ type: "brute", count: brutes });
  if (shamans > 0) out.push({ type: "shaman", count: shamans });
  if (n % 5 === 0) out.push({ type: "warlord", count: 1 });
  return out;
}

export const waveHpMult = (n: number) => 1 + 0.07 * (n - 1);
export const waveDmgMult = (n: number) => 1 + 0.045 * (n - 1);
export const WAVE_INTERVAL = 28;

export function spoils(n: number): Cost {
  const c: Cost = {
    wood: 15 + 8 * n,
    stone: 10 + 6 * n,
    iron: 8 + 4 * n,
    valor: 5 + Math.ceil(n / 2),
  };
  if (n >= 4) c.crystal = 2 + Math.round(n / 2);
  return c;
}

// ---------------- quests ----------------
export interface QuestDef {
  id: string;
  name: string;
  desc: string;
  target: number;
  reward: Cost;
  prog: (s: any) => number;
}

export const QUESTS: QuestDef[] = [
  { id: "q_chop", name: "First Splinters", desc: "Gather 30 wood (click the trees)", target: 30, reward: { wood: 20 }, prog: (s) => s.stats.gatheredWood },
  { id: "q_worker", name: "Helping Hands", desc: "Hire your first worker", target: 1, reward: { wood: 15, stone: 10 }, prog: (s) => s.workers.length },
  { id: "q_stock", name: "Stock Up", desc: "Hold 120 resources at once", target: 120, reward: { iron: 15 }, prog: (s) => s.res.wood + s.res.stone + s.res.iron + s.res.crystal },
  { id: "q_barracks", name: "Raise the Colors", desc: "Build a Barracks", target: 1, reward: { iron: 20, valor: 10 }, prog: (s) => s.buildings.barracks },
  { id: "q_blood", name: "First Blood", desc: "Repel a wave of the Horde", target: 1, reward: { valor: 25 }, prog: (s) => s.stats.wavesWon },
  { id: "q_line", name: "The Line Moves", desc: "Reach Conquest 3", target: 3, reward: { crystal: 12 }, prog: (s) => s.conquest },
  { id: "q_econ", name: "A Working Machine", desc: "Employ 6 workers", target: 6, reward: { wood: 45, stone: 40 }, prog: (s) => s.workers.length },
  { id: "q_army", name: "Steel Company", desc: "Field 10 soldiers at once", target: 10, reward: { iron: 25, crystal: 8 }, prog: (s) => s.units.length },
  { id: "q_push", name: "No Ground Given", desc: "Reach Conquest 6", target: 6, reward: { valor: 60 }, prog: (s) => s.conquest },
  { id: "q_legend", name: "The Ember Frontier", desc: "Reach Conquest 10", target: 10, reward: { valor: 120, crystal: 60 }, prog: (s) => s.conquest },
];

// building plot positions
export const PLOTS = {
  bunkhouse: [
    { x: 250, y: 470 },
    { x: 240, y: 660 },
    { x: 250, y: 860 },
  ],
  workshop: [{ x: 640, y: 480 }],
  barracks: [
    { x: 660, y: 860 },
    { x: 860, y: 880 },
    { x: 560, y: 1020 },
  ],
  forge: [{ x: 880, y: 500 }],
};
