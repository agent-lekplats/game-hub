// ---------- Core types & static game data ----------
export type ResId = 'wood' | 'stone' | 'food' | 'iron' | 'weapons' | 'gold';
export type Stock = Partial<Record<ResId, number>>;
export const RES: ResId[] = ['wood', 'stone', 'food', 'iron', 'weapons', 'gold'];

export const RES_INFO: Record<ResId, { name: string; emoji: string; color: string; dark: string; light: string }> = {
  wood: { name: 'Wood', emoji: '🪵', color: '#b07a3c', dark: '#7a5124', light: '#dba86a' },
  stone: { name: 'Stone', emoji: '🪨', color: '#9aa3ad', dark: '#67707a', light: '#cfd6dc' },
  food: { name: 'Food', emoji: '🌾', color: '#e0b24f', dark: '#a37b26', light: '#f5d98a' },
  iron: { name: 'Iron', emoji: '⛓️', color: '#6f7d8c', dark: '#3a444e', light: '#a9b7c4' },
  weapons: { name: 'Weapons', emoji: '⚔️', color: '#b8453a', dark: '#7c2a22', light: '#e58a7f' },
  gold: { name: 'Gold', emoji: '🪙', color: '#e9c23b', dark: '#a6841a', light: '#fbe38a' },
};

export type BuildingKind =
  | 'storehouse' | 'house' | 'woodcutter' | 'quarry' | 'farm' | 'mine' | 'smithy'
  | 'warehouse' | 'donkeypen' | 'stable' | 'elephantstable' | 'barracks';

export type HaulerKind = 'founder' | 'porter' | 'donkey' | 'wagon' | 'elephant';

export interface Pt { x: number; y: number }

export interface Building {
  id: number; kind: BuildingKind; variant: string; level: number; tier: number;
  x: number; y: number; w: number; h: number;
  workers: number; progress: number; built: number; flash: number;
  input: Stock; output: Stock; store: Stock; inbound: Stock;
  reserved: number; blocked: boolean; starved: boolean;
  garrison: number; trainProg: number; autoTrain: boolean; seed: number;
}

export type HaulerState = 'idle' | 'toPickup' | 'loading' | 'toDrop' | 'unloading' | 'wander';
export interface Hauler {
  id: number; kind: HaulerKind; x: number; y: number; angle: number; headAngle: number;
  state: HaulerState; path: Pt[]; pi: number; timer: number; phase: number; moving: boolean;
  cargo: Stock; load: number; capacity: number; speed: number;
  pickupId: number; dropId: number; homeId: number; want: ResId | null; wantAmt: number; reservedAmt: number;
  dist: number; lateral: number; queue: number[]; jobKind: 'pile' | 'supply' | 'none'; supplyFrom: number;
  loadRate: number; onRoad: boolean;
}

export interface ConvItem { res: ResId; lane: 0 | 1; pos: number }
export type ConvSink = { type: 'building'; id: number } | { type: 'conv'; id: number; idx: number } | null;
export interface Conveyor {
  id: number; tiles: Pt[]; items: ConvItem[]; laneRes: (ResId | null)[]; staffed: number; moved: number;
  srcIds: number[]; sink: ConvSink; built: number;
}

export type WalkerKind = 'idle' | 'soldier' | 'lootcart' | 'returning';
export interface Walker {
  x: number; y: number; angle: number; timer: number; phase: number; kind: WalkerKind;
  path: Pt[]; pi: number; payload?: Stock; tone: number; count?: number;
}

export interface Particle {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number;
  kind: 'smoke' | 'dust' | 'spark' | 'leaf' | 'text' | 'ring' | 'star'; text?: string; color?: string; size: number;
}

export interface Frontline {
  stage: number; state: 'idle' | 'marching' | 'fighting' | 'resting' | 'returning';
  army: number; hp: number; maxHp: number; enemyHp: number; enemyMax: number; timer: number; wins: number; auto: boolean;
  log: string[]; fed: boolean; losses: number; hitFlash: number; enemyFlash: number; lootPending: Stock | null;
}

export interface Tree { x: number; y: number; size: number; phase: number; kind: number; shake: number }
export interface Rock { x: number; y: number; size: number; ore: boolean; kind: number }

export interface GameState {
  version: number; time: number;
  W: number; H: number; CH: number; owned: boolean[];
  terrain: number[]; // 0 grass 1 road
  buildings: Building[]; conveyors: Conveyor[]; haulers: Hauler[]; walkers: Walker[]; trees: Tree[]; rocks: Rock[];
  nextId: number; population: number; growth: number; hunger: number;
  stats: { hand: number; conveyed: number; delivered: number; animalHauled: number; soldiers: number; expansions: number; built: number };
  unlocked: Record<string, boolean>; goalIdx: number; tech: Record<string, number>;
  frontline: Frontline; speed: number; paused: boolean; muted: boolean;
  messages: { text: string; t: number; kind: string }[]; goalFlash: number;
}

// ---------- Visual spec per building level ----------
export interface Vis {
  floors?: number; roof?: 'thatch' | 'tile' | 'flat' | 'slate' | 'wood'; wall?: string; roofColor?: string;
  chimneys?: number; extension?: boolean; balcony?: boolean; tower?: boolean; scale?: number; sign?: string; banner?: boolean;
  windows?: number; crane?: boolean; wheel?: boolean; silo?: boolean; mill?: boolean; rail?: boolean; fence?: boolean; lights?: boolean;
}

export interface LevelDef {
  name: string; desc: string; cost: Stock; workers: number;
  cycle?: number; produces?: { res: ResId; amt: number }; consumes?: Stock;
  outCap: number; storeCap?: number; popCap?: number; inputCap?: number;
  haulers?: { kind: HaulerKind; count: number; capacity: number }; garrison?: number; trainTime?: number; vet?: number;
  goldPerMin?: number; founderCarry?: number; weaponTier?: number;
  height: number; vis: Vis; next?: string[];
}

export interface BuildingDef {
  kind: BuildingKind; name: string; emoji: string; w: number; h: number;
  category: 'homes' | 'production' | 'logistics' | 'military';
  placement: 'any' | 'trees' | 'rock' | 'ore'; unique?: boolean; accepts?: ResId[];
  variants: Record<string, LevelDef[]>; hint: string;
}

const H = (partial: Partial<LevelDef> & { name: string; desc: string; cost: Stock }): LevelDef => ({
  workers: 0, outCap: 0, height: 1, vis: {}, ...partial,
});

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  storehouse: {
    kind: 'storehouse', name: 'Storehouse', emoji: '🏛️', w: 3, h: 3, category: 'logistics', placement: 'any', unique: true,
    accepts: RES, hint: 'Central storage. Only goods stored here (or in warehouses) can be spent.',
    variants: {
      base: [
        H({ name: 'Storehouse', desc: 'Central storage. Goods here can be spent.', cost: {}, storeCap: 150, founderCarry: 2, height: 1.4, vis: { roof: 'thatch', wall: '#c9a97a', floors: 1 } }),
        H({ name: 'Storehouse II', desc: 'Adds a second floor and a loading dock. Capacity 400. You carry 3 boxes.', cost: { wood: 60, stone: 30 }, storeCap: 400, founderCarry: 3, height: 1.9, vis: { roof: 'tile', wall: '#d2b283', floors: 2 } }),
        H({ name: 'Trading Post', desc: 'Stone foundation, hoist crane and covered yard. Capacity 1000. You carry 4.', cost: { wood: 150, stone: 100, iron: 20 }, storeCap: 1000, founderCarry: 4, height: 2.3, vis: { roof: 'tile', wall: '#d9c39a', floors: 2, crane: true, banner: true } }),
        H({ name: 'Grand Depot', desc: 'A bell tower and a third floor. Capacity 3000. You carry 6.', cost: { wood: 400, stone: 300, iron: 80, gold: 80 }, storeCap: 3000, founderCarry: 6, height: 2.9, vis: { roof: 'slate', wall: '#e3d3b4', floors: 3, crane: true, tower: true, banner: true } }),
      ],
    },
  },
  house: {
    kind: 'house', name: 'House', emoji: '🏠', w: 2, h: 2, category: 'homes', placement: 'any', hint: 'Homes raise your population. People need food to move in.',
    variants: {
      base: [
        H({ name: 'Hut', desc: 'A small hut with a garden. Houses 3.', cost: { wood: 20 }, popCap: 3, height: 1, vis: { roof: 'thatch', wall: '#d5b58a', floors: 1, scale: 0.62 } }),
        H({ name: 'Cottage', desc: 'An extension and a chimney. Houses 6.', cost: { wood: 35, stone: 10 }, popCap: 6, height: 1.2, vis: { roof: 'thatch', wall: '#dcbd93', floors: 1, chimneys: 1, extension: true, scale: 0.85 } }),
        H({ name: 'House', desc: 'A second floor with more windows. Houses 10.', cost: { wood: 60, stone: 35 }, popCap: 10, height: 1.8, vis: { roof: 'tile', wall: '#e2c79d', floors: 2, chimneys: 1, scale: 0.95 }, next: ['tenement', 'merchant'] }),
      ],
      tenement: [
        H({ name: 'Worker Housing', desc: 'Three floors of families and laundry lines. Houses 18.', cost: { wood: 90, stone: 60 }, popCap: 18, height: 2.5, vis: { roof: 'flat', wall: '#c9b08a', floors: 3, chimneys: 2, balcony: true, scale: 1 } }),
        H({ name: 'Tenement Block', desc: 'Four floors and a courtyard well. Houses 30.', cost: { wood: 160, stone: 120, iron: 10 }, popCap: 30, height: 3.2, vis: { roof: 'flat', wall: '#bfa47c', floors: 4, chimneys: 3, balcony: true, scale: 1 } }),
      ],
      merchant: [
        H({ name: 'Merchant Residence', desc: 'Fine timber and a tiled roof. Houses 8 and earns 3 gold/min from trade.', cost: { wood: 80, stone: 80, iron: 10 }, popCap: 8, goldPerMin: 3, height: 2.1, vis: { roof: 'tile', wall: '#f0e2c4', floors: 2, chimneys: 1, balcony: true, scale: 1, roofColor: '#7a4b8c' } }),
        H({ name: 'Merchant Manor', desc: 'A manor with a private tower. Houses 12 and earns 8 gold/min.', cost: { wood: 150, stone: 150, iron: 30, gold: 40 }, popCap: 12, goldPerMin: 8, height: 2.8, vis: { roof: 'slate', wall: '#f4e9d2', floors: 3, chimneys: 2, balcony: true, tower: true, scale: 1, roofColor: '#5f3a73' } }),
      ],
    },
  },
  woodcutter: {
    kind: 'woodcutter', name: 'Woodcutter', emoji: '🪓', w: 2, h: 2, category: 'production', placement: 'trees', hint: 'Must be built next to trees. Produces wood into its yard.',
    variants: {
      base: [
        H({ name: 'Woodcutter', desc: 'One worker chops nearby trees. 1 wood / 4s.', cost: { wood: 15 }, workers: 1, cycle: 4, produces: { res: 'wood', amt: 1 }, outCap: 20, height: 1, vis: { roof: 'wood', wall: '#a97d4e', floors: 1, scale: 0.75 } }),
        H({ name: 'Lumber Camp', desc: 'A second worker and a bigger log yard (holds 40).', cost: { wood: 40, stone: 15 }, workers: 2, cycle: 4, produces: { res: 'wood', amt: 1 }, outCap: 40, height: 1.2, vis: { roof: 'wood', wall: '#b0834f', floors: 1, chimneys: 1, scale: 0.9 } }),
        H({ name: 'Sawmill', desc: 'A water-wheel saw. 3 workers, 1 wood / 3s each, yard holds 150.', cost: { wood: 80, stone: 40, iron: 10 }, workers: 3, cycle: 3, produces: { res: 'wood', amt: 1 }, outCap: 150, height: 1.6, vis: { roof: 'tile', wall: '#b88a55', floors: 2, chimneys: 1, wheel: true, scale: 1 } }),
      ],
    },
  },
  farm: {
    kind: 'farm', name: 'Farm', emoji: '🌾', w: 3, h: 3, category: 'production', placement: 'any', hint: 'Grows food. Your people eat, and soldiers march on their stomachs.',
    variants: {
      base: [
        H({ name: 'Farm', desc: 'Two farmers tend three fields. 2 food / 6s.', cost: { wood: 25 }, workers: 2, cycle: 6, produces: { res: 'food', amt: 2 }, outCap: 24, height: 0.9, vis: { roof: 'thatch', wall: '#d8b98b', scale: 0.7 } }),
        H({ name: 'Big Farm', desc: 'More fields and a silo. 3 workers, 2 food / 5s.', cost: { wood: 45, stone: 20 }, workers: 3, cycle: 5, produces: { res: 'food', amt: 2 }, outCap: 40, height: 1.1, vis: { roof: 'thatch', wall: '#deba8a', silo: true, scale: 0.8 } }),
        H({ name: 'Estate', desc: 'A windmill grinds grain. 4 workers, 3 food / 4s, yard holds 150.', cost: { wood: 80, stone: 50, iron: 10 }, workers: 4, cycle: 4, produces: { res: 'food', amt: 3 }, outCap: 150, height: 1.4, vis: { roof: 'tile', wall: '#e5c99c', silo: true, mill: true, scale: 0.9 } }),
      ],
    },
  },
  quarry: {
    kind: 'quarry', name: 'Quarry', emoji: '⛏️', w: 2, h: 2, category: 'production', placement: 'rock', hint: 'Must be built next to rocks. Produces stone.',
    variants: {
      base: [
        H({ name: 'Quarry', desc: 'One worker splits rock. 1 stone / 5s.', cost: { wood: 30 }, workers: 1, cycle: 5, produces: { res: 'stone', amt: 1 }, outCap: 20, height: 0.8, vis: { roof: 'wood', wall: '#a9a29a', scale: 0.7 } }),
        H({ name: 'Stone Pit', desc: 'Scaffolding and a second worker. Yard holds 40.', cost: { wood: 50, stone: 30 }, workers: 2, cycle: 5, produces: { res: 'stone', amt: 1 }, outCap: 40, height: 1.1, vis: { roof: 'wood', wall: '#b1aaa1', scale: 0.85 } }),
        H({ name: 'Masonry Quarry', desc: 'A crane lifts blocks. 3 workers, 1 stone / 3.5s each, yard holds 150.', cost: { wood: 90, stone: 60, iron: 15 }, workers: 3, cycle: 3.5, produces: { res: 'stone', amt: 1 }, outCap: 150, height: 1.4, vis: { roof: 'tile', wall: '#bdb6ad', crane: true, scale: 1 } }),
      ],
    },
  },
  mine: {
    kind: 'mine', name: 'Iron Mine', emoji: '⚒️', w: 2, h: 2, category: 'production', placement: 'ore', hint: 'Must be built next to ore (orange rocks, found in outer lands).',
    variants: {
      base: [
        H({ name: 'Mine', desc: 'One miner digs ore. 1 iron / 6s.', cost: { wood: 40, stone: 20 }, workers: 1, cycle: 6, produces: { res: 'iron', amt: 1 }, outCap: 20, height: 1, vis: { wall: '#7d6f66', scale: 0.8 } }),
        H({ name: 'Deep Mine', desc: 'A rail and mine cart. 2 miners, yard holds 40.', cost: { wood: 60, stone: 50 }, workers: 2, cycle: 5, produces: { res: 'iron', amt: 1 }, outCap: 40, height: 1.3, vis: { wall: '#7d6f66', rail: true, scale: 0.9 } }),
        H({ name: 'Iron Works', desc: 'Headframe and pump. 3 miners, 1 iron / 3.5s each, yard holds 200.', cost: { wood: 100, stone: 80, iron: 20 }, workers: 3, cycle: 3.5, produces: { res: 'iron', amt: 1 }, outCap: 200, height: 1.9, vis: { wall: '#6e625a', rail: true, tower: true, chimneys: 1, scale: 1 } }),
      ],
    },
  },
  smithy: {
    kind: 'smithy', name: 'Smithy', emoji: '🔥', w: 2, h: 2, category: 'production', placement: 'any', accepts: ['iron', 'wood'], hint: 'Forges weapons from iron + wood. Needs deliveries (haulers or conveyors).',
    variants: {
      base: [
        H({ name: 'Smithy', desc: '1 iron + 1 wood → 1 weapon every 6s.', cost: { wood: 40, stone: 30 }, workers: 1, cycle: 6, consumes: { iron: 1, wood: 1 }, produces: { res: 'weapons', amt: 1 }, outCap: 20, inputCap: 12, weaponTier: 0, height: 1.1, vis: { roof: 'wood', wall: '#8d6b55', chimneys: 1, scale: 0.85 } }),
        H({ name: 'Forge', desc: 'Two smiths and twin chimneys. Faster, holds more input.', cost: { wood: 60, stone: 60, iron: 10 }, workers: 2, cycle: 5, consumes: { iron: 1, wood: 1 }, produces: { res: 'weapons', amt: 1 }, outCap: 30, inputCap: 24, weaponTier: 0, height: 1.4, vis: { roof: 'tile', wall: '#94705a', chimneys: 2, scale: 0.95 } }),
        H({ name: 'Armory', desc: 'Weapon tier +1: soldiers hit 50% harder. 3 smiths.', cost: { wood: 120, stone: 100, iron: 40 }, workers: 3, cycle: 4, consumes: { iron: 1, wood: 1 }, produces: { res: 'weapons', amt: 1 }, outCap: 40, inputCap: 36, weaponTier: 1, height: 1.8, vis: { roof: 'slate', wall: '#9c7a64', chimneys: 2, floors: 2, banner: true, scale: 1 } }),
      ],
    },
  },
  warehouse: {
    kind: 'warehouse', name: 'Warehouse', emoji: '📦', w: 3, h: 2, category: 'logistics', placement: 'any', accepts: RES, hint: 'Extra storage. Haulers and conveyors deliver here. Grows bigger as it fills.',
    variants: {
      base: [
        H({ name: 'Warehouse', desc: 'Stores 300 goods.', cost: { wood: 40, stone: 20 }, storeCap: 300, height: 1.3, vis: { roof: 'wood', wall: '#b9956a', floors: 1 } }),
        H({ name: 'Large Warehouse', desc: 'An extra wing. Stores 800.', cost: { wood: 70, stone: 50 }, storeCap: 800, height: 1.6, vis: { roof: 'tile', wall: '#c19d70', floors: 1, extension: true } }),
        H({ name: 'Depot', desc: 'Two floors and a loading dock. Stores 2000.', cost: { wood: 140, stone: 120, iron: 20 }, storeCap: 2000, height: 2.2, vis: { roof: 'tile', wall: '#c8a67a', floors: 2, extension: true, crane: true } }),
        H({ name: 'Great Depot', desc: 'A stone hall. Stores 6000.', cost: { wood: 300, stone: 250, iron: 60 }, storeCap: 6000, height: 2.8, vis: { roof: 'slate', wall: '#d4b58b', floors: 3, extension: true, crane: true, tower: true } }),
      ],
    },
  },
  donkeypen: {
    kind: 'donkeypen', name: 'Donkey Pen', emoji: '🫏', w: 2, h: 2, category: 'logistics', placement: 'any', hint: 'Donkeys haul 10 boxes per trip from big piles to storage.',
    variants: {
      base: [
        H({ name: 'Donkey Pen', desc: 'Two donkeys, 10 boxes each. One handler.', cost: { wood: 30, food: 10 }, workers: 1, haulers: { kind: 'donkey', count: 2, capacity: 10 }, height: 0.6, vis: { fence: true, scale: 0.7 } }),
        H({ name: 'Donkey Yard', desc: 'Four donkeys and a shelter.', cost: { wood: 50, stone: 20, food: 30 }, workers: 1, haulers: { kind: 'donkey', count: 4, capacity: 10 }, height: 0.9, vis: { fence: true, roof: 'thatch', scale: 0.8 } }),
        H({ name: 'Caravan Yard', desc: 'Six donkeys with sturdy saddlebags: 15 boxes each.', cost: { wood: 80, stone: 40, food: 60 }, workers: 2, haulers: { kind: 'donkey', count: 6, capacity: 15 }, height: 1.1, vis: { fence: true, roof: 'wood', scale: 0.9 } }),
      ],
    },
  },
  stable: {
    kind: 'stable', name: 'Stable', emoji: '🐎', w: 3, h: 3, category: 'logistics', placement: 'any', hint: 'Horse-drawn wagons move 100 boxes per trip. Fast on roads.',
    variants: {
      base: [
        H({ name: 'Stable', desc: 'One horse and wagon, 100 boxes per trip.', cost: { wood: 80, stone: 60, iron: 20 }, workers: 1, haulers: { kind: 'wagon', count: 1, capacity: 100 }, height: 1.4, vis: { roof: 'wood', wall: '#b88f62', fence: true, scale: 0.85 } }),
        H({ name: 'Horse Farm', desc: 'Two wagons and a paddock.', cost: { wood: 120, stone: 80, iron: 30 }, workers: 2, haulers: { kind: 'wagon', count: 2, capacity: 100 }, height: 1.6, vis: { roof: 'tile', wall: '#c09668', fence: true, extension: true, scale: 0.95 } }),
        H({ name: 'Coach House', desc: 'Three heavy wagons, 150 boxes each.', cost: { wood: 200, stone: 150, iron: 60 }, workers: 2, haulers: { kind: 'wagon', count: 3, capacity: 150 }, height: 2, vis: { roof: 'slate', wall: '#c9a074', fence: true, extension: true, floors: 2, scale: 1 } }),
      ],
    },
  },
  elephantstable: {
    kind: 'elephantstable', name: 'Elephant Stable', emoji: '🐘', w: 4, h: 3, category: 'logistics', placement: 'any', hint: 'War elephants carry 1000 boxes. Slow, enormous, unforgettable.',
    variants: {
      base: [
        H({ name: 'Elephant Stable', desc: 'One elephant carrying 1000 boxes per trip.', cost: { wood: 250, stone: 250, iron: 60, gold: 100 }, workers: 2, haulers: { kind: 'elephant', count: 1, capacity: 1000 }, height: 2.4, vis: { roof: 'tile', wall: '#c9a07a', fence: true, scale: 0.9, roofColor: '#b0443c' } }),
        H({ name: 'Elephant Hall', desc: 'Two elephants with grand howdahs: 1500 boxes each.', cost: { wood: 400, stone: 400, iron: 120, gold: 200 }, workers: 3, haulers: { kind: 'elephant', count: 2, capacity: 1500 }, height: 3, vis: { roof: 'slate', wall: '#d4ac83', fence: true, tower: true, banner: true, scale: 1, roofColor: '#8c2f6e' } }),
      ],
    },
  },
  barracks: {
    kind: 'barracks', name: 'Barracks', emoji: '🛡️', w: 3, h: 3, category: 'military', placement: 'any', hint: 'Trains soldiers (1 person + 1 weapon + 5 food). Dispatch them to the frontline.',
    variants: {
      base: [
        H({ name: 'Barracks', desc: 'Trains 1 soldier / 5s. Garrison of 10.', cost: { wood: 60, stone: 40 }, garrison: 10, trainTime: 5, vet: 0, height: 1.5, vis: { roof: 'wood', wall: '#8f8578', banner: true, scale: 0.85 } }),
        H({ name: 'Garrison', desc: 'Training yard: 1 soldier / 3.5s. Garrison 25.', cost: { wood: 100, stone: 80, iron: 20 }, garrison: 25, trainTime: 3.5, vet: 0, height: 1.9, vis: { roof: 'slate', wall: '#9a9083', banner: true, tower: true, scale: 0.95 } }),
        H({ name: 'Fortress', desc: 'Veteran drills: soldiers have +25% health. Garrison 50.', cost: { wood: 200, stone: 200, iron: 60 }, garrison: 50, trainTime: 2.5, vet: 0.25, height: 2.5, vis: { roof: 'flat', wall: '#a39a8c', banner: true, tower: true, floors: 2, scale: 1 } }),
      ],
    },
  },
};

export const BUILD_ORDER: BuildingKind[] = ['house', 'woodcutter', 'farm', 'quarry', 'mine', 'smithy', 'warehouse', 'donkeypen', 'stable', 'elephantstable', 'barracks'];

export function levelDef(b: { kind: BuildingKind; variant: string; level: number }): LevelDef {
  const def = BUILDINGS[b.kind];
  const chain = def.variants[b.variant] || def.variants.base;
  return chain[Math.min(b.level, chain.length - 1)];
}

// ---------- Haulers ----------
export const HAULER_INFO: Record<HaulerKind, { name: string; speed: number; turn: number; loadTime: number; emoji: string; minPile: number }> = {
  founder: { name: 'You', speed: 2.7, turn: 14, loadTime: 0.5, emoji: '🧑‍🌾', minPile: 1 },
  porter: { name: 'Porter', speed: 2.3, turn: 12, loadTime: 0.6, emoji: '🧍', minPile: 1 },
  donkey: { name: 'Donkey', speed: 2.0, turn: 7, loadTime: 1.5, emoji: '🫏', minPile: 4 },
  wagon: { name: 'Horse & Wagon', speed: 1.6, turn: 3.5, loadTime: 3, emoji: '🐎', minPile: 25 },
  elephant: { name: 'Elephant', speed: 1.05, turn: 2.2, loadTime: 5, emoji: '🐘', minPile: 200 },
};

// ---------- Techniques (global upgrades) ----------
export interface TechDef { id: string; name: string; desc: string; max: number; cost: (n: number) => Stock; emoji: string }
export const TECHS: TechDef[] = [
  { id: 'rhythm', name: 'Passing Drill', emoji: '🥁', desc: 'Conveyor workers pass goods 30% faster per level.', max: 3, cost: (n) => ({ food: 40 * 2 ** n, wood: 20 * 2 ** n }) },
  { id: 'frames', name: 'Carrying Frames', emoji: '🎒', desc: 'You and porters carry +2 boxes per level.', max: 3, cost: (n) => ({ wood: 30 * 2 ** n, food: 20 * 2 ** n }) },
  { id: 'harness', name: 'Better Harness', emoji: '🐴', desc: 'Animals and wagons move 25% faster per level.', max: 3, cost: (n) => ({ wood: 60 * 2 ** n, iron: 15 * 2 ** n }) },
];

// ---------- Campaign ----------
export interface StageDef { name: string; str: number; loot: Stock; emoji: string }
export const STAGES: StageDef[] = [
  { name: 'Bandit Camp', str: 6, loot: { wood: 50, food: 30, gold: 20 }, emoji: '⛺' },
  { name: 'Wolf Den', str: 12, loot: { food: 80, gold: 25 }, emoji: '🐺' },
  { name: 'Rival Hamlet', str: 20, loot: { wood: 120, stone: 80, gold: 50 }, emoji: '🏘️' },
  { name: 'Hill Fort', str: 32, loot: { iron: 60, gold: 80 }, emoji: '🏰' },
  { name: 'River Crossing', str: 48, loot: { stone: 150, food: 150, gold: 100 }, emoji: '🌉' },
  { name: 'Iron Pass', str: 70, loot: { iron: 150, gold: 150 }, emoji: '⛰️' },
  { name: 'Old Kingdom', str: 100, loot: { wood: 300, stone: 300, gold: 250 }, emoji: '👑' },
  { name: 'Caravanserai', str: 140, loot: { gold: 500, food: 300 }, emoji: '🐫' },
  { name: 'Great Citadel', str: 200, loot: { iron: 400, gold: 600 }, emoji: '🏯' },
  { name: 'The Capital', str: 280, loot: { wood: 800, stone: 800, iron: 500, gold: 1200 }, emoji: '🌆' },
];
export function stageDef(i: number): StageDef {
  if (i < STAGES.length) return STAGES[i];
  const n = i - STAGES.length + 1;
  const m = 1.35 ** n;
  return { name: `Warlord Raid ${n}`, str: Math.round(280 * m), loot: { gold: Math.round(600 * m), iron: Math.round(200 * m), food: Math.round(300 * m) }, emoji: '🔥' };
}

// ---------- Goals / progression ----------
export interface GoalDef { text: string; hint: string; target: number; progress: (s: GameState) => number; unlock: string[]; reward?: Stock }
const count = (s: GameState, k: BuildingKind) => s.buildings.filter((b) => b.kind === k).length;
export const GOALS: GoalDef[] = [
  { text: 'Build a Woodcutter by the trees', hint: 'Build → 🪓 Woodcutter. Put it beside trees (green = OK).', target: 1, progress: (s) => count(s, 'woodcutter'), unlock: ['quarry'], reward: { food: 10 } },
  { text: 'Carry 12 boxes home yourself', hint: 'Tap a pile of goods in a yard — you walk over and carry it to the Storehouse.', target: 12, progress: (s) => s.stats.hand, unlock: ['porter'] },
  { text: 'Grow to 8 people', hint: 'Build Houses, keep food stocked. Tap the Storehouse to hire porters who haul for you.', target: 8, progress: (s) => s.population, unlock: ['conveyor', 'warehouse'] },
  { text: 'Pass 60 goods along human conveyors', hint: '🧍 Conveyor: drag from a yard to the Storehouse. Each post needs one free worker.', target: 60, progress: (s) => s.stats.conveyed, unlock: ['donkeypen', 'mine'] },
  { text: 'Stockpile 60 stone and 20 iron', hint: 'Tap dark land to expand toward orange ore rocks. Donkeys haul 10 boxes from far piles.', target: 80, progress: (s) => Math.min(60, storeOf(s, 'stone')) + Math.min(20, storeOf(s, 'iron')), unlock: ['smithy', 'barracks'] },
  { text: 'Win your first campaign', hint: 'Forge weapons, train soldiers at the Barracks, then dispatch them from ⚔️ Front.', target: 1, progress: (s) => s.frontline.wins, unlock: ['stable'] },
  { text: 'Win 4 campaigns', hint: 'Horse wagons move 100 boxes. Loot caravans roll back to your Storehouse.', target: 4, progress: (s) => s.frontline.wins, unlock: ['elephantstable'] },
  { text: 'Move 5,000 goods through your network', hint: 'Elephants carry 1000 boxes. Sit back and watch your world work.', target: 5000, progress: (s) => s.stats.delivered, unlock: [] },
  { text: 'Conquer The Capital', hint: 'The world is yours. Keep growing.', target: 10, progress: (s) => s.frontline.wins, unlock: [] },
];

export function storeOf(s: GameState, r: ResId): number {
  let t = 0;
  for (const b of s.buildings) if (b.store[r]) t += b.store[r]!;
  return t;
}

export const TILE = 48;
export const CONV_COST = 2; // wood per post
export const ROAD_COST = 1; // stone per tile
export const PORTER_COST: Stock = { food: 10 };
export const SOLDIER_COST: Stock = { weapons: 1, food: 5 };
