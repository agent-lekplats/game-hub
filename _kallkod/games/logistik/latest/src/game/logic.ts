// ---------- the simulation: economy, workers, war, waves, quests (hyper-juicy edition) ----------
import {
  WORLD, WORKER, BUILDINGS, PLOTS, UPGRADES, TECHS, STRIKE_DMG,
  UNITS, UNIT_ORDER, ENEMIES, QUESTS, WAVE_INTERVAL,
  waveComp, waveHpMult, waveDmgMult, spoils, armyCap, workerCost, stockpileCap, stockpileCost, STOCKPILE_MAX, RES_META,
} from "./data";
import {
  G, GameState, NodeEnt, WorkerEnt, UnitEnt, EnemyEnt, UnitKind, ResKey, Cost,
  canAfford, pay, gain, toast, float, addParticle, addRing, addSlash, addBolt, camPunch, capOf, writeSave,
} from "./state";
import { genNodes, genDecor, nodeRes, spawnBonusNode, NODE_DEF } from "./world";
import { clamp, lerp, dist, uid, mulberry32 } from "./util";
import { S } from "./audio";

export const FLAGS = { muted: false };

export const stockpileCapOf = (s: GameState) => stockpileCap(s.stockLvl);

// ---- derived stats ----
export const clickPower = (s: GameState) => 2 + (s.upg.axes ?? 0);
export const carryCap = (s: GameState) => WORKER.carry + 4 * (s.upg.packs ?? 0);
export const workerSpeed = (s: GameState) => WORKER.speed * (1 + 0.15 * (s.upg.boots ?? 0));
export const harvestTime = (s: GameState) => WORKER.harvestTime / (1 + 0.2 * (s.upg.axes ?? 0));
export const dmgMult = (s: GameState) => 1 + 0.18 * (s.upg.blades ?? 0);
export const hpMult = (s: GameState) => 1 + 0.22 * (s.upg.plate ?? 0);
export const marchMult = (s: GameState) => 1 + 0.12 * (s.upg.drums ?? 0);
export const currentArmyCap = (s: GameState) => armyCap(s.buildings.barracks ?? 0, s.tech.tactics ?? 0);
export const totalQueued = (s: GameState) => s.barracksEnts.reduce((a, b) => a + b.queue.length, 0);

const sfxGate = { chop: 0, rock: 0, hit: 0, arrow: 0, death: 0, deposit: 0 };

// ================= new game / resume =================
export function newGame(seed: number): GameState {
  const s: GameState = {
    seed,
    time: 0,
    paused: false,
    started: false,
    res: { wood: 12, stone: 6, iron: 0, crystal: 0, valor: 0 },
    resFlash: { wood: 0, stone: 0, iron: 0, crystal: 0, valor: 0 },
    stockLvl: 1,
    stockPulse: 0,
    rallyPulse: 0,
    hitstop: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    hoverWorld: { x: 0, y: 0, nodeId: null, enemyId: null },
    buildings: { bunkhouse: 0, workshop: 0, barracks: 0, forge: 0 },
    buildingEnts: [],
    barracksEnts: [],
    upg: {},
    tech: {},
    focus: "auto",
    nodes: genNodes(seed),
    workers: [],
    units: [],
    enemies: [],
    projs: [],
    particles: [],
    rings: [],
    slashes: [],
    bolts: [],
    floats: [],
    orbs: [],
    decor: genDecor(seed),
    rally: { x: WORLD.rallyX, y: WORLD.rallyY },
    conquest: 0,
    frontX: WORLD.frontStart,
    frontAnim: 0,
    waveTimer: 40,
    waveActive: false,
    pendingSpawns: [],
    strikeCd: 0,
    stats: { gatheredWood: 0, kills: 0, wavesWon: 0, totalEarned: 0, earnedRun: 0 },
    questsDone: [],
    questFlash: null,
    depositLog: [],
    rates: { wood: 0, stone: 0, iron: 0, crystal: 0, valor: 0 },
    auto: { militia: false, archer: false, guardian: false, golem: false },
    cam: { x: 640, y: 640, z: 1, tx: 640, ty: 640, tz: 1, shake: 0, kickX: 0, kickY: 0, zoomPunch: 0, flash: 0, flashColor: "#ffd89a" },
    toasts: [],
    lastSave: 0,
    savedRates: { wood: 0, stone: 0, iron: 0, crystal: 0, valor: 0 },
    dayT: 0.3,
    offline: null,
  };
  return s;
}

export function resumeGame(save: any): GameState {
  const s = newGame(save.seed ?? 1337);
  s.res = { ...s.res, ...save.res };
  s.stockLvl = save.stockLvl ?? 1;
  s.upg = save.upg ?? {};
  s.tech = save.tech ?? {};
  s.focus = save.focus ?? "auto";
  s.rally = save.rally ?? s.rally;
  s.conquest = save.conquest ?? 0;
  s.frontX = clamp(save.frontX ?? WORLD.frontStart, WORLD.frontMin, WORLD.frontMax);
  s.stats = { ...s.stats, ...save.stats };
  s.questsDone = save.questsDone ?? [];
  s.auto = { ...s.auto, ...save.auto };
  if (save.cam) {
    s.cam.x = s.cam.tx = save.cam.x;
    s.cam.y = s.cam.ty = save.cam.y;
    s.cam.z = s.cam.tz = save.cam.z;
  }
  s.started = true;
  const b = save.buildings ?? {};
  (Object.keys(b) as (keyof typeof BUILDINGS)[]).forEach((key) => {
    const n = b[key] ?? 0;
    for (let i = 0; i < n; i++) addBuildingEnt(s, key as string, false);
  });
  const rng = mulberry32(save.seed ?? 1);
  const tunics = ["#c96f4a", "#5e8c61", "#7a6a9e", "#b3913f", "#4f7d8c"];
  const wc = Math.min(save.workerCount ?? 0, WORKER.maxWorkers);
  for (let i = 0; i < wc; i++) {
    s.workers.push(makeWorker(WORLD.stockX + rng() * 60 - 30, WORLD.stockY + rng() * 60 - 30, tunics[i % tunics.length], false));
  }
  const uc: Record<string, number> = save.unitCounts ?? {};
  (Object.keys(uc) as UnitKind[]).forEach((k) => {
    for (let i = 0; i < uc[k]; i++) {
      const def = UNITS[k];
      const hp = Math.round(def.hp * hpMult(s));
      s.units.push({
        id: uid(), type: k, x: WORLD.rallyX - 40 - rng() * 80, y: WORLD.rallyY - 60 + rng() * 120,
        hp, maxhp: hp, cd: 0, lunge: 0, face: 1, bob: rng() * 6, formI: s.units.length,
        jumpZ: 0, vz: 0, squash: 0, flash: 0, kbX: 0, kbY: 0, stepT: rng(),
      });
    }
  });
  s.waveTimer = 20;

  // offline progress: workers keep ~35% effectiveness while away
  const elapsed = clamp((Date.now() - (save.savedAt ?? Date.now())) / 1000, 0, 7200);
  if (elapsed > 90 && save.savedRates) {
    const gains: Cost = {};
    (Object.keys(save.savedRates) as ResKey[]).forEach((r) => {
      if (r === "valor") return;
      const amt = (save.savedRates[r] ?? 0) * elapsed * 0.35;
      if (amt >= 1) {
        const before = s.res[r];
        gain(s, r, amt);
        const got = s.res[r] - before;
        if (got >= 1) gains[r] = got;
      }
    });
    if (Object.keys(gains).length > 0) s.offline = { dur: elapsed, gains };
  }
  return s;
}

function makeWorker(x: number, y: number, tunic: string, jumpOnSpawn = true): WorkerEnt {
  return {
    id: uid(), x, y, state: "idle", targetId: -1, carryRes: null, carryN: 0, prog: 0,
    tunic, phase: Math.random() * 10, tx: x, ty: y,
    jumpZ: jumpOnSpawn ? 2 : 0, vz: jumpOnSpawn ? 185 : 0, squash: jumpOnSpawn ? 0.35 : 0, stepT: Math.random(),
  };
}

function addBuildingEnt(s: GameState, key: string, animate = true) {
  const count = s.buildings[key] ?? 0;
  const plot = (PLOTS as any)[key]?.[count];
  if (!plot) return;
  s.buildings[key] = count + 1;
  s.buildingEnts.push({ key, x: plot.x, y: plot.y, dropAnim: animate ? 1 : 0, pulse: animate ? 1 : 0 });
  if (key === "barracks") s.barracksEnts.push({ id: uid(), x: plot.x, y: plot.y, queue: [], prog: 0 });
}

// ================= actions (UI / input) =================
export function updateHoverAt(s: GameState, wx: number, wy: number) {
  s.hoverWorld.x = wx;
  s.hoverWorld.y = wy;
  let bestE: EnemyEnt | null = null;
  let ed = 36;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const d = dist(wx, wy, e.x, e.y - 10);
    if (d < ed) { ed = d; bestE = e; }
  }
  s.hoverWorld.enemyId = bestE ? bestE.id : null;
  if (bestE) {
    s.hoverWorld.nodeId = null;
    return;
  }
  let bestN: NodeEnt | null = null;
  let nd = 38;
  for (const n of s.nodes) {
    if (n.amount <= 0) continue;
    const d = dist(wx, wy, n.x, n.y - 10);
    if (d < nd) { nd = d; bestN = n; }
  }
  s.hoverWorld.nodeId = bestN ? bestN.id : null;
}

function bumpCombo(s: GameState) {
  s.combo = (s.combo ?? 0) + 1;
  s.comboTimer = 2.5;
  if (s.combo > (s.maxCombo ?? 0)) s.maxCombo = s.combo;
}

export function clickNodeAt(s: GameState, wx: number, wy: number): boolean {
  let best: NodeEnt | null = null;
  let bd = 40;
  for (const n of s.nodes) {
    if (n.amount <= 0) continue;
    const d = dist(wx, wy, n.x, n.y - 10);
    if (d < bd) { bd = d; best = n; }
  }
  if (!best) return false;
  const n = best;
  bumpCombo(s);
  const critChance = Math.min(0.55, 0.16 + s.combo * 0.03);
  const isCrit = Math.random() < critChance || (s.combo > 0 && s.combo % 5 === 0);
  const rawPower = clickPower(s) * (isCrit ? 2 : 1);
  const take = Math.min(rawPower, n.amount);
  if (take <= 0) return false;
  n.amount -= take;
  n.hitAnim = 1;
  n.flash = 1;
  n.hitDir = wx <= n.x ? 1 : -1;

  const resKey = nodeRes(n.type) as ResKey;
  const resCol = RES_META[resKey].color;

  // slash + ring + camera punch
  const ang = Math.atan2(n.y - 12 - wy, n.x - wx);
  addSlash(s, n.x, n.y - 14, ang, isCrit ? 34 : 25, isCrit ? "#ffe694" : "#fff5de", 0.2, n.hitDir);
  addRing(s, n.x, n.y - 10, isCrit ? 48 : 30, isCrit ? "#ffd76b" : resCol, isCrit ? 0.38 : 0.28, isCrit ? 3.2 : 2.2);
  camPunch(
    s,
    isCrit ? 4.2 : 2.0,
    isCrit ? 0.022 : 0.01,
    Math.cos(ang) * (isCrit ? 4.5 : 2.2),
    Math.sin(ang) * (isCrit ? 4.5 : 2.2),
    isCrit ? 0.1 : 0,
    resCol
  );
  if (isCrit) s.hitstop = Math.max(s.hitstop, 0.022);

  spawnOrb(s, n.x, n.y - 20, resKey, take);
  chipBurst(s, n, isCrit ? 12 : 7);

  if (isCrit) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
      addParticle(s, {
        x: n.x, y: n.y - 16,
        vx: Math.cos(a) * (70 + Math.random() * 60),
        vy: Math.sin(a) * (70 + Math.random() * 60) - 30,
        life: 0.48, size: 4.2, color: "#ffd86b", kind: "star", grav: 80,
      });
    }
    float(s, n.x + (Math.random() * 14 - 7), n.y - 48, `CRIT! +${take}`, "#ffd86b", 16, true);
  } else {
    float(s, n.x + (Math.random() * 18 - 9), n.y - 44, `+${take}`, resCol, 13, false);
  }

  const g = n.type === "tree" ? "chop" : n.type === "rock" || n.type === "iron" ? "rock" : "crystal";
  if (g === "chop") S.chop(s.combo, isCrit);
  else if (g === "rock") S.rockHit(s.combo, isCrit);
  else S.crystalHit(s.combo, isCrit);

  // felled node celebration!
  if (n.amount <= 0) {
    if (NODE_DEF[n.type].regrow > 0) n.regrow = NODE_DEF[n.type].regrow;
    const bonus = Math.max(2, Math.ceil(clickPower(s) * 0.8));
    spawnOrb(s, n.x, n.y - 24, resKey, bonus);
    addRing(s, n.x, n.y - 8, 62, "#ffffff", 0.45, 3.5);
    chipBurst(s, n, 16);
    float(s, n.x, n.y - 62, `FELLED! +${bonus}`, "#a8ff8a", 15, true);
    s.hitstop = Math.max(s.hitstop, 0.032);
    S.nodeFell();
  }
  return true;
}

export function strikeAt(s: GameState, wx: number, wy: number): boolean {
  let best: EnemyEnt | null = null;
  let bd = 38;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const d = dist(wx, wy, e.x, e.y - 10);
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) return false;
  const lvl = s.tech.strike ?? 0;
  if (s.strikeCd > 0) {
    // still give tactile micro-spark feedback even on cooldown
    addRing(s, best.x, best.y - 12, 18, "#ffd76b", 0.18, 1.5);
    return true;
  }
  bumpCombo(s);
  s.strikeCd = lvl > 0 ? 0.85 : 0.52;
  const baseDmg = STRIKE_DMG[Math.min(STRIKE_DMG.length - 1, lvl)] * (1 + Math.min(0.5, s.combo * 0.04));
  damageEnemy(s, best, baseDmg, true, wx, wy);

  // sky lightning bolt
  addBolt(s, best.x + (Math.random() * 60 - 30), best.y - 320, best.x, best.y - 10, lvl > 0 ? "#ffd76b" : "#ffb25e", lvl > 0 ? 3.8 : 2.6);
  addRing(s, best.x, best.y - 6, lvl > 0 ? 78 : 42, "#ffd76b", 0.42, lvl > 0 ? 4 : 2.6);

  // chain AoE when upgraded at Forge
  if (lvl > 0) {
    const aoeR = 70 + lvl * 18;
    for (const other of s.enemies) {
      if (other.id === best.id || other.hp <= 0) continue;
      if (dist(other.x, other.y, best.x, best.y) <= aoeR) {
        damageEnemy(s, other, Math.round(baseDmg * 0.65), true, best.x, best.y);
        addBolt(s, best.x, best.y - 14, other.x, other.y - 12, "#ffe694", 2.2);
      }
    }
  }

  S.strike();
  s.hitstop = Math.max(s.hitstop, lvl > 0 ? 0.038 : 0.022);
  camPunch(s, lvl > 0 ? 7.5 : 4.0, lvl > 0 ? 0.035 : 0.018, 0, 4, lvl > 0 ? 0.22 : 0.1, "#ffd87a");

  for (let i = 0; i < (lvl > 0 ? 18 : 10); i++) {
    const a = Math.random() * 6.28;
    const spd = 80 + Math.random() * 140;
    addParticle(s, {
      x: best.x, y: best.y - 12,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 45,
      life: 0.42, size: 3.2, color: i % 2 === 0 ? "#ffd76b" : "#ff8a3d", kind: i % 3 === 0 ? "star" : "zap", grav: 60,
    });
  }
  float(s, best.x, best.y - 38, `${lvl > 0 ? "SMITE!" : "BOLT!"} -${Math.round(baseDmg)}`, "#ffd76b", lvl > 0 ? 17 : 14, true);
  return true;
}

export function tapGroundAt(s: GameState, wx: number, wy: number) {
  addRing(s, wx, wy, 24, "rgba(255,225,175,0.75)", 0.28, 2);
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * 6.28;
    addParticle(s, {
      x: wx, y: wy,
      vx: Math.cos(a) * (22 + Math.random() * 35),
      vy: -28 - Math.random() * 35,
      life: 0.35, size: 2.2, color: "#c8b98a", kind: "chip", grav: 220,
    });
  }
  S.groundTap();
}

export function hireWorker(s: GameState) {
  const slots = (s.buildings.bunkhouse ?? 0) * WORKER.slotsPerBunk;
  if (s.workers.length >= Math.min(slots, WORKER.maxWorkers)) { S.error(); return; }
  const cost = workerCost(s.workers.length);
  if (!pay(s, cost)) { S.error(); return; }
  const tunics = ["#c96f4a", "#5e8c61", "#7a6a9e", "#b3913f", "#4f7d8c"];
  const wx = WORLD.stockX + (Math.random() * 56 - 28);
  const wy = WORLD.stockY - 12 + (Math.random() * 36 - 18);
  s.workers.push(makeWorker(wx, wy, tunics[s.workers.length % tunics.length], true));
  s.stockPulse = 1.2;
  S.hire();
  addRing(s, wx, wy, 42, "#ffe0a3", 0.38, 3);
  burst(s, wx, wy - 16, "#ffe0a3", 14, "poof");
  camPunch(s, 2.2, 0.015, 0, -2);
  float(s, wx, wy - 44, "Reporting!", "#ffe6a8", 13, true);
  if (s.workers.length === 1) toast(s, "good", "Your first worker!", "They harvest and haul on their own now");
  checkQuests(s);
}

export function build(s: GameState, key: string) {
  const def = (BUILDINGS as any)[key];
  if (!def) return;
  const owned = s.buildings[key] ?? 0;
  if (owned >= def.max) { S.error(); return; }
  const cost = def.cost(owned);
  if (!pay(s, cost)) { S.error(); return; }
  addBuildingEnt(s, key, true);
  S.build();
  const ent = s.buildingEnts[s.buildingEnts.length - 1];
  s.hitstop = Math.max(s.hitstop, 0.035);
  camPunch(s, 6.5, 0.032, 0, 5, 0.16, "#ffcf8a");
  addRing(s, ent.x, ent.y + 6, 85, "#ffcf8a", 0.5, 4);
  addRing(s, ent.x, ent.y + 6, 52, "#ffffff", 0.34, 2.5);
  burst(s, ent.x, ent.y, "#d8c9a3", 28, "dust");
  burst(s, ent.x, ent.y - 18, "#ffb25e", 14, "spark");
  float(s, ent.x, ent.y - 54, `${def.name.toUpperCase()}!`, "#ffd86b", 16, true);
  toast(s, "good", `${def.name} built`, def.desc);
  if (key === "barracks" && owned === 0) {
    s.waveTimer = Math.min(s.waveTimer + 10, 44);
    toast(s, "war", "The Horde stirs...", "A war banner will draw raiders. Train soldiers!");
    S.horn();
  }
  checkQuests(s);
}

export function upgradeStockpile(s: GameState) {
  if (s.stockLvl >= STOCKPILE_MAX) { S.error(); return; }
  if (!pay(s, stockpileCost(s.stockLvl))) { S.error(); return; }
  s.stockLvl++;
  s.stockPulse = 1.5;
  S.build();
  camPunch(s, 5.5, 0.028, 0, 4, 0.14, "#ffd86b");
  addRing(s, WORLD.stockX, WORLD.stockY, 80, "#ffd86b", 0.48, 3.8);
  burst(s, WORLD.stockX, WORLD.stockY - 30, "#c8b98a", 24, "dust");
  burst(s, WORLD.stockX, WORLD.stockY - 36, "#ffd86b", 14, "spark");
  float(s, WORLD.stockX, WORLD.stockY - 64, `STOCKPILE LVL ${s.stockLvl}!`, "#ffd86b", 15, true);
  toast(s, "good", `Stockpile level ${s.stockLvl}`, `Capacity increased to ${stockpileCap(s.stockLvl)}`);
}

export function buyUpgrade(s: GameState, id: string) {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return;
  const lvl = s.upg[id] ?? 0;
  if (lvl >= def.max) { S.error(); return; }
  if (!pay(s, def.cost(lvl + 1))) { S.error(); return; }
  s.upg[id] = lvl + 1;
  S.coin();
  camPunch(s, 3.2, 0.02, 0, -2, 0.1, "#ffd86b");
  // make workers or soldiers jump in celebration!
  if (def.scope === "econ") {
    for (const w of s.workers) { w.vz = 140 + Math.random() * 40; w.jumpZ = 1; }
    const ws = s.buildingEnts.find((b) => b.key === "workshop");
    if (ws) { ws.pulse = 1; addRing(s, ws.x, ws.y, 64, "#ffd86b", 0.42, 3); }
  } else {
    for (const u of s.units) { u.vz = 135 + Math.random() * 40; u.jumpZ = 1; }
    const fg = s.buildingEnts.find((b) => b.key === "forge");
    if (fg) { fg.pulse = 1; addRing(s, fg.x, fg.y, 64, "#ff8a4a", 0.42, 3); }
  }
  toast(s, "info", `${def.name} ${lvl + 1}`, def.desc);
}

export function buyTech(s: GameState, id: string) {
  const def = TECHS.find((t) => t.id === id);
  if (!def) return;
  const lvl = s.tech[id] ?? 0;
  if (lvl >= def.max) { S.error(); return; }
  if (!pay(s, def.cost(lvl + 1))) { S.error(); return; }
  s.tech[id] = lvl + 1;
  S.quest();
  camPunch(s, 4.5, 0.026, 0, -3, 0.16, "#f2c14d");
  const fg = s.buildingEnts.find((b) => b.key === "forge");
  if (fg) {
    fg.pulse = 1.2;
    addBolt(s, fg.x, fg.y - 260, fg.x, fg.y - 20, "#f2c14d", 3.5);
    addRing(s, fg.x, fg.y, 78, "#f2c14d", 0.5, 3.5);
  }
  toast(s, "quest", `${def.name}`, def.desc(lvl));
  if (id === "archery") toast(s, "good", "Archers unlocked", "Train them at the Barracks");
  if (id === "heavy") toast(s, "good", "Guardians unlocked", "Train them at the Barracks");
  if (id === "golem") toast(s, "good", "War Golems unlocked", "Crystal-fed titans join the line");
}

export function train(s: GameState, key: UnitKind, mult = 1) {
  if (s.barracksEnts.length === 0) { S.error(); return; }
  let done = 0;
  let lastBar = s.barracksEnts[0];
  for (let i = 0; i < mult; i++) {
    if (s.units.length + totalQueued(s) >= currentArmyCap(s)) break;
    const def = UNITS[key];
    if (!canAfford(s, def.cost)) break;
    let target = s.barracksEnts[0];
    for (const b of s.barracksEnts) if (b.queue.length < target.queue.length) target = b;
    if (target.queue.length >= 6) continue;
    pay(s, def.cost);
    target.queue.push(key);
    lastBar = target;
    done++;
  }
  if (done > 0) {
    S.click();
    const be = s.buildingEnts.find((b) => b.x === lastBar.x && b.y === lastBar.y);
    if (be) be.pulse = 0.8;
    addRing(s, lastBar.x, lastBar.y, 44, "#7ec3ff", 0.3, 2.2);
    camPunch(s, 1.4, 0.008);
  } else {
    S.error();
  }
}

export function cancelTrain(s: GameState, bIdx: number, qIdx: number) {
  const b = s.barracksEnts[bIdx];
  if (!b || !b.queue[qIdx]) return;
  const key = b.queue.splice(qIdx, 1)[0];
  const cost = UNITS[key].cost;
  for (const r in cost) gain(s, r as ResKey, cost[r as ResKey] ?? 0);
  S.ui();
}

export function toggleAuto(s: GameState, key: UnitKind) {
  s.auto[key] = !s.auto[key];
  S.ui();
}

export function setFocus(s: GameState, f: GameState["focus"]) {
  s.focus = f;
  S.ui();
  for (const w of s.workers) {
    w.vz = 110;
    w.jumpZ = 1;
  }
}

export function moveRally(s: GameState, wx: number, wy: number) {
  s.rally.x = clamp(wx, 560, Math.max(600, s.frontX - 90));
  s.rally.y = clamp(wy, 200, WORLD.h - 180);
  s.rallyPulse = 1;
  addBolt(s, s.rally.x, s.rally.y - 240, s.rally.x, s.rally.y, "#7ec3ff", 2.8);
  addRing(s, s.rally.x, s.rally.y, 56, "#7ec3ff", 0.42, 3.2);
  addRing(s, s.rally.x, s.rally.y, 32, "#ffd76b", 0.28, 2);
  burst(s, s.rally.x, s.rally.y, "#7ec3ff", 12, "spark");
  camPunch(s, 2.8, 0.014, 0, 2);
  // soldiers do a crisp ready-hop when given new orders!
  for (const u of s.units) {
    if ((u.jumpZ ?? 0) <= 0) {
      u.vz = 115 + Math.random() * 35;
      u.jumpZ = 1;
    }
  }
  float(s, s.rally.x, s.rally.y - 46, "RALLY HERE!", "#7ec3ff", 14, true);
  S.rallyPlant();
}

// ================= helpers =================
function spawnOrb(s: GameState, x: number, y: number, res: ResKey, amt: number) {
  s.orbs.push({
    id: uid(),
    x, y,
    sx: x + (Math.random() * 14 - 7),
    sy: y + (Math.random() * 10 - 5),
    tx: WORLD.stockX,
    ty: WORLD.stockY - 40,
    t: 0,
    dur: 0.58 + Math.random() * 0.18,
    res,
    amt,
  });
}

export function burst(s: GameState, x: number, y: number, color: string, n: number, kind: "poof" | "dust" | "spark" | "chip") {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28;
    const v = 30 + Math.random() * 95;
    addParticle(s, {
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 35,
      life: 0.5 + Math.random() * 0.5, size: 2.5 + Math.random() * 3.5,
      color, kind, grav: kind === "dust" || kind === "poof" ? -20 : 160,
    });
  }
}

function chipBurst(s: GameState, n: NodeEnt, count = 6) {
  const col = n.type === "tree" ? "#8a6b3c" : n.type === "rock" ? "#9aa3ad" : n.type === "iron" ? "#e08a4c" : "#8fdcff";
  const kind = n.type === "crystal" ? "spark" : "chip";
  for (let i = 0; i < count; i++) {
    const a = Math.random() * 6.28;
    addParticle(s, {
      x: n.x + Math.cos(a) * 8, y: n.y - 14, vx: Math.cos(a) * (45 + Math.random() * 75), vy: -50 - Math.random() * 75,
      life: 0.6, size: 2.2 + Math.random() * 2.8, color: col, kind, grav: 260,
    });
  }
  if (n.type === "tree") {
    for (let i = 0; i < 4; i++) {
      addParticle(s, {
        x: n.x + (Math.random() * 24 - 12), y: n.y - 28,
        vx: (Math.random() - 0.5) * 55, vy: -20 - Math.random() * 30,
        life: 0.9, size: 3.2, color: "#7ca24e", kind: "leaf", grav: 40,
      });
    }
  }
}

function damageEnemy(s: GameState, e: EnemyEnt, dmg: number, isStrike = false, fromX?: number, fromY?: number) {
  e.hp -= dmg;
  e.flash = 1;
  e.squash = 0.38;
  const fx = fromX ?? e.x - 20;
  const fy = fromY ?? e.y;
  const d = Math.max(1, dist(fx, fy, e.x, e.y));
  const kb = isStrike ? 14 : 6;
  e.kbX = ((e.x - fx) / d) * kb;
  e.kbY = ((e.y - fy) / d) * kb * 0.45;
  if (!isStrike) {
    const isBig = dmg >= 20;
    float(s, e.x + (Math.random() * 16 - 8), e.y - 30, `${Math.round(dmg)}`, isBig ? "#ffd86b" : "#ffe9c4", isBig ? 13 : 11, isBig);
  }
  if (e.hp <= 0 && !e.raid) {
    e.hp = 0;
  }
}

function damageUnit(s: GameState, u: UnitEnt, dmg: number, fromX?: number, fromY?: number) {
  u.hp -= dmg;
  u.flash = 1;
  u.squash = 0.32;
  const fx = fromX ?? u.x + 20;
  const fy = fromY ?? u.y;
  const d = Math.max(1, dist(fx, fy, u.x, u.y));
  u.kbX = ((u.x - fx) / d) * 5;
  u.kbY = ((u.y - fy) / d) * 2.5;
  float(s, u.x + (Math.random() * 14 - 7), u.y - 32, `${Math.round(dmg)}`, "#ff9d8a", 10);
  if (u.hp < 0) u.hp = 0;
}

// ================= main update =================
export function update(s: GameState, dt: number) {
  if (s.paused || !s.started) return;

  // hitstop micro-freeze for crunchiness (still decay camera & fx légèrement)
  if (s.hitstop > 0) {
    s.hitstop = Math.max(0, s.hitstop - dt);
    updateFx(s, dt * 0.35);
    updateCamera(s, dt);
    return;
  }

  s.time += dt;
  s.dayT = (s.time % 200) / 200;
  s.strikeCd = Math.max(0, s.strikeCd - dt);
  s.frontAnim = Math.max(0, s.frontAnim - dt);
  s.stockPulse = Math.max(0, (s.stockPulse ?? 0) - dt * 3.8);
  s.rallyPulse = Math.max(0, (s.rallyPulse ?? 0) - dt * 3.2);

  if (s.comboTimer > 0) {
    s.comboTimer = Math.max(0, s.comboTimer - dt);
    if (s.comboTimer <= 0) s.combo = 0;
  }
  for (const r of Object.keys(s.resFlash) as ResKey[]) {
    s.resFlash[r] = Math.max(0, (s.resFlash[r] ?? 0) - dt * 3.2);
  }
  for (const k of Object.keys(sfxGate) as (keyof typeof sfxGate)[]) sfxGate[k] = Math.max(0, sfxGate[k] - dt);

  updateNodes(s, dt);
  updateBuildings(s, dt);
  updateWorkers(s, dt);
  updateTraining(s, dt);
  updateWave(s, dt);
  updateUnits(s, dt);
  updateEnemies(s, dt);
  updateProjs(s, dt);
  updateOrbs(s, dt);
  updateAmbience(s, dt);
  updateFx(s, dt);
  updateRates(s, dt);
  checkQuests(s);

  // the line breaks — rally, commander
  if (prevUnits > 0 && s.units.length === 0 && s.enemies.length > 0 && s.waveActive) {
    toast(s, "war", "Your line has broken!", "Train reinforcements before the ground is lost");
    S.defeat();
  }
  prevUnits = s.units.length;

  updateCamera(s, dt);

  // toasts aging
  for (const t of s.toasts) t.t -= dt;
  s.toasts = s.toasts.filter((t) => t.t > 0);

  // autosave
  if (s.time - s.lastSave > 6) {
    s.savedRates = { ...s.rates };
    writeSave(s, FLAGS.muted);
  }
}

function updateCamera(s: GameState, dt: number) {
  const k = 1 - Math.exp(-7.5 * dt);
  s.cam.x = lerp(s.cam.x, s.cam.tx, k);
  s.cam.y = lerp(s.cam.y, s.cam.ty, k);
  s.cam.z = lerp(s.cam.z, s.cam.tz, k);
  s.cam.shake = Math.max(0, s.cam.shake - dt * 16);
  s.cam.zoomPunch = Math.max(0, (s.cam.zoomPunch ?? 0) - dt * 0.14);
  s.cam.kickX = lerp(s.cam.kickX ?? 0, 0, 1 - Math.exp(-14 * dt));
  s.cam.kickY = lerp(s.cam.kickY ?? 0, 0, 1 - Math.exp(-14 * dt));
  s.cam.flash = Math.max(0, (s.cam.flash ?? 0) - dt * 1.8);
}

function updateBuildings(s: GameState, dt: number) {
  for (const b of s.buildingEnts) {
    if (b.dropAnim && b.dropAnim > 0) b.dropAnim = Math.max(0, b.dropAnim - dt * 2.8);
    if (b.pulse && b.pulse > 0) b.pulse = Math.max(0, b.pulse - dt * 3.4);
  }
}

function updateNodes(s: GameState, dt: number) {
  for (const n of s.nodes) {
    if (n.hitAnim && n.hitAnim > 0) n.hitAnim = Math.max(0, n.hitAnim - dt * 4.5);
    if (n.flash && n.flash > 0) n.flash = Math.max(0, n.flash - dt * 7);
    if (n.amount <= 0 && n.regrow > 0) {
      n.regrow -= dt;
      if (n.regrow <= 0) {
        n.amount = n.max;
        n.regrow = 0;
        n.hitAnim = 0.8;
        addRing(s, n.x, n.y - 8, 34, "#9ed07a", 0.35, 2.5);
        burst(s, n.x, n.y - 20, "#9ed07a", 10, "poof");
      }
    }
  }
  // rolling cap on spawned bonus nodes
  if (s.nodes.length > 120) {
    const idx = s.nodes.findIndex((n) => n.amount <= 0 && n.regrow <= 0 && (n.type === "ruin" || n.type === "crystal"));
    if (idx >= 0) s.nodes.splice(idx, 1);
  }
}

function stepJumpPhysics(ent: { x: number; y: number; jumpZ?: number; vz?: number; squash?: number }, s: GameState, dt: number) {
  if (ent.squash && ent.squash > 0) ent.squash = Math.max(0, ent.squash - dt * 4.2);
  if ((ent.jumpZ ?? 0) > 0 || (ent.vz ?? 0) !== 0) {
    ent.vz = (ent.vz ?? 0) - 560 * dt;
    ent.jumpZ = (ent.jumpZ ?? 0) + (ent.vz ?? 0) * dt;
    if ((ent.jumpZ ?? 0) <= 0) {
      ent.jumpZ = 0;
      ent.vz = 0;
      ent.squash = 0.42;
      addRing(s, ent.x, ent.y + 2, 18, "rgba(235,215,175,0.55)", 0.22, 1.8);
    }
  }
}

// ---------------- workers ----------------
function pickNode(s: GameState, w: WorkerEnt): NodeEnt | null {
  let best: NodeEnt | null = null;
  let bd = Infinity;
  const want = s.focus;
  for (const n of s.nodes) {
    if (n.amount <= 0) continue;
    const r = nodeRes(n.type);
    const d = dist(w.x, w.y, n.x, n.y);
    const match = want === "auto" || want === r;
    const score = match ? d : d * 3.2; // strongly prefer focus, still fall back
    if (score < bd) { bd = score; best = n; }
  }
  return best;
}

function updateWorkers(s: GameState, dt: number) {
  const spd = workerSpeed(s);
  const cap = carryCap(s);
  const ht = harvestTime(s);
  for (const w of s.workers) {
    w.phase += dt;
    stepJumpPhysics(w, s, dt);
    if (w.state === "idle") {
      const n = pickNode(s, w);
      if (n) {
        w.targetId = n.id;
        w.state = "toNode";
      } else {
        if (Math.random() < dt * 0.4) float(s, w.x + 8, w.y - 26, "z", "rgba(210,220,235,0.7)", 9);
        // lazy wander around the stockpile
        if (w.phase > 3) {
          w.phase = 0;
          w.tx = WORLD.stockX + (Math.random() * 90 - 45);
          w.ty = WORLD.stockY + (Math.random() * 70 - 35);
        }
        const d = dist(w.x, w.y, w.tx, w.ty);
        if (d > 6) {
          w.x += ((w.tx - w.x) / d) * spd * 0.4 * dt;
          w.y += ((w.ty - w.y) / d) * spd * 0.4 * dt;
        }
      }
      continue;
    }
    if (w.state === "toNode") {
      const n = s.nodes.find((x) => x.id === w.targetId);
      if (!n || n.amount <= 0) { w.state = "idle"; continue; }
      const d = dist(w.x, w.y, n.x, n.y);
      if (d < 20) {
        w.state = "harvest";
        w.prog = 0;
        w.phase = 0;
      } else {
        w.x += ((n.x - w.x) / d) * spd * dt;
        w.y += ((n.y - w.y) / d) * spd * dt;
        w.stepT = (w.stepT ?? 0) + dt * 4.5;
        if ((w.stepT ?? 0) >= 1) {
          w.stepT = 0;
          addParticle(s, { x: w.x, y: w.y + 2, vx: (Math.random() - 0.5) * 14, vy: -8, life: 0.28, size: 2, color: "rgba(210,195,160,0.55)", kind: "dust", grav: -5 });
        }
      }
      continue;
    }
    if (w.state === "harvest") {
      const n = s.nodes.find((x) => x.id === w.targetId);
      if (!n || n.amount <= 0) { w.state = "idle"; continue; }
      w.prog += dt / ht;
      if (w.phase > 0.42) {
        w.phase = 0;
        n.hitAnim = Math.max(n.hitAnim ?? 0, 0.75);
        n.flash = 0.65;
        n.hitDir = w.x <= n.x ? 1 : -1;
        w.squash = 0.28;
        chipBurst(s, n, 5);
        const t = n.type;
        if (t === "tree" && sfxGate.chop <= 0) { S.chop(0, false); sfxGate.chop = 0.14; }
        else if ((t === "rock" || t === "iron") && sfxGate.rock <= 0) { S.rockHit(0, false); sfxGate.rock = 0.14; }
      }
      if (w.prog >= 1) {
        const chunk = Math.min(cap, n.amount);
        n.amount -= chunk;
        if (n.amount <= 0 && NODE_DEF[n.type].regrow > 0) n.regrow = NODE_DEF[n.type].regrow;
        w.carryRes = nodeRes(n.type) as ResKey;
        w.carryN = chunk;
        w.vz = 115;
        w.jumpZ = 1;
        w.state = "toHome";
      }
      continue;
    }
    if (w.state === "toHome") {
      const d = dist(w.x, w.y, WORLD.stockX, WORLD.stockY - 10);
      if (d < 30) {
        if (w.carryRes && w.carryN > 0) {
          if (s.res[w.carryRes] >= capOf(s)) {
            if (Math.random() < dt * 0.8) float(s, w.x, w.y - 34, "Full", "#e8b06a", 11);
          } else {
            gain(s, w.carryRes, w.carryN);
            s.depositLog.push({ t: s.time, res: w.carryRes, amt: w.carryN });
            w.vz = 105;
            w.jumpZ = 1;
            addRing(s, WORLD.stockX, WORLD.stockY - 8, 36, RES_META[w.carryRes].color, 0.28, 2.2);
            float(s, WORLD.stockX + (Math.random() * 30 - 15), WORLD.stockY - 54, `+${w.carryN} ${RES_META[w.carryRes].label}`, RES_META[w.carryRes].color, 12);
            if (sfxGate.deposit <= 0) { S.deposit(); sfxGate.deposit = 0.08; }
            w.carryRes = null;
            w.carryN = 0;
            w.state = "idle";
          }
        } else {
          w.state = "idle";
        }
      } else {
        w.x += ((WORLD.stockX - w.x) / d) * spd * dt;
        w.y += ((WORLD.stockY - 10 - w.y) / d) * spd * dt;
        w.stepT = (w.stepT ?? 0) + dt * 4.5;
        if ((w.stepT ?? 0) >= 1) {
          w.stepT = 0;
          addParticle(s, { x: w.x, y: w.y + 2, vx: (Math.random() - 0.5) * 14, vy: -8, life: 0.28, size: 2, color: "rgba(210,195,160,0.55)", kind: "dust", grav: -5 });
        }
      }
    }
  }
}

// ---------------- training ----------------
function updateTraining(s: GameState, dt: number) {
  const mult = 1 + 0.12 * (s.upg.drums ?? 0);
  for (const b of s.barracksEnts) {
    // auto-enqueue
    if (b.queue.length < 4 && s.units.length + totalQueued(s) < currentArmyCap(s)) {
      for (const key of UNIT_ORDER) {
        if (s.auto[key] && canAfford(s, UNITS[key].cost)) {
          pay(s, UNITS[key].cost);
          b.queue.push(key);
          break;
        }
      }
    }
    if (b.queue.length === 0) { b.prog = 0; continue; }
    const key = b.queue[0];
    const def = UNITS[key];
    b.prog += dt * mult;
    if (b.prog >= def.train) {
      b.prog = 0;
      b.queue.shift();
      const hp = Math.round(def.hp * hpMult(s));
      const sx = b.x + 26;
      const sy = b.y + 30;
      s.units.push({
        id: uid(), type: key, x: sx, y: sy, hp, maxhp: hp,
        cd: 0, lunge: 0, face: 1, bob: Math.random() * 6, formI: s.units.length,
        jumpZ: 2, vz: 205, squash: 0.4, flash: 0.6, kbX: 0, kbY: 0, stepT: 0,
      });
      const be = s.buildingEnts.find((bb) => bb.x === b.x && bb.y === b.y);
      if (be) be.pulse = 1;
      S.train();
      addRing(s, sx, sy, 38, "#7ec3ff", 0.34, 2.6);
      burst(s, sx, sy - 10, "#d8c9a3", 10, "poof");
    }
  }
}

// ---------------- war ----------------
function updateWave(s: GameState, dt: number) {
  const warAwake = (s.buildings.barracks ?? 0) > 0 || s.conquest > 0 || s.enemies.length > 0;
  if (warAwake && !s.waveActive) {
    s.waveTimer -= dt;
    if (s.waveTimer <= 0) {
      const n = s.conquest + 1;
      const comp = waveComp(n);
      const hpM = waveHpMult(n);
      const dmgM = waveDmgMult(n);
      let i = 0;
      for (const c of comp) {
        for (let j = 0; j < c.count; j++) {
          s.pendingSpawns.push({
            type: c.type,
            x: WORLD.enemyX + Math.random() * 70,
            y: 240 + Math.random() * (WORLD.h - 480),
            dmgM,
            delay: i * 0.34,
          });
          void hpM;
          i++;
        }
      }
      s.waveActive = true;
      S.horn();
      S.warDrums();
      camPunch(s, 4.5, 0.02, -3, 0, 0.14, "#ff5a3c");
      const desc = comp.map((c) => `${ENEMIES[c.type].name} ×${c.count}`).join(" · ");
      toast(s, "war", `Wave ${n} approaches!`, desc);
      s.questFlash = null;
    }
  }
  // spawn pending
  if (s.pendingSpawns.length > 0) {
    const n = s.conquest + 1;
    const hpM = waveHpMult(n);
    for (const p of s.pendingSpawns) p.delay -= dt;
    while (s.pendingSpawns.length > 0 && s.pendingSpawns[0].delay <= 0) {
      const p = s.pendingSpawns.shift()!;
      const def = ENEMIES[p.type];
      const hp = Math.round(def.hp * hpM);
      s.enemies.push({
        id: uid(), type: p.type, x: p.x, y: p.y, hp, maxhp: hp, dmgM: p.dmgM,
        cd: 0, lunge: 0, face: -1, raid: false, bob: Math.random() * 6,
        jumpZ: 2, vz: 160, squash: 0.35, flash: 0, kbX: 0, kbY: 0, stepT: Math.random(),
      });
    }
  }
  // victory check
  if (s.waveActive && s.enemies.length === 0 && s.pendingSpawns.length === 0) {
    winWave(s);
  }
}

function winWave(s: GameState) {
  const n = s.conquest + 1;
  s.conquest = n;
  s.stats.wavesWon++;
  s.waveActive = false;
  s.waveTimer = WAVE_INTERVAL;
  const oldFront = s.frontX;
  s.frontX = Math.min(WORLD.frontMax, s.frontX + 54);
  s.frontAnim = 1;
  s.rally.x = Math.min(s.rally.x, Math.max(600, s.frontX - 90));
  S.victory();
  s.hitstop = Math.max(s.hitstop, 0.045);
  camPunch(s, 9, 0.045, 5, 0, 0.25, "#ffd86b");
  addRing(s, s.frontX, WORLD.h / 2, 180, "#ffd86b", 0.65, 5);
  addRing(s, s.frontX, WORLD.h / 2, 110, "#ff8a3d", 0.48, 3.5);
  // surviving soldiers leap in victory!
  for (const u of s.units) {
    u.vz = 195 + Math.random() * 55;
    u.jumpZ = 2;
  }
  toast(s, "quest", `Conquest ${n}!`, `The line advances ${Math.round(s.frontX - oldFront)} paces`);
  // spoils physically fly home
  const sp = spoils(n);
  const entries = Object.entries(sp) as [ResKey, number][];
  let orbs = 0;
  for (const [r, amt] of entries) {
    if (r === "valor") {
      gain(s, "valor", amt);
      float(s, s.frontX, 620, `+${amt} Valor`, "#f2c14d", 16, true);
      continue;
    }
    const chunks = Math.min(4, Math.ceil(amt / 8));
    for (let i = 0; i < chunks; i++) {
      s.orbs.push({
        id: uid(), x: s.frontX - 20 + Math.random() * 40, y: 560 + Math.random() * 160,
        sx: s.frontX - 20 + Math.random() * 40, sy: 560 + Math.random() * 160,
        tx: WORLD.stockX, ty: WORLD.stockY - 40, t: -orbs * 0.08, dur: 1.0,
        res: r, amt: Math.ceil(amt / chunks),
      });
      orbs++;
    }
  }
  // conquered land yields a node
  spawnBonusNode(s);
  if (n >= 2 && Math.random() < 0.35) spawnBonusNode(s);
  // ember burst along the new line
  for (let i = 0; i < 32; i++) {
    addParticle(s, {
      x: s.frontX + (Math.random() * 20 - 10), y: 220 + Math.random() * (WORLD.h - 440),
      vx: -60 - Math.random() * 90, vy: -35 - Math.random() * 60, life: 0.9, size: 2.8 + Math.random() * 2.2,
      color: i % 3 === 0 ? "#ffd86b" : "#ff9448", kind: i % 4 === 0 ? "star" : "ember", grav: -40,
    });
  }
  checkQuests(s);
}

function unitSlot(s: GameState, idx: number): { x: number; y: number } {
  const cols = 5;
  const cx = s.rally.x - 30 + (idx % cols) * 26 - ((cols - 1) * 26) / 2;
  const cy = s.rally.y - 10 + Math.floor(idx / cols) * 24 - 24;
  return { x: Math.min(cx, s.frontX - 60 - Math.floor(idx / cols) * 10), y: cy };
}

function updateUnits(s: GameState, dt: number) {
  const leash = s.frontX + WORLD.warLeash;
  for (let i = s.units.length - 1; i >= 0; i--) {
    const u = s.units[i];
    if (u.hp <= 0) {
      addRing(s, u.x, u.y - 8, 28, "#c9b78f", 0.28, 2.2);
      burst(s, u.x, u.y - 12, "#c9b78f", 12, "poof");
      if (sfxGate.death <= 0) { S.death(); sfxGate.death = 0.18; }
      s.units.splice(i, 1);
      continue;
    }
    const def = UNITS[u.type];
    u.lunge = Math.max(0, u.lunge - dt * 4.5);
    u.flash = Math.max(0, (u.flash ?? 0) - dt * 7);
    u.bob += dt * 6.5;
    stepJumpPhysics(u, s, dt);
    if (u.kbX || u.kbY) {
      u.x += (u.kbX ?? 0) * dt * 10;
      u.y += (u.kbY ?? 0) * dt * 10;
      u.kbX = lerp(u.kbX ?? 0, 0, 1 - Math.exp(-14 * dt));
      u.kbY = lerp(u.kbY ?? 0, 0, 1 - Math.exp(-14 * dt));
    }

    // acquire target
    let target: EnemyEnt | null = null;
    let bd = Infinity;
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      if (e.x > leash && !e.raid) continue;
      const d = dist(u.x, u.y, e.x, e.y);
      if (d < bd) { bd = d; target = e; }
    }
    if (target) {
      const rng = def.rng;
      u.face = target.x >= u.x ? 1 : -1;
      if (bd > rng) {
        const spd = def.spd * marchMult(s);
        u.x += ((target.x - u.x) / bd) * spd * dt;
        u.y += ((target.y - u.y) / bd) * spd * dt;
        u.cd = Math.max(0, u.cd - dt);
      } else {
        u.cd -= dt;
        if (u.cd <= 0) {
          u.cd = def.cd;
          u.lunge = 1;
          u.squash = 0.32;
          const dmg = def.dmg * dmgMult(s);
          if (def.ranged) {
            s.projs.push({ x1: u.x, y1: u.y - 22, x2: target.x, y2: target.y - 14, t: 0, dur: clamp(bd / 420, 0.12, 0.6), dmg, friend: true, targetId: target.id, kind: "arrow" });
            if (sfxGate.arrow <= 0) { S.arrow(); sfxGate.arrow = 0.12; }
          } else if (def.aoe) {
            for (const e of s.enemies) {
              if (dist(e.x, e.y, target.x, target.y) <= def.aoe) {
                damageEnemy(s, e, dmg, false, u.x, u.y);
                e.vz = 135;
                e.jumpZ = 1;
              }
            }
            s.hitstop = Math.max(s.hitstop, 0.025);
            camPunch(s, 5.5, 0.024, u.face * 3, 3);
            addRing(s, target.x, target.y - 4, def.aoe, "#ff9448", 0.42, 3.8);
            addRing(s, target.x, target.y - 4, def.aoe * 0.55, "#ffd86b", 0.28, 2.2);
            burst(s, target.x, target.y - 6, "#b9a887", 16, "dust");
            burst(s, target.x, target.y - 12, "#ff9448", 10, "spark");
            S.golemSlam();
          } else {
            damageEnemy(s, target, dmg, false, u.x, u.y);
            slashFx(s, u, target);
          }
        }
      }
    } else {
      // hold formation at the rally
      const slot = unitSlot(s, i);
      const d = dist(u.x, u.y, slot.x, slot.y);
      if (d > 8) {
        const spd = def.spd * marchMult(s);
        u.x += ((slot.x - u.x) / d) * Math.min(spd, d * 2) * dt;
        u.y += ((slot.y - u.y) / d) * Math.min(spd, d * 2) * dt;
        u.face = slot.x > u.x ? 1 : -1;
      } else {
        u.face = 1;
      }
      u.cd = Math.max(0, u.cd - dt * 0.5);
    }
  }
}

function slashFx(s: GameState, u: UnitEnt, t: EnemyEnt) {
  const ang = Math.atan2(t.y - u.y, t.x - u.x);
  addSlash(s, (u.x + t.x) / 2, (u.y + t.y) / 2 - 12, ang, 22, "#fff3d8", 0.18, u.face);
  addParticle(s, { x: t.x, y: t.y - 16, vx: (t.x - u.x) * 1.2, vy: -30, life: 0.22, size: 7, color: "#fff3d8", kind: "spark", grav: 40 });
  if (sfxGate.hit <= 0) { S.hit(); sfxGate.hit = 0.1; }
}

function updateEnemies(s: GameState, dt: number) {
  let pressCount = 0;
  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i];
    if (e.hp <= 0) {
      const def = ENEMIES[e.type];
      gain(s, "valor", def.valor);
      s.stats.kills++;
      addRing(s, e.x, e.y - 10, e.type === "warlord" ? 72 : 34, "#f2c14d", 0.34, e.type === "warlord" ? 4 : 2.4);
      float(s, e.x, e.y - 34, `+${def.valor} Valor`, "#f2c14d", e.type === "warlord" ? 16 : 12, e.type === "warlord");
      burst(s, e.x, e.y - 10, "#5f5370", 14, "poof");
      burst(s, e.x, e.y - 14, "#f2c14d", 6, "spark");
      if (e.type === "warlord") {
        s.hitstop = Math.max(s.hitstop, 0.04);
        camPunch(s, 7, 0.035, 0, 0, 0.2, "#f2c14d");
      }
      if (sfxGate.death <= 0) { S.death(); sfxGate.death = 0.14; }
      s.enemies.splice(i, 1);
      continue;
    }
    const def = ENEMIES[e.type];
    e.lunge = Math.max(0, e.lunge - dt * 4.5);
    e.flash = Math.max(0, (e.flash ?? 0) - dt * 7);
    e.bob += dt * 5.5;
    stepJumpPhysics(e, s, dt);
    if (e.kbX || e.kbY) {
      e.x += (e.kbX ?? 0) * dt * 10;
      e.y += (e.kbY ?? 0) * dt * 10;
      e.kbX = lerp(e.kbX ?? 0, 0, 1 - Math.exp(-14 * dt));
      e.kbY = lerp(e.kbY ?? 0, 0, 1 - Math.exp(-14 * dt));
    }

    // find nearest living unit
    let target: UnitEnt | null = null;
    let bd = Infinity;
    for (const u of s.units) {
      if (u.hp <= 0) continue;
      const d = dist(e.x, e.y, u.x, u.y);
      if (d < bd) { bd = d; target = u; }
    }
    if (e.raid) {
      const tx = WORLD.stockX;
      const ty = WORLD.stockY - 6;
      const d = dist(e.x, e.y, tx, ty);
      if (target && bd < def.rng * 1.4) {
        e.face = target.x >= e.x ? 1 : -1;
        e.cd -= dt;
        if (e.cd <= 0) { e.cd = def.cd; e.lunge = 1; damageUnit(s, target, def.dmg * e.dmgM, e.x, e.y); slashFxEnemy(s, e, target); }
      } else if (d < 44) {
        const stolenW = Math.ceil(s.res.wood * 0.05);
        const stolenS = Math.ceil(s.res.stone * 0.05);
        s.res.wood = Math.max(0, s.res.wood - stolenW);
        s.res.stone = Math.max(0, s.res.stone - stolenS);
        float(s, tx, ty - 70, `-${stolenW + stolenS} plundered!`, "#ff8a6a", 15, true);
        toast(s, "warn", "The stockpile was raided!", "Keep soldiers on the line");
        S.raidAlarm();
        camPunch(s, 5, 0.025, 0, 0, 0.18, "#ff5a3c");
        burst(s, e.x, e.y, "#5f5370", 14, "poof");
        s.enemies.splice(i, 1);
      } else {
        e.face = tx >= e.x ? 1 : -1;
        e.x += ((tx - e.x) / d) * def.spd * 1.15 * dt;
        e.y += ((ty - e.y) / d) * def.spd * 1.15 * dt;
      }
      continue;
    }
    if (target) {
      e.face = target.x >= e.x ? 1 : -1;
      if (bd > def.rng) {
        e.x += ((target.x - e.x) / bd) * def.spd * dt;
        e.y += ((target.y - e.y) / bd) * def.spd * dt;
        e.cd = Math.max(0, e.cd - dt * 0.5);
      } else {
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = def.cd;
          e.lunge = 1;
          e.squash = 0.34;
          const dmg = def.dmg * e.dmgM;
          if (def.ranged) {
            s.projs.push({ x1: e.x, y1: e.y - 20, x2: target.x, y2: target.y - 14, t: 0, dur: clamp(bd / 380, 0.14, 0.6), dmg, friend: false, targetId: target.id, kind: "bolt" });
            S.arrow();
          } else {
            damageUnit(s, target, dmg, e.x, e.y);
            slashFxEnemy(s, e, target);
            if (def.key === "warlord") camPunch(s, 4, 0.018);
          }
        }
      }
    } else if (e.x > s.frontX + 26) {
      e.face = -1;
      e.x -= def.spd * dt;
    } else {
      pressCount++;
      if (s.frontX <= WORLD.frontMin + 0.5 && s.enemies.filter((x) => x.raid).length < 3) {
        e.raid = true;
        toast(s, "warn", "Raiders are heading for the stockpile!", "Train soldiers to intercept");
        S.raidAlarm();
      }
    }
  }
  if (pressCount > 0 && s.frontX > WORLD.frontMin) {
    s.frontX = Math.max(WORLD.frontMin, s.frontX - (3.5 + Math.min(pressCount, 6) * 0.8) * dt);
    s.rally.x = Math.min(s.rally.x, Math.max(600, s.frontX - 90));
    if (Math.random() < dt * 4) {
      addParticle(s, { x: s.frontX, y: 300 + Math.random() * (WORLD.h - 600), vx: -30, vy: -20, life: 0.5, size: 2.5, color: "#8a7a5c", kind: "dust", grav: -10 });
    }
  }
}

function slashFxEnemy(s: GameState, e: EnemyEnt, t: UnitEnt) {
  const ang = Math.atan2(t.y - e.y, t.x - e.x);
  addSlash(s, (e.x + t.x) / 2, (e.y + t.y) / 2 - 12, ang, 22, "#e0b0ff", 0.18, e.face);
  addParticle(s, { x: t.x, y: t.y - 16, vx: (t.x - e.x) * 1.2, vy: -30, life: 0.2, size: 6, color: "#e0b0ff", kind: "spark", grav: 40 });
  if (sfxGate.hit <= 0) { S.hit(); sfxGate.hit = 0.12; }
}

function updateProjs(s: GameState, dt: number) {
  for (let i = s.projs.length - 1; i >= 0; i--) {
    const p = s.projs[i];
    p.t += dt / p.dur;
    if (p.t >= 1) {
      if (p.friend) {
        const e = s.enemies.find((x) => x.id === p.targetId);
        if (e && e.hp > 0) {
          damageEnemy(s, e, p.dmg, false, p.x1, p.y1);
          burst(s, e.x, e.y - 14, "#ffe6a8", 5, "spark");
        }
      } else {
        const u = s.units.find((x) => x.id === p.targetId);
        if (u && u.hp > 0) {
          damageUnit(s, u, p.dmg, p.x1, p.y1);
          burst(s, u.x, u.y - 14, "#c98aff", 5, "spark");
        }
      }
      s.projs.splice(i, 1);
    }
  }
}

function updateOrbs(s: GameState, dt: number) {
  for (let i = s.orbs.length - 1; i >= 0; i--) {
    const o = s.orbs[i];
    o.t += dt / o.dur;
    if (o.t < 0) continue;
    const t = Math.min(1, o.t);
    // ease-in acceleration curve for magnet feel
    const ease = t * t * (2.2 - 1.2 * t);
    o.x = lerp(o.sx, o.tx, ease);
    o.y = lerp(o.sy, o.ty, ease) - Math.sin(t * Math.PI) * 84;
    if (Math.random() < dt * 28) {
      addParticle(s, {
        x: o.x, y: o.y,
        vx: (Math.random() - 0.5) * 18, vy: (Math.random() - 0.5) * 18,
        life: 0.24, size: 2.4, color: RES_META[o.res].color, kind: "spark", grav: 0,
      });
    }
    if (o.t >= 1) {
      gain(s, o.res, o.amt);
      s.depositLog.push({ t: s.time, res: o.res, amt: o.amt });
      addRing(s, o.tx, o.ty + 18, 28, RES_META[o.res].color, 0.25, 2.2);
      burst(s, o.tx, o.ty + 14, RES_META[o.res].color, 6, "spark");
      if (sfxGate.deposit <= 0) { S.deposit(); sfxGate.deposit = 0.06; }
      s.orbs.splice(i, 1);
    }
  }
}

// ---------------- ambience / fx ----------------
let birdTimer = 6;
let prevUnits = 0;
function updateAmbience(s: GameState, dt: number) {
  // clouds
  for (const c of s.decor.clouds) {
    c.x += c.v * dt;
    if (c.x - c.s > WORLD.w) c.x = -c.s;
  }
  // birds
  birdTimer -= dt;
  if (birdTimer <= 0 && s.decor.birds.length < 3) {
    birdTimer = 11 + Math.random() * 12;
    const dir = Math.random() < 0.5 ? 1 : -1;
    s.decor.birds.push({ x: dir > 0 ? -30 : WORLD.w + 30, y: 130 + Math.random() * 260, vx: dir * (60 + Math.random() * 40), ph: Math.random() * 6, seed: Math.random() * 10 });
  }
  for (let i = s.decor.birds.length - 1; i >= 0; i--) {
    const b = s.decor.birds[i];
    b.x += b.vx * dt;
    b.ph += dt * 9;
    if (b.x < -60 || b.x > WORLD.w + 60) s.decor.birds.splice(i, 1);
  }
  // chimney smoke
  for (const b of s.buildingEnts) {
    const rate = b.key === "forge" ? 5 : b.key === "workshop" ? 2.6 : 1.4;
    if (Math.random() < dt * rate) {
      addParticle(s, {
        x: b.x + (b.key === "forge" ? 14 : -10) + Math.random() * 6, y: b.y - 56,
        vx: 6 + Math.random() * 8, vy: -22 - Math.random() * 12, life: 2.6, size: 5 + Math.random() * 5,
        color: "rgba(200,195,185,0.5)", kind: "smoke", grav: -8,
      });
    }
    if (b.key === "forge" && Math.random() < dt * 6) {
      addParticle(s, { x: b.x + 2, y: b.y - 20, vx: Math.random() * 20 - 10, vy: -30 - Math.random() * 20, life: 0.7, size: 2, color: "#ffab5e", kind: "ember", grav: -20 });
    }
  }
  // stockpile brazier
  if (Math.random() < dt * 9) {
    addParticle(s, { x: WORLD.stockX + 34 + Math.random() * 6, y: WORLD.stockY - 44, vx: Math.random() * 8 - 4, vy: -34 - Math.random() * 14, life: 0.8, size: 2.6 + Math.random() * 2, color: Math.random() < 0.5 ? "#ffb066" : "#ff7a29", kind: "flame", grav: -30 });
  }
  // embers rising near the front
  if (Math.random() < dt * 7) {
    addParticle(s, {
      x: s.frontX - 80 + Math.random() * 190, y: 200 + Math.random() * (WORLD.h - 400),
      vx: -8 - Math.random() * 14, vy: -24 - Math.random() * 22, life: 2 + Math.random(), size: 1.6 + Math.random() * 1.8,
      color: "#ff9448", kind: "ember", grav: -12,
    });
  }
  // fireflies at night near the base
  const night = 1 - dayFactor(s);
  if (night > 0.55 && Math.random() < dt * 6 * night) {
    addParticle(s, {
      x: 200 + Math.random() * 900, y: 300 + Math.random() * 700,
      vx: Math.random() * 16 - 8, vy: Math.random() * 12 - 6, life: 3 + Math.random() * 2, size: 1.8,
      color: "#d8f27a", kind: "glow", grav: 0,
    });
  }
  // falling leaves near trees
  if (Math.random() < dt * 3) {
    const trees = s.nodes.filter((n) => n.type === "tree" && n.amount > 0 && n.x < 1500);
    if (trees.length > 0) {
      const t = trees[(Math.random() * trees.length) | 0];
      addParticle(s, { x: t.x + Math.random() * 40 - 20, y: t.y - 40, vx: 10 + Math.random() * 12, vy: 16 + Math.random() * 10, life: 3, size: 3, color: "#7ca24e", kind: "leaf", grav: 4 });
    }
  }
}

export function dayFactor(s: GameState): number {
  const t = s.dayT;
  return clamp(0.5 + 0.5 * Math.sin(t * Math.PI * 2 - Math.PI / 2), 0, 1);
}

function updateFx(s: GameState, dt: number) {
  for (let i = s.particles.length - 1; i >= 0; i--) {
    const p = s.particles[i];
    p.life -= dt;
    if (p.life <= 0) { s.particles.splice(i, 1); continue; }
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === "smoke") { p.size += dt * 6; p.vx += dt * 4; }
    if (p.kind === "leaf") p.x += Math.sin(p.life * 6) * dt * 18;
    if (p.kind === "glow") { p.vx += (Math.random() - 0.5) * 20 * dt; p.vy += (Math.random() - 0.5) * 20 * dt; }
  }
  for (let i = s.rings.length - 1; i >= 0; i--) {
    s.rings[i].life -= dt;
    if (s.rings[i].life <= 0) s.rings.splice(i, 1);
  }
  for (let i = s.slashes.length - 1; i >= 0; i--) {
    s.slashes[i].life -= dt;
    if (s.slashes[i].life <= 0) s.slashes.splice(i, 1);
  }
  for (let i = s.bolts.length - 1; i >= 0; i--) {
    s.bolts[i].life -= dt;
    if (s.bolts[i].life <= 0) s.bolts.splice(i, 1);
  }
  for (let i = s.floats.length - 1; i >= 0; i--) {
    const f = s.floats[i];
    f.life -= dt;
    if (f.vx !== undefined && f.vy !== undefined) {
      f.vy += 95 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vx *= 1 - 2.2 * dt;
    } else {
      f.y -= dt * 26;
    }
    if (f.life <= 0) s.floats.splice(i, 1);
  }
}

function updateRates(s: GameState, _dt: number) {
  void _dt;
  const cutoff = s.time - 25;
  while (s.depositLog.length > 0 && s.depositLog[0].t < cutoff) s.depositLog.shift();
  const sums: Record<ResKey, number> = { wood: 0, stone: 0, iron: 0, crystal: 0, valor: 0 };
  for (const d of s.depositLog) sums[d.res] += d.amt;
  const win = Math.max(6, Math.min(25, s.time));
  for (const r of Object.keys(sums) as ResKey[]) s.rates[r] = sums[r] / win;
}

function checkQuests(s: GameState) {
  for (const q of QUESTS) {
    if (s.questsDone.includes(q.id)) continue;
    if (q.prog(s) >= q.target) {
      s.questsDone.push(q.id);
      s.questFlash = q.id;
      const parts = (Object.entries(q.reward) as [ResKey, number][]).map(([r, a]) => {
        gain(s, r, a);
        return `+${a} ${RES_META[r].label}`;
      });
      camPunch(s, 3.8, 0.022, 0, 0, 0.14, "#f2c14d");
      toast(s, "quest", `Milestone: ${q.name}`, parts.join(" · "));
      S.quest();
      setTimeout(() => { if (G.s) G.s.questFlash = null; }, 1200);
    }
  }
}
