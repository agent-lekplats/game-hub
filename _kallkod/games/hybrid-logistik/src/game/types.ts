export type ResType = 'wood' | 'stone' | 'food' | 'iron' | 'weapons';
export type NodeType = 'tree' | 'rock' | 'ore' | 'wheat';
export type BuildingType =
  | 'depot' | 'house' | 'storehouse' | 'farm' | 'mine' | 'forge' | 'barracks' | 'cartyard' | 'tower';

export interface Resources { wood: number; stone: number; food: number; iron: number; weapons: number; gold: number }

export interface ResNode {
  id: number; type: NodeType; x: number; y: number;
  amount: number; max: number; regrow: number; scale: number; wobble: number;
}

export interface Building {
  id: number; type: BuildingType; x: number; y: number;
  progress: number; timer: number; output: number; outputType: ResType | null;
  anim: number; reserved: number;
}

export type WorkerState = 'idle' | 'toNode' | 'gather' | 'toDepot' | 'toBuild' | 'build' | 'toPile';

export interface Worker {
  id: number; x: number; y: number; tx: number; ty: number;
  state: WorkerState; carry: ResType | null; carryAmt: number;
  targetId: number; timer: number; facing: number; bob: number;
  isCart: boolean; wait: number; hue: number;
}

export interface Unit {
  id: number; x: number; y: number; hp: number; maxHp: number; atk: number;
  side: 'ally' | 'enemy'; cd: number; kind: number; anim: number; lunge: number;
}

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number; g: number }
export interface Drop { x: number; y: number; z: number; vz: number; vx: number; vy: number; type: ResType | 'gold'; life: number; tx?: number; ty?: number }
export interface Floater { x: number; y: number; text: string; life: number; color: string }

export interface Research { id: string; name: string; desc: string; cost: number; bought: boolean; icon: string }

export interface Frontline {
  sector: number; fortressHp: number; fortressMax: number; spawnTimer: number;
  gateHp: number; gateMax: number; conquered: number; banner: number; bannerText: string;
  shake: number;
}

export interface Stats { totalGathered: number; delivered: number; kills: number; built: number }

export interface GameState {
  t: number; res: Resources; cap: number;
  nodes: ResNode[]; buildings: Building[]; workers: Worker[]; units: Unit[];
  particles: Particle[]; drops: Drop[]; floaters: Floater[];
  territory: number; center: { x: number; y: number };
  workerCap: number; nextId: number;
  priority: Record<ResType, number>;
  front: Frontline; research: Research[]; stats: Stats;
  placing: BuildingType | null; hoverX: number; hoverY: number;
  speed: number; muted: boolean; log: string[];
  prodMult: number;
}

export const WORLD_W = 1280;
export const WORLD_H = 720;
export const BASE_W = 880;
export const LANE_X = 920;
export const LANE_W = 340;

export const BUILDING_INFO: Record<BuildingType, { name: string; cost: Partial<Resources>; desc: string; size: number; color: string; icon: string }> = {
  depot: { name: 'Depot', cost: {}, desc: 'Heart of the settlement.', size: 46, color: '#c8a365', icon: '🏛️' },
  house: { name: 'Cottage', cost: { wood: 20 }, desc: '+2 workers who walk out and get to work.', size: 30, color: '#d9b382', icon: '🏠' },
  storehouse: { name: 'Storehouse', cost: { wood: 30, stone: 10 }, desc: '+120 storage. Workers deliver here too.', size: 36, color: '#b08a5a', icon: '📦' },
  farm: { name: 'Farm', cost: { wood: 25 }, desc: 'Grows wheat plots that workers harvest for food.', size: 34, color: '#d8c46a', icon: '🌾' },
  mine: { name: 'Mine', cost: { wood: 20, stone: 30 }, desc: 'Digs iron into a pile that must be hauled.', size: 34, color: '#8d8d99', icon: '⛏️' },
  forge: { name: 'Forge', cost: { stone: 40, iron: 10 }, desc: 'Turns 2 iron + 1 wood into a weapon crate.', size: 36, color: '#a6553a', icon: '🔥' },
  barracks: { name: 'Barracks', cost: { wood: 50, stone: 30 }, desc: '5 food + 1 weapon → a soldier marching to the front.', size: 40, color: '#8a4b4b', icon: '⚔️' },
  cartyard: { name: 'Cart Yard', cost: { wood: 60, iron: 10 }, desc: 'Adds a fast cart that hauls building output.', size: 34, color: '#a37a4b', icon: '🛒' },
  tower: { name: 'Watchtower', cost: { wood: 40, stone: 40 }, desc: 'Pushes the border outward (+70 radius).', size: 26, color: '#9aa3a8', icon: '🗼' },
};

export const RES_COLORS: Record<ResType | 'gold', string> = {
  wood: '#a86b3c', stone: '#9aa0a6', food: '#e6c14a', iron: '#6f7f99', weapons: '#d95f43', gold: '#ffd54a',
};
