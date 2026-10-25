// ---------- procedural world generation ----------
import { mulberry32, dist, uid } from "./util";
import { WORLD, PLOTS } from "./data";
import type { NodeEnt, Decor, NodeType, GameState } from "./state";

export const NODE_DEF: Record<NodeType, { amount: number; regrow: number }> = {
  tree: { amount: 25, regrow: 40 },
  rock: { amount: 22, regrow: 55 },
  iron: { amount: 15, regrow: 70 },
  crystal: { amount: 8, regrow: 0 },
  ruin: { amount: 12, regrow: 0 },
};

export const nodeRes = (t: NodeType) =>
  t === "tree" ? "wood" : t === "rock" ? "stone" : t === "iron" ? "iron" : "crystal";

export const nodeChunk = (t: NodeType) =>
  t === "tree" ? 5 : t === "rock" ? 4 : t === "iron" ? 3 : 6;

function blocked(x: number, y: number): boolean {
  if (dist(x, y, WORLD.stockX, WORLD.stockY) < 115) return true;
  for (const key of Object.keys(PLOTS) as (keyof typeof PLOTS)[]) {
    for (const p of PLOTS[key]) if (dist(x, y, p.x, p.y) < 92) return true;
  }
  // the road
  if (x > 370 && x < 1240 && Math.abs(y - WORLD.stockY) < 36) return true;
  if (y < 150 || y > WORLD.h - 130) return true;
  return false;
}

export function genNodes(seed: number): NodeEnt[] {
  const rng = mulberry32(seed);
  const nodes: NodeEnt[] = [];
  const place = (type: NodeType, x0: number, x1: number, tries = 90) => {
    for (let i = 0; i < tries; i++) {
      const x = x0 + rng() * (x1 - x0);
      const y = 170 + rng() * (WORLD.h - 320);
      if (blocked(x, y)) continue;
      let ok = true;
      for (const n of nodes) if (dist(x, y, n.x, n.y) < 74) { ok = false; break; }
      if (!ok) continue;
      const def = NODE_DEF[type];
      nodes.push({ id: uid(), type, x, y, amount: def.amount, max: def.amount, regrow: 0, seed: rng() * 1000 });
      return true;
    }
    return false;
  };

  // starter cluster
  for (let i = 0; i < 6; i++) place("tree", 380, 780);
  for (let i = 0; i < 5; i++) place("rock", 360, 760);
  for (let i = 0; i < 3; i++) place("iron", 640, 980);
  // midlands
  for (let i = 0; i < 15; i++) place("tree", 800, 1650);
  for (let i = 0; i < 12; i++) place("rock", 820, 1650);
  for (let i = 0; i < 8; i++) place("iron", 900, 1750);
  // the ashen frontier (sparse, dangerous)
  for (let i = 0; i < 6; i++) place("tree", 1700, 2450);
  for (let i = 0; i < 6; i++) place("rock", 1700, 2450);
  for (let i = 0; i < 4; i++) place("iron", 1750, 2450);
  return nodes;
}

export function genDecor(seed: number): Decor {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const grass: Decor["grass"] = [];
  const flowers: Decor["flowers"] = [];
  const pebbles: Decor["pebbles"] = [];
  const ash: Decor["ash"] = [];
  const clouds: Decor["clouds"] = [];
  const flowerCols = ["#e8c15a", "#d97f8f", "#a3c4e8", "#e6e0cf", "#c89ae0"];
  for (let i = 0; i < 340; i++) {
    const x = rng() * WORLD.w;
    const y = 130 + rng() * (WORLD.h - 220);
    grass.push({ x, y, s: 0.6 + rng() * 0.9, ph: rng() * 6.28 });
  }
  for (let i = 0; i < 70; i++) {
    const x = rng() * 1450;
    const y = 150 + rng() * (WORLD.h - 280);
    flowers.push({ x, y, c: flowerCols[(rng() * flowerCols.length) | 0], s: 0.7 + rng() * 0.7 });
  }
  for (let i = 0; i < 90; i++) {
    pebbles.push({ x: rng() * WORLD.w, y: 140 + rng() * (WORLD.h - 240), s: 1 + rng() * 2.6, a: rng() * 3.14 });
  }
  for (let i = 0; i < 240; i++) {
    ash.push({ x: 1350 + rng() * (WORLD.w - 1350), y: 140 + rng() * (WORLD.h - 240), s: 1 + rng() * 2.4 });
  }
  for (let i = 0; i < 6; i++) {
    clouds.push({ x: rng() * WORLD.w, y: 120 + rng() * 420, s: 60 + rng() * 110, v: 6 + rng() * 9 });
  }
  return { grass, flowers, pebbles, ash, clouds, birds: [] };
}

// node spawned on freshly conquered land
export function spawnBonusNode(s: GameState) {
  const rng = Math.random;
  const type: NodeType =
    s.conquest >= 4 && rng() < 0.5 ? "crystal" : s.conquest >= 2 && rng() < 0.3 ? "ruin" : rng() < 0.5 ? "iron" : "rock";
  for (let i = 0; i < 40; i++) {
    const x = s.frontX - 40 - rng() * 160;
    const y = 220 + rng() * (WORLD.h - 420);
    let ok = true;
    for (const n of s.nodes) if (dist(x, y, n.x, n.y) < 78) { ok = false; break; }
    if (!ok) continue;
    const def = NODE_DEF[type];
    s.nodes.push({ id: uid(), type, x, y, amount: def.amount, max: def.amount, regrow: 0, seed: rng() * 1000 });
    return;
  }
}
