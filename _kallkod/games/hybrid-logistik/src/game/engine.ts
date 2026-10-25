import {
  GameState, ResNode, Building, Worker, Unit, ResType, BuildingType, NodeType,
  BUILDING_INFO, BASE_W, LANE_X, LANE_W, WORLD_H, RES_COLORS, Resources,
} from './types';
import { sfx } from './audio';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export function createGame(): GameState {
  const center = { x: 440, y: 380 };
  const s: GameState = {
    t: 0, res: { wood: 40, stone: 10, food: 10, iron: 0, weapons: 0, gold: 0 }, cap: 150,
    nodes: [], buildings: [], workers: [], units: [], particles: [], drops: [], floaters: [],
    territory: 175, center, workerCap: 3, nextId: 1,
    priority: { wood: 3, stone: 2, food: 2, iron: 2, weapons: 3 },
    front: { sector: 1, fortressHp: 220, fortressMax: 220, spawnTimer: 4, gateHp: 100, gateMax: 100, conquered: 0, banner: 0, bannerText: '', shake: 0 },
    research: [
      { id: 'axes', name: 'Sharpened Tools', desc: 'Gathering 40% faster.', cost: 15, bought: false, icon: '🪓' },
      { id: 'barrow', name: 'Wheelbarrows', desc: 'Workers carry 2 units per trip.', cost: 30, bought: false, icon: '🛞' },
      { id: 'roads', name: 'Paved Roads', desc: 'Everything moves 30% faster.', cost: 45, bought: false, icon: '🛣️' },
      { id: 'steel', name: 'Steel Weapons', desc: 'Soldiers +50% attack and HP.', cost: 60, bought: false, icon: '🗡️' },
      { id: 'bellows', name: 'Great Bellows', desc: 'Mines and forges produce 2x.', cost: 90, bought: false, icon: '💨' },
      { id: 'banners', name: 'War Banners', desc: 'Barracks train twice as fast.', cost: 140, bought: false, icon: '🚩' },
    ],
    stats: { totalGathered: 0, delivered: 0, kills: 0, built: 0 },
    placing: null, hoverX: -1, hoverY: -1, speed: 1, muted: false, log: [], prodMult: 1,
  };
  s.buildings.push({ id: s.nextId++, type: 'depot', x: center.x, y: center.y, progress: 1, timer: 0, output: 0, outputType: null, anim: 0, reserved: 0 });
  // scatter nodes
  const place = (type: NodeType, n: number, minR: number) => {
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const x = rnd(40, BASE_W - 40), y = rnd(50, WORLD_H - 40);
        if (dist(x, y, center.x, center.y) < minR) continue;
        if (s.nodes.some(nd => dist(nd.x, nd.y, x, y) < 26)) continue;
        const max = type === 'tree' ? 8 : type === 'rock' ? 12 : 10;
        s.nodes.push({ id: s.nextId++, type, x, y, amount: max, max, regrow: 0, scale: rnd(0.8, 1.2), wobble: rnd(0, 6) });
        break;
      }
    }
  };
  place('tree', 90, 70); place('rock', 34, 90); place('ore', 22, 160);
  for (let i = 0; i < 3; i++) spawnWorker(s, false);
  log(s, 'Your settlers arrive at Emberhold. Chop wood, build cottages, grow.');
  return s;
}

export function log(s: GameState, m: string) { s.log.unshift(m); if (s.log.length > 6) s.log.pop(); }

function spawnWorker(s: GameState, isCart: boolean, from?: { x: number; y: number }) {
  const o = from ?? s.center;
  s.workers.push({
    id: s.nextId++, x: o.x + rnd(-10, 10), y: o.y + 30, tx: 0, ty: 0, state: 'idle', carry: null, carryAmt: 0,
    targetId: -1, timer: rnd(0, 0.5), facing: 1, bob: rnd(0, 6), isCart, wait: 0, hue: rnd(0, 360),
  });
}

export function has(s: GameState) { return s.research.reduce((a, r) => { a[r.id] = r.bought; return a; }, {} as Record<string, boolean>); }

export function canAfford(s: GameState, cost: Partial<Resources>) {
  return (Object.keys(cost) as (keyof Resources)[]).every(k => s.res[k] >= (cost[k] ?? 0));
}
function pay(s: GameState, cost: Partial<Resources>) {
  (Object.keys(cost) as (keyof Resources)[]).forEach(k => { s.res[k] -= cost[k] ?? 0; });
}

export function inTerritory(s: GameState, x: number, y: number) {
  return s.buildings.some(b => (b.type === 'depot' || b.type === 'tower') && b.progress >= 1 && dist(x, y, b.x, b.y) < (b.type === 'depot' ? s.territory : 140))
    || dist(x, y, s.center.x, s.center.y) < s.territory;
}

export function canPlaceAt(s: GameState, type: BuildingType, x: number, y: number) {
  const size = BUILDING_INFO[type].size;
  if (x < size || x > BASE_W - size || y < size + 10 || y > WORLD_H - size) return false;
  if (type !== 'tower' && !inTerritory(s, x, y)) return false;
  if (type === 'tower' && !inTerritory(s, x, y) && !s.buildings.some(b => dist(b.x, b.y, x, y) < 200)) return false;
  if (s.buildings.some(b => dist(b.x, b.y, x, y) < (BUILDING_INFO[b.type].size + size) * 0.75 + 6)) return false;
  return true;
}

export function tryPlace(s: GameState, x: number, y: number) {
  const type = s.placing; if (!type) return false;
  const info = BUILDING_INFO[type];
  if (!canAfford(s, info.cost) || !canPlaceAt(s, type, x, y)) return false;
  pay(s, info.cost);
  // clear nodes under building
  s.nodes = s.nodes.filter(n => dist(n.x, n.y, x, y) > info.size * 0.9);
  s.buildings.push({ id: s.nextId++, type, x, y, progress: 0, timer: 0, output: 0, outputType: type === 'mine' ? 'iron' : type === 'forge' ? 'weapons' : null, anim: 0, reserved: 0 });
  sfx('place');
  if (!canAfford(s, info.cost)) s.placing = null;
  return true;
}

export function buyResearch(s: GameState, id: string) {
  const r = s.research.find(r => r.id === id); if (!r || r.bought || s.res.gold < r.cost) return;
  s.res.gold -= r.cost; r.bought = true; sfx('conquer'); log(s, `Researched ${r.name}.`);
}

export function expandTerritory(s: GameState) {
  const cost = Math.floor(20 + s.territory / 8);
  if (s.res.gold < cost) return; s.res.gold -= cost; s.territory += 40; sfx('conquer'); log(s, 'The border pushes outward.');
}
export function expandCost(s: GameState) { return Math.floor(20 + s.territory / 8); }

// ---------- helpers ----------
function addParticles(s: GameState, x: number, y: number, n: number, color: string, spread = 60, g = 200, size = 3, life = 0.6) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), sp = rnd(spread * 0.3, spread);
    s.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - spread * 0.5, life, maxLife: life, color, size: rnd(size * 0.6, size * 1.3), g });
  }
}
function float(s: GameState, x: number, y: number, text: string, color = '#fff') { s.floaters.push({ x, y, text, life: 1.2, color }); }

function nodeRes(t: NodeType): ResType { return t === 'tree' ? 'wood' : t === 'rock' ? 'stone' : t === 'ore' ? 'iron' : 'food'; }

function depots(s: GameState) { return s.buildings.filter(b => (b.type === 'depot' || b.type === 'storehouse') && b.progress >= 1); }
function nearestDepot(s: GameState, x: number, y: number) {
  let best: Building | null = null, bd = 1e9;
  for (const b of depots(s)) { const d = dist(x, y, b.x, b.y); if (d < bd) { bd = d; best = b; } }
  return best!;
}

function totalStock(s: GameState) { return s.res.wood + s.res.stone + s.res.food + s.res.iron + s.res.weapons; }

function moveTo(w: Worker, speed: number, dt: number) {
  const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy);
  if (d < 3) return true;
  const st = Math.min(d, speed * dt);
  w.x += dx / d * st; w.y += dy / d * st; w.facing = dx < 0 ? -1 : 1; w.bob += dt * 14;
  return false;
}

// ---------- main update ----------
export function update(s: GameState, dt: number) {
  s.t += dt;
  const R = has(s);
  const moveMult = R.roads ? 1.3 : 1;
  const gatherMult = R.axes ? 1.4 : 1;
  const carryCap = R.barrow ? 2 : 1;
  const prod = (R.bellows ? 2 : 1) * s.prodMult;

  s.cap = 150 + s.buildings.filter(b => b.type === 'storehouse' && b.progress >= 1).length * 120;
  s.workerCap = 3 + s.buildings.filter(b => b.type === 'house' && b.progress >= 1).length * 2;

  // -------- buildings --------
  for (const b of s.buildings) {
    b.anim += dt;
    if (b.progress < 1) continue;
    const info = BUILDING_INFO[b.type];
    switch (b.type) {
      case 'farm': {
        b.timer += dt;
        const plots = s.nodes.filter(n => n.type === 'wheat' && dist(n.x, n.y, b.x, b.y) < 60);
        if (b.timer > 3 / prod && plots.length < 6) {
          b.timer = 0;
          for (let tries = 0; tries < 12; tries++) {
            const a = rnd(0, Math.PI * 2), r = rnd(info.size * 0.9, 58);
            const x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r;
            if (s.nodes.some(n => dist(n.x, n.y, x, y) < 16) || s.buildings.some(o => o !== b && dist(o.x, o.y, x, y) < BUILDING_INFO[o.type].size)) continue;
            s.nodes.push({ id: s.nextId++, type: 'wheat', x, y, amount: 3, max: 3, regrow: 0, scale: rnd(0.9, 1.1), wobble: rnd(0, 6) });
            break;
          }
        }
        break;
      }
      case 'mine':
        b.timer += dt * prod;
        if (b.timer > 4 && b.output < 12) { b.timer = 0; b.output++; addParticles(s, b.x, b.y - 10, 4, '#777', 40, 150, 2, 0.5); }
        break;
      case 'forge':
        b.timer += dt * prod;
        if (b.timer > 5 && b.output < 8 && s.res.iron >= 2 && s.res.wood >= 1) {
          b.timer = 0; s.res.iron -= 2; s.res.wood -= 1; b.output++;
          addParticles(s, b.x + 8, b.y - 14, 8, '#ffb347', 80, 250, 2, 0.4); sfx('build');
        }
        break;
      case 'barracks': {
        const rate = R.banners ? 2 : 1;
        b.timer += dt * rate;
        if (b.timer > 6 && s.res.food >= 5 && s.res.weapons >= 1) {
          b.timer = 0; s.res.food -= 5; s.res.weapons -= 1;
          const st = R.steel ? 1.5 : 1;
          const veteran = 1 + s.front.conquered * 0.12;
          s.units.push({ id: s.nextId++, x: b.x, y: b.y + 20, hp: 40 * st * veteran, maxHp: 40 * st * veteran, atk: 6 * st * veteran, side: 'ally', cd: 0, kind: 0, anim: rnd(0, 6), lunge: 0 });
          float(s, b.x, b.y - 30, '⚔ recruit', '#ffd9d9'); sfx('spawn');
        }
        break;
      }
      case 'cartyard':
        if (b.timer === 0) { b.timer = 1; spawnWorker(s, true, b); log(s, 'A cart rolls out of the Cart Yard.'); }
        break;
      case 'house':
        if (b.timer === 0) { b.timer = 1; spawnWorker(s, false, b); spawnWorker(s, false, b); log(s, 'Two new settlers step out of the cottage.'); }
        break;
    }
  }
  // clamp stock to cap (gold unlimited)
  const total = totalStock(s);
  if (total > s.cap) {
    const f = s.cap / total; (['wood', 'stone', 'food', 'iron', 'weapons'] as ResType[]).forEach(k => { s.res[k] = Math.floor(s.res[k] * f); });
  }

  // -------- nodes regrow --------
  for (const n of s.nodes) {
    n.wobble += dt;
    if (n.amount <= 0) {
      n.regrow += dt;
      const need = n.type === 'tree' ? 35 : n.type === 'wheat' ? 8 : 70;
      if (n.regrow > need) { n.regrow = 0; n.amount = n.max; }
    }
  }

  // -------- workers --------
  for (const w of s.workers) {
    const speed = (w.isCart ? 110 : 62) * moveMult;
    switch (w.state) {
      case 'idle': {
        w.wait -= dt;
        if (w.wait > 0) break;
        w.wait = 0.4;
        // construction first
        if (!w.isCart) {
          const site = s.buildings.find(b => b.progress < 1 && b.reserved < 2);
          if (site) { site.reserved++; w.targetId = site.id; w.tx = site.x + rnd(-14, 14); w.ty = site.y + 18; w.state = 'toBuild'; break; }
        }
        // building output piles
        const piles = s.buildings.filter(b => b.progress >= 1 && b.output - b.reserved > 0 && b.outputType);
        if (piles.length && (w.isCart || Math.random() < 0.6)) {
          let best = piles[0], bd = 1e9;
          for (const p of piles) { const d = dist(w.x, w.y, p.x, p.y) / (1 + p.output * 0.15); if (d < bd) { bd = d; best = p; } }
          best.reserved += w.isCart ? Math.min(5, best.output - best.reserved) : Math.min(carryCap, best.output - best.reserved);
          w.targetId = best.id; w.tx = best.x + 20; w.ty = best.y + 12; w.state = 'toPile'; break;
        }
        if (w.isCart) break;
        // choose a resource by weighted priority & scarcity
        const types: ResType[] = ['wood', 'stone', 'food', 'iron'];
        const weights = types.map(t => {
          const stock = s.res[t];
          const scarcity = 1 / (1 + stock / 40);
          return s.priority[t] * scarcity;
        });
        const order = types.map((t, i) => ({ t, wgt: weights[i] * rnd(0.5, 1.5) })).sort((a, b) => b.wgt - a.wgt);
        let found = false;
        for (const o of order) {
          if (o.wgt <= 0) continue;
          const nt: NodeType = o.t === 'wood' ? 'tree' : o.t === 'stone' ? 'rock' : o.t === 'iron' ? 'ore' : 'wheat';
          let best: ResNode | null = null, bd = 1e9;
          for (const n of s.nodes) {
            if (n.type !== nt || n.amount <= 0) continue;
            if (!inTerritory(s, n.x, n.y)) continue;
            const d = dist(w.x, w.y, n.x, n.y) + rnd(0, 40);
            if (d < bd) { bd = d; best = n; }
          }
          if (best) { w.targetId = best.id; w.tx = best.x + rnd(-6, 6); w.ty = best.y + 10; w.state = 'toNode'; found = true; break; }
        }
        if (!found) { w.tx = s.center.x + rnd(-40, 40); w.ty = s.center.y + rnd(30, 60); w.wait = 1.2; }
        break;
      }
      case 'toNode': {
        const n = s.nodes.find(n => n.id === w.targetId);
        if (!n || n.amount <= 0) { w.state = 'idle'; break; }
        if (moveTo(w, speed, dt)) { w.state = 'gather'; w.timer = 0; }
        break;
      }
      case 'gather': {
        const n = s.nodes.find(n => n.id === w.targetId);
        if (!n || n.amount <= 0) { w.state = w.carry ? 'toDepot' : 'idle'; if (w.carry) { const d = nearestDepot(s, w.x, w.y); w.tx = d.x; w.ty = d.y + 26; } break; }
        w.timer += dt * gatherMult;
        w.bob += dt * 20;
        const period = n.type === 'wheat' ? 0.7 : 1.3;
        if (w.timer > period) {
          w.timer = 0; n.amount--; s.stats.totalGathered++;
          const rt = nodeRes(n.type);
          w.carry = rt; w.carryAmt++;
          const col = n.type === 'tree' ? '#c8935a' : n.type === 'rock' ? '#bbb' : n.type === 'ore' ? '#8fa3c7' : '#f0d060';
          addParticles(s, n.x, n.y - 10, 6, col, 70, 260, 2.5, 0.5);
          sfx('chop');
          if (n.type === 'tree' && n.amount <= 0) { addParticles(s, n.x, n.y, 14, '#7a5230', 90, 220, 3, 0.8); }
          if (w.carryAmt >= carryCap || n.amount <= 0) {
            const d = nearestDepot(s, w.x, w.y); w.tx = d.x + rnd(-10, 10); w.ty = d.y + 26; w.state = 'toDepot';
          }
        }
        break;
      }
      case 'toPile': {
        const b = s.buildings.find(b => b.id === w.targetId);
        if (!b) { w.state = 'idle'; break; }
        if (moveTo(w, speed, dt)) {
          const take = Math.min(w.isCart ? 5 : carryCap, b.output);
          b.output -= take; b.reserved = Math.max(0, b.reserved - take);
          if (take > 0 && b.outputType) { w.carry = b.outputType; w.carryAmt = take; const d = nearestDepot(s, w.x, w.y); w.tx = d.x + rnd(-10, 10); w.ty = d.y + 26; w.state = 'toDepot'; }
          else w.state = 'idle';
        }
        break;
      }
      case 'toDepot': {
        if (moveTo(w, speed, dt)) {
          if (w.carry) {
            const room = Math.max(0, s.cap - totalStock(s));
            const add = Math.min(w.carryAmt, room);
            s.res[w.carry] += add; s.stats.delivered += add;
            float(s, w.x, w.y - 26, `+${add} ${w.carry}`, RES_COLORS[w.carry]);
            if (add < w.carryAmt) float(s, w.x, w.y - 40, 'storage full!', '#ff8080');
            addParticles(s, w.x, w.y - 10, 5, RES_COLORS[w.carry], 40, 150, 2, 0.4);
            sfx('deliver');
          }
          w.carry = null; w.carryAmt = 0; w.state = 'idle'; w.wait = 0.15;
        }
        break;
      }
      case 'toBuild': {
        const b = s.buildings.find(b => b.id === w.targetId);
        if (!b || b.progress >= 1) { w.state = 'idle'; break; }
        if (moveTo(w, speed, dt)) { w.state = 'build'; w.timer = 0; }
        break;
      }
      case 'build': {
        const b = s.buildings.find(b => b.id === w.targetId);
        if (!b || b.progress >= 1) { w.state = 'idle'; break; }
        w.bob += dt * 18; w.timer += dt;
        b.progress += dt / 7;
        if (w.timer > 0.45) { w.timer = 0; addParticles(s, b.x + rnd(-10, 10), b.y - 6, 4, '#ffe0a0', 50, 200, 2, 0.35); sfx('build'); }
        if (b.progress >= 1) {
          b.progress = 1; b.reserved = 0; s.stats.built++;
          addParticles(s, b.x, b.y - 10, 24, '#fff2c0', 120, 220, 3, 0.8);
          float(s, b.x, b.y - 40, `${BUILDING_INFO[b.type].name} complete!`, '#fff2c0');
          if (b.type === 'tower') { log(s, 'A watchtower rises. The frontier widens.'); }
          sfx('conquer');
        }
        break;
      }
    }
  }

  // -------- frontline --------
  updateFront(s, dt, R);

  // -------- particles / drops / floaters --------
  for (const p of s.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.98; }
  s.particles = s.particles.filter(p => p.life > 0);
  for (const d of s.drops) {
    d.life -= dt;
    if (d.tx !== undefined && d.ty !== undefined) {
      d.x += (d.tx - d.x) * dt * 4; d.y += (d.ty - d.y) * dt * 4;
      if (dist(d.x, d.y, d.tx, d.ty) < 8) { d.life = 0; s.res.gold += 1; sfx('coin'); }
    } else {
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.vz -= 500 * dt;
      if (d.z < 0) { d.z = 0; d.vz *= -0.4; d.vx *= 0.6; d.vy *= 0.6; }
      if (d.life < 0.9) { d.tx = 1100; d.ty = 40; }
    }
  }
  s.drops = s.drops.filter(d => d.life > 0);
  for (const f of s.floaters) { f.life -= dt; f.y -= 28 * dt; }
  s.floaters = s.floaters.filter(f => f.life > 0);
  if (s.particles.length > 600) s.particles.splice(0, s.particles.length - 600);
}

function updateFront(s: GameState, dt: number, R: Record<string, boolean>) {
  const f = s.front;
  const gateY = WORLD_H - 60, fortY = 110;
  const laneCx = LANE_X + LANE_W / 2;
  f.banner = Math.max(0, f.banner - dt); f.shake = Math.max(0, f.shake - dt * 3);

  // move base-side allies to the gate
  for (const u of s.units) {
    if (u.side === 'ally' && u.x < LANE_X) {
      const tx = BASE_W - 10, ty = 640;
      const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
      const sp = 70 * (R.roads ? 1.3 : 1);
      if (d < 6) { u.x = laneCx + rnd(-90, 90); u.y = gateY - 10; }
      else { u.x += dx / d * sp * dt; u.y += dy / d * sp * dt; }
      u.anim += dt * 10;
    }
  }
  // enemy spawns
  f.spawnTimer -= dt;
  if (f.spawnTimer <= 0) {
    f.spawnTimer = Math.max(1.6, 5 - f.sector * 0.25);
    const n = 1 + Math.floor(f.sector / 3);
    const pw = 1 + (f.sector - 1) * 0.32;
    for (let i = 0; i < n; i++) {
      const elite = Math.random() < 0.15 * Math.min(1, f.sector / 5);
      s.units.push({ id: s.nextId++, x: laneCx + rnd(-100, 100), y: fortY + 30 + rnd(0, 20), hp: 26 * pw * (elite ? 2.5 : 1), maxHp: 26 * pw * (elite ? 2.5 : 1), atk: 4 * pw * (elite ? 1.6 : 1), side: 'enemy', cd: rnd(0, 1), kind: elite ? 1 : 0, anim: rnd(0, 6), lunge: 0 });
    }
  }
  const allies = s.units.filter(u => u.side === 'ally' && u.x >= LANE_X);
  const enemies = s.units.filter(u => u.side === 'enemy');
  const RANGE = 22;
  for (const u of s.units) {
    if (u.x < LANE_X) continue;
    u.anim += dt * 8; u.cd -= dt; u.lunge *= 0.85;
    const foes = u.side === 'ally' ? enemies : allies;
    let target: Unit | null = null, bd = 1e9;
    for (const e of foes) { const d = dist(u.x, u.y, e.x, e.y); if (d < bd) { bd = d; target = e; } }
    const dirY = u.side === 'ally' ? -1 : 1;
    const sp = u.side === 'ally' ? 42 : 34;
    if (target && bd < RANGE + 6) {
      if (u.cd <= 0) {
        u.cd = 1; target.hp -= u.atk; u.lunge = 1;
        addParticles(s, target.x, target.y - 8, 5, u.side === 'ally' ? '#ffe28a' : '#ff6b6b', 60, 150, 2, 0.3);
        sfx('hit');
      }
    } else if (target && bd < 160) {
      const dx = target.x - u.x, dy = target.y - u.y;
      u.x += dx / bd * sp * dt; u.y += dy / bd * sp * dt;
    } else {
      // march
      if (u.side === 'ally') {
        if (u.y > fortY + 60) u.y += dirY * sp * dt;
        else if (u.cd <= 0) { u.cd = 1; f.fortressHp -= u.atk; u.lunge = 1; f.shake = 1; addParticles(s, u.x, u.y - 20, 6, '#ccc', 60, 200, 2, 0.4); sfx('hit'); }
      } else {
        if (u.y < gateY - 30) u.y += dirY * sp * dt;
        else if (u.cd <= 0) { u.cd = 1; f.gateHp -= u.atk; u.lunge = 1; addParticles(s, u.x, u.y + 14, 6, '#ff9d6b', 60, 200, 2, 0.4); sfx('hit'); }
      }
      u.x += (laneCx + Math.sin(u.id * 7.3) * 90 - u.x) * dt * 0.5;
    }
    // separation
    for (const o of s.units) {
      if (o === u || o.x < LANE_X) continue;
      const d = dist(u.x, u.y, o.x, o.y);
      if (d < 16 && d > 0.01) { const px = (u.x - o.x) / d, py = (u.y - o.y) / d; u.x += px * (16 - d) * 0.5; u.y += py * (16 - d) * 0.5; }
    }
    u.x = Math.max(LANE_X + 16, Math.min(LANE_X + LANE_W - 16, u.x));
  }
  // deaths
  for (const u of s.units) {
    if (u.hp <= 0) {
      addParticles(s, u.x, u.y - 8, 14, u.side === 'ally' ? '#c93a3a' : '#5b2a6b', 90, 250, 3, 0.7);
      if (u.side === 'enemy') {
        s.stats.kills++;
        const coins = u.kind === 1 ? 4 : 1 + (Math.random() < 0.25 ? 1 : 0);
        for (let i = 0; i < coins; i++) s.drops.push({ x: u.x, y: u.y, z: 10, vz: rnd(150, 260), vx: rnd(-60, 60), vy: rnd(-60, 60), type: 'gold', life: rnd(1.2, 1.8) });
        sfx('die');
      } else { float(s, u.x, u.y - 20, 'fallen', '#ff9090'); }
    }
  }
  s.units = s.units.filter(u => u.hp > 0);
  // gate breach
  if (f.gateHp <= 0) {
    f.gateHp = f.gateMax; f.shake = 1;
    const loss = (k: ResType) => { const l = Math.floor(s.res[k] * 0.25); s.res[k] -= l; return l; };
    const lw = loss('wood'), lf = loss('food');
    s.units = s.units.filter(u => u.side !== 'enemy');
    log(s, `Raiders breached the gate! Lost ${lw} wood, ${lf} food.`);
    f.bannerText = 'GATE BREACHED'; f.banner = 3;
  }
  // conquest
  if (f.fortressHp <= 0) {
    f.conquered++; f.sector++;
    const reward = 10 + f.conquered * 8;
    s.res.gold += reward; s.territory += 30; s.prodMult = 1 + f.conquered * 0.05;
    f.fortressMax = Math.floor(220 * Math.pow(1.35, f.sector - 1)); f.fortressHp = f.fortressMax;
    f.gateMax += 20; f.gateHp = f.gateMax;
    s.units = s.units.filter(u => u.side !== 'enemy');
    for (const u of s.units) if (u.x >= LANE_X) { u.y = gateY - 40 - rnd(0, 40); u.hp = u.maxHp; }
    addParticles(s, laneCx, fortY, 60, '#ffd54a', 200, 120, 4, 1.4);
    f.bannerText = `SECTOR ${f.conquered} CONQUERED`; f.banner = 3.5;
    log(s, `Sector ${f.conquered} conquered! +${reward} gold, border +30, production +5%.`);
    sfx('conquer');
  }
}
