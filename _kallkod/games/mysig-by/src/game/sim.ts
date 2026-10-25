import {
  BUILDINGS, GOALS, HAULER_INFO, RES, RES_INFO, TECHS, CONV_COST, ROAD_COST, PORTER_COST, SOLDIER_COST, levelDef, stageDef, storeOf,
  type Building, type BuildingKind, type Conveyor, type ConvItem, type GameState, type Hauler, type HaulerKind, type Particle, type Pt, type ResId, type Stock, type Walker,
} from './data';
import { Grid, approachTiles, chunkOwned, findPath, generateNature, mulberry32, nearestFree } from './world';
import { sfx } from './audio';

export const SAVE_KEY = 'living-logistics-v1';
const CONV_GAP = 0.42;
const CONV_BASE_SPEED = 1.0;

export type Tool = 'select' | 'build' | 'road' | 'conveyor';
export type Sheet = 'none' | 'build' | 'front' | 'menu' | 'expand';
export type Selection = { type: 'building' | 'conveyor'; id: number } | null;
export interface UIState {
  tool: Tool; buildKind: BuildingKind; selected: Selection;
  hover: Pt | null; hoverWorld: Pt | null; dragPath: Pt[] | null; dragRoad: Pt[] | null;
  ghost: Pt | null; touch: boolean; cam: { x: number; y: number; zoom: number };
  sheet: Sheet; subview: string; expandTarget: { cx: number; cy: number } | null; moveId: number | null; extendId: number | null;
  helpOpen: boolean; lastError: string; youFlagUntil: number;
  focus: { x: number; y: number; camX?: number; camY?: number } | null; // camera nudge so a selection stays visible above its sheet
}

export const stockTotal = (s: Stock) => { let t = 0; for (const k in s) t += s[k as ResId] || 0; return t; };
export const addStock = (s: Stock, r: ResId, n: number) => { s[r] = (s[r] || 0) + n; if (s[r]! <= 0) delete s[r]; };
export const fmtCost = (c: Stock) => RES.filter((r) => c[r]).map((r) => `${c[r]}${RES_INFO[r].emoji}`).join(' ');

export class Game {
  s: GameState;
  grid: Grid;
  ui: UIState;
  listeners = new Set<() => void>();
  uiAcc = 0; saveAcc = 0; foodAcc = 0;
  particles: Particle[] = [];
  shake = 0;

  constructor() {
    const loaded = this.load();
    this.s = loaded || newGame();
    this.grid = new Grid(this.s.W, this.s.H);
    this.grid.rebuild(this.s);
    const touch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
    this.ui = {
      tool: 'select', buildKind: 'house', selected: null, hover: null, hoverWorld: null, dragPath: null, dragRoad: null,
      ghost: null, touch, cam: { x: 24.5, y: 16, zoom: touch ? 1.0 : 1.15 }, sheet: 'none', subview: '', expandTarget: null, moveId: null, extendId: null,
      helpOpen: !loaded, lastError: '', youFlagUntil: 0, focus: null,
    };
    for (const c of this.s.conveyors) this.linkConveyor(c);
    this.syncHaulers();
  }

  // ---------- persistence ----------
  load(): GameState | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const st = JSON.parse(raw) as GameState;
      if (st.version !== 3) return null;
      return st;
    } catch { return null; }
  }
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch { /* ignore */ } }
  reset() { localStorage.removeItem(SAVE_KEY); this.s = newGame(); this.grid = new Grid(this.s.W, this.s.H); this.grid.rebuild(this.s); this.particles = []; this.ui.selected = null; this.ui.tool = 'select'; this.ui.helpOpen = true; this.syncHaulers(); this.emit(); }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  emit() { for (const l of this.listeners) l(); }

  msg(text: string, kind = 'info') { this.s.messages.push({ text, t: this.s.time, kind }); if (this.s.messages.length > 6) this.s.messages.shift(); }
  err(text: string) { this.ui.lastError = text; this.msg(text, 'error'); sfx('error'); }

  // ---------- store helpers ----------
  storeCap(b: Building) { return levelDef(b).storeCap || 0; }
  storeSpace(b: Building) { return this.storeCap(b) - stockTotal(b.store); }
  totalCap() { let t = 0; for (const b of this.s.buildings) t += this.storeCap(b); return t; }
  totalStored() { let t = 0; for (const b of this.s.buildings) t += stockTotal(b.store); return t; }
  have(r: ResId) { return storeOf(this.s, r); }
  canAfford(c: Stock) { for (const r of RES) if ((c[r] || 0) > this.have(r)) return false; return true; }
  spend(c: Stock) { for (const r of RES) if (c[r]) this.takeStore(r, c[r]!); }
  takeStore(r: ResId, amt: number): number {
    let left = amt;
    for (const b of this.s.buildings) { if (!b.store[r] || left <= 0) continue; const t = Math.min(b.store[r]!, left); addStock(b.store, r, -t); left -= t; }
    return amt - left;
  }
  addStore(r: ResId, amt: number, nx?: number, ny?: number): number {
    const whs = this.s.buildings.filter((b) => this.storeCap(b) > 0);
    if (nx !== undefined) whs.sort((a, b) => Math.hypot(a.x - nx, a.y - ny!) - Math.hypot(b.x - nx, b.y - ny!));
    let left = amt;
    for (const b of whs) { const sp = this.storeSpace(b); if (sp <= 0 || left <= 0) continue; const t = Math.min(sp, left); addStock(b.store, r, t); left -= t; }
    return amt - left;
  }
  nearestStoreWithSpace(x: number, y: number, min = 1): Building | null {
    let best: Building | null = null, bd = 1e9;
    for (const b of this.s.buildings) { if (this.storeCap(b) <= 0 || this.storeSpace(b) < min) continue; const d = Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  accepts(b: Building, r: ResId): boolean {
    const def = BUILDINGS[b.kind]; const d = levelDef(b);
    if (d.storeCap) return this.storeSpace(b) >= 1;
    if (def.accepts && def.accepts.includes(r)) return (b.input[r] || 0) < (d.inputCap || 0);
    return false;
  }
  deliverTo(b: Building, r: ResId, n: number): number {
    const d = levelDef(b);
    if (d.storeCap) { const t = Math.min(n, this.storeSpace(b)); if (t > 0) addStock(b.store, r, t); return t; }
    const cap = d.inputCap || 0; const t = Math.min(n, cap - (b.input[r] || 0)); if (t > 0) addStock(b.input, r, t); return Math.max(0, t);
  }

  // ---------- jobs / population ----------
  popCap() { let t = 0; for (const b of this.s.buildings) t += levelDef(b).popCap || 0; return t; }
  weaponTier() { let t = 0; for (const b of this.s.buildings) { const w = levelDef(b).weaponTier; if (w !== undefined && b.kind === 'smithy') t = Math.max(t, w + 1); } return t; }
  vetBonus() { let t = 0; for (const b of this.s.buildings) t = Math.max(t, levelDef(b).vet || 0); return t; }
  founderCapacity() { let c = 2; for (const b of this.s.buildings) if (b.kind === 'storehouse') c = levelDef(b).founderCarry || 2; return c + 2 * (this.s.tech.frames || 0); }
  unemployed = 0; postsUnstaffed = 0; jobsTotal = 0;
  allocateJobs() {
    const s = this.s;
    const porters = s.haulers.filter((h) => h.kind === 'porter').length;
    let avail = Math.max(0, s.population - porters);
    this.jobsTotal = porters;
    for (const b of s.buildings) { const need = levelDef(b).workers; b.workers = Math.min(need, avail); avail -= b.workers; this.jobsTotal += need; }
    this.postsUnstaffed = 0;
    for (const c of s.conveyors) { c.staffed = Math.min(c.tiles.length, avail); avail -= c.staffed; this.postsUnstaffed += c.tiles.length - c.staffed; this.jobsTotal += c.tiles.length; }
    this.unemployed = avail;
  }

  // ---------- main tick ----------
  tick(rawDt: number) {
    const s = this.s;
    if (!s.paused) {
      const dt = Math.min(rawDt, 0.1) * s.speed;
      const steps = Math.max(1, Math.ceil(dt / (1 / 30)));
      const sub = dt / steps;
      for (let i = 0; i < steps; i++) this.step(sub);
    }
    this.updateParticles(Math.min(rawDt, 0.1) * (s.paused ? 0 : s.speed));
    this.shake = Math.max(0, this.shake - rawDt * 3);
    this.uiAcc += rawDt; if (this.uiAcc > 0.12) { this.uiAcc = 0; this.emit(); }
    this.saveAcc += rawDt; if (this.saveAcc > 8) { this.saveAcc = 0; this.save(); }
  }

  rateBuf: number[] = []; rateAcc = 0;
  deliveryRate() { const n = this.rateBuf.length; if (n < 2) return 0; return Math.round(((this.rateBuf[n - 1] - this.rateBuf[0]) / (n - 1)) * 60); }
  step(dt: number) {
    const s = this.s;
    s.time += dt;
    this.rateAcc += dt; if (this.rateAcc >= 1) { this.rateAcc -= 1; this.rateBuf.push(s.stats.delivered); if (this.rateBuf.length > 61) this.rateBuf.shift(); }
    this.allocateJobs();
    this.updatePopulation(dt);
    for (const b of s.buildings) this.updateBuilding(b, dt);
    for (const c of s.conveyors) this.updateConveyor(c, dt);
    for (const h of s.haulers) this.updateHauler(h, dt);
    this.updateWalkers(dt);
    this.updateFrontline(dt);
    this.updateGoals();
    for (const t of s.trees) if (t.shake > 0) t.shake = Math.max(0, t.shake - dt * 2);
    s.goalFlash = Math.max(0, s.goalFlash - dt);
    this.warnAcc += dt;
    if (this.warnAcc > 45) { this.warnAcc = 0; if (this.totalStored() > this.totalCap() * 0.95) this.msg('Storage almost full — build a Warehouse or upgrade the Storehouse.', 'error'); }
  }
  warnAcc = 30;

  updatePopulation(dt: number) {
    const s = this.s;
    const cap = this.popCap();
    s.growth += dt;
    const interval = s.population < 6 ? 5 : 7;
    if (s.growth > interval) {
      s.growth = 0;
      if (s.population < cap && this.have('food') >= 2) {
        this.takeStore('food', 2); s.population++;
        const homes = s.buildings.filter((b) => b.kind === 'house');
        const h = homes[Math.floor(Math.random() * homes.length)] || s.buildings[0];
        this.text(h.x + h.w / 2, h.y + h.h, '+1 👤', '#ffffff');
      }
    }
    this.foodAcc += dt * s.population * 0.012;
    if (this.foodAcc >= 1) {
      this.foodAcc -= 1;
      if (this.takeStore('food', 1) < 1) s.hunger = Math.min(1, s.hunger + 0.15); else s.hunger = Math.max(0, s.hunger - 0.1);
    }
    if (this.have('food') > 0) s.hunger = Math.max(0, s.hunger - dt * 0.05);
  }

  efficiency() { return 1 - 0.5 * this.s.hunger; }

  updateBuilding(b: Building, dt: number) {
    const d = levelDef(b);
    b.flash = Math.max(0, b.flash - dt);
    if (d.goldPerMin) { b.progress += dt * d.goldPerMin / 60; if (b.progress >= 1) { b.progress -= 1; this.addStore('gold', 1, b.x, b.y); if (Math.random() < 0.3) this.text(b.x + b.w / 2, b.y + b.h, '+1 🪙', '#ffe27a'); } }
    if (d.produces && d.cycle) {
      if (d.workers > 0 && b.workers === 0) { b.starved = false; return; }
      const out = stockTotal(b.output);
      if (out + d.produces.amt > d.outCap) { b.blocked = true; return; }
      b.blocked = false;
      if (d.consumes) { for (const r of RES) if (d.consumes[r] && (b.input[r] || 0) < d.consumes[r]!) { b.starved = true; return; } }
      b.starved = false;
      const eff = (b.workers / d.workers) * this.efficiency();
      b.progress += (dt * eff) / d.cycle;
      if (b.progress >= 1) {
        b.progress -= 1;
        if (d.consumes) for (const r of RES) if (d.consumes[r]) addStock(b.input, r, -d.consumes[r]!);
        addStock(b.output, d.produces.res, d.produces.amt);
        const px = b.x + b.w / 2, py = b.y + b.h - 0.4;
        if (b.kind === 'woodcutter') { sfx('chop', 0.5); this.puff(px, py, 'leaf', 3); }
        else if (b.kind === 'smithy') { sfx('hammer', 0.5); this.puff(px, b.y + 0.5, 'spark', 4); }
        else if (b.kind === 'farm') this.puff(px, py, 'leaf', 2);
        else this.puff(px, py, 'dust', 2);
      }
    }
    if (d.garrison !== undefined && d.trainTime) {
      const canTrain = b.autoTrain && b.garrison < d.garrison && this.unemployed > 0 && this.canAfford(SOLDIER_COST);
      if (canTrain) {
        b.trainProg += dt / d.trainTime;
        if (b.trainProg >= 1) { b.trainProg = 0; this.spend(SOLDIER_COST); this.s.population--; b.garrison++; this.s.stats.soldiers++; this.text(b.x + b.w / 2, b.y + b.h, '+1 ⚔️', '#ffd9d0'); }
      }
    }
  }

  // ---------- conveyors ----------
  convGeom(c: Conveyor, i: number) {
    const n = c.tiles.length;
    const cx = c.tiles[i].x + 0.5, cy = c.tiles[i].y + 0.5;
    let ex: number, ey: number, xx: number, xy: number;
    if (i > 0) { ex = (c.tiles[i - 1].x + 0.5 + cx) / 2; ey = (c.tiles[i - 1].y + 0.5 + cy) / 2; }
    else if (n > 1) { ex = cx - (c.tiles[1].x - c.tiles[0].x) / 2; ey = cy - (c.tiles[1].y - c.tiles[0].y) / 2; }
    else { ex = cx - 0.5; ey = cy; }
    if (i < n - 1) { xx = (c.tiles[i + 1].x + 0.5 + cx) / 2; xy = (c.tiles[i + 1].y + 0.5 + cy) / 2; }
    else if (n > 1) { xx = cx + (c.tiles[n - 1].x - c.tiles[n - 2].x) / 2; xy = cy + (c.tiles[n - 1].y - c.tiles[n - 2].y) / 2; }
    else { xx = cx + 0.5; xy = cy; }
    return { cx, cy, ex, ey, xx, xy };
  }
  convDir(c: Conveyor, i: number): Pt {
    const g = this.convGeom(c, i); const dx = g.xx - g.ex, dy = g.xy - g.ey; const l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l };
  }
  convPoint(c: Conveyor, pos: number, lane: number): { x: number; y: number; dx: number; dy: number } {
    const n = c.tiles.length;
    const i = Math.min(n - 1, Math.max(0, Math.floor(pos)));
    const f = Math.min(1, Math.max(0, pos - i));
    const g = this.convGeom(c, i);
    let x: number, y: number, dx: number, dy: number;
    if (f < 0.5) { const t = f * 2; x = g.ex + (g.cx - g.ex) * t; y = g.ey + (g.cy - g.ey) * t; dx = g.cx - g.ex; dy = g.cy - g.ey; }
    else { const t = (f - 0.5) * 2; x = g.cx + (g.xx - g.cx) * t; y = g.cy + (g.xy - g.cy) * t; dx = g.xx - g.cx; dy = g.xy - g.cy; }
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const side = lane === 0 ? -1 : 1; // lane0 = left of travel, lane1 = right
    const off = 0.21;
    return { x: x + -dy * off * side, y: y + dx * off * side, dx, dy };
  }
  forwardTile(c: Conveyor): Pt {
    const n = c.tiles.length; const last = c.tiles[n - 1];
    if (n === 1) return { x: last.x + 1, y: last.y };
    const prev = c.tiles[n - 2]; return { x: last.x + (last.x - prev.x), y: last.y + (last.y - prev.y) };
  }
  linkConveyor(c: Conveyor) {
    const g = this.grid; const s = this.s;
    const first = c.tiles[0]; const last = c.tiles[c.tiles.length - 1];
    const fwd = this.forwardTile(c);
    let sink: Conveyor['sink'] = null;
    if (g.inb(fwd.x, fwd.y)) {
      const bid = g.occ[g.idx(fwd.x, fwd.y)];
      if (bid >= 0) { const b = this.building(bid); if (b && (levelDef(b).storeCap || BUILDINGS[b.kind].accepts)) sink = { type: 'building', id: bid }; }
      else { const cid = g.conv[g.idx(fwd.x, fwd.y)]; if (cid >= 0 && cid !== c.id) { const oc = this.conveyor(cid); if (oc) sink = { type: 'conv', id: cid, idx: oc.tiles.findIndex((t) => t.x === fwd.x && t.y === fwd.y) }; } }
    }
    if (!sink) { // any adjacent acceptor to last tile
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = last.x + dx, y = last.y + dy; if (!g.inb(x, y)) continue;
        const bid = g.occ[g.idx(x, y)]; if (bid < 0) continue; const b = this.building(bid);
        if (b && (levelDef(b).storeCap || BUILDINGS[b.kind].accepts)) { sink = { type: 'building', id: bid }; break; }
      }
    }
    const src = new Set<number>();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = first.x + dx, y = first.y + dy; if (!g.inb(x, y)) continue;
      const bid = g.occ[g.idx(x, y)]; if (bid >= 0 && !(sink && sink.type === 'building' && sink.id === bid)) src.add(bid);
    }
    c.srcIds = [...src]; c.sink = sink;
    void s;
  }
  relinkAll() { for (const c of this.s.conveyors) this.linkConveyor(c); }
  convSpeed() { return CONV_BASE_SPEED * (1 + 0.3 * (this.s.tech.rhythm || 0)) * (0.6 + 0.4 * this.efficiency()); }

  updateConveyor(c: Conveyor, dt: number) {
    const n = c.tiles.length; const v = this.convSpeed();
    // items are kept sorted by pos descending
    c.items.sort((a, b) => b.pos - a.pos);
    const lead = [1e9, 1e9];
    for (let k = 0; k < c.items.length; k++) {
      const it = c.items[k];
      const tile = Math.min(n - 1, Math.floor(it.pos));
      const staffed = tile < c.staffed;
      let np = it.pos;
      if (staffed) np = Math.min(it.pos + v * dt, lead[it.lane] - CONV_GAP);
      if (np < it.pos) np = it.pos;
      if (np >= n - 0.02) {
        np = n - 0.02;
        if (this.convDeliver(c, it)) { c.items.splice(k, 1); k--; continue; }
      }
      if (Math.floor(np) !== Math.floor(it.pos)) sfx('pass', 0.35); // hand-off between two workers
      it.pos = np; lead[it.lane] = it.pos;
    }
    // input at the start
    if (c.staffed > 0 && c.srcIds.length) {
      for (let lane = 0 as 0 | 1; lane < 2; lane = (lane + 1) as 0 | 1) {
        let minPos = 1e9; for (const it of c.items) if (it.lane === lane) minPos = Math.min(minPos, it.pos);
        if (minPos < CONV_GAP) continue;
        this.convPull(c, lane);
      }
    }
  }
  convPull(c: Conveyor, lane: 0 | 1) {
    const other = c.laneRes[1 - lane];
    const sinkB = c.sink && c.sink.type === 'building' ? this.building(c.sink.id) : null;
    for (const id of c.srcIds) {
      const b = this.building(id); if (!b) continue;
      const fromStore = this.storeCap(b) > 0;
      // candidate resources
      const pool = fromStore ? b.store : b.output;
      const wanted = c.laneRes[lane];
      const tryRes = (r: ResId, lock: boolean): boolean => {
        if ((pool[r] || 0) < 1) return false;
        if (fromStore) { // only pull from storage if sink is a consumer that needs it
          if (!sinkB || levelDef(sinkB).storeCap) return false;
          const acc = BUILDINGS[sinkB.kind].accepts; if (!acc || !acc.includes(r)) return false;
          if ((sinkB.input[r] || 0) + c.items.filter((i) => i.res === r).length >= (levelDef(sinkB).inputCap || 0)) return false;
        } else if (b.reserved >= stockTotal(b.output)) return false;
        addStock(pool, r, -1);
        c.items.push({ res: r, lane, pos: 0 });
        if (lock) c.laneRes[lane] = r;
        sfx('pickup', 0.3);
        return true;
      };
      if (wanted) { if (tryRes(wanted, true)) return; }
      else {
        for (const r of RES) { if (r === other) continue; if (tryRes(r, true)) return; }
        // nothing new available: share the other lane's good without locking this lane
        if (other && tryRes(other, false)) return;
      }
    }
  }
  convDeliver(c: Conveyor, it: ConvItem): boolean {
    const sk = c.sink; if (!sk) return false;
    if (sk.type === 'building') {
      const b = this.building(sk.id); if (!b) return false;
      if (!this.accepts(b, it.res)) return false;
      this.deliverTo(b, it.res, 1);
      c.moved++; this.s.stats.conveyed++; this.s.stats.delivered++;
      sfx('pass', 0.5);
      if (Math.random() < 0.15) this.text(b.x + b.w / 2, b.y + b.h - 0.2, `+${it.res === 'food' ? '🌾' : it.res === 'wood' ? '🪵' : it.res === 'stone' ? '🪨' : it.res === 'iron' ? '⛓️' : '⚔️'}`, '#e8ffe8', 0.6);
      return true;
    }
    const oc = this.conveyor(sk.id); if (!oc || sk.idx < 0) return false;
    let lane: 0 | 1 | -1 = -1;
    if (oc.laneRes[0] === it.res) lane = 0; else if (oc.laneRes[1] === it.res) lane = 1; else if (!oc.laneRes[0]) lane = 0; else if (!oc.laneRes[1]) lane = 1;
    if (lane < 0) return false;
    const ln = lane as 0 | 1;
    const pos = sk.idx + 0.5;
    for (const o of oc.items) if (o.lane === ln && Math.abs(o.pos - pos) < CONV_GAP) return false;
    oc.items.push({ res: it.res, lane: ln, pos }); oc.laneRes[ln] = it.res; c.moved++; this.s.stats.conveyed++;
    return true;
  }

  // ---------- haulers ----------
  building(id: number) { return this.s.buildings.find((b) => b.id === id); }
  conveyor(id: number) { return this.s.conveyors.find((c) => c.id === id); }
  haulerSpeed(h: Hauler) {
    const info = HAULER_INFO[h.kind];
    let sp = info.speed;
    if (h.kind === 'donkey' || h.kind === 'wagon' || h.kind === 'elephant') sp *= 1 + 0.25 * (this.s.tech.harness || 0);
    if (h.onRoad) sp *= h.kind === 'wagon' ? 1.7 : 1.35;
    if (h.kind === 'founder' || h.kind === 'porter') sp *= 0.7 + 0.3 * this.efficiency();
    return sp;
  }
  syncHaulers() {
    const s = this.s;
    // founder
    if (!s.haulers.some((h) => h.kind === 'founder')) { const sh = s.buildings.find((b) => b.kind === 'storehouse')!; s.haulers.push(makeHauler(s.nextId++, 'founder', sh.x + 1.5, sh.y + sh.h + 0.5, sh.id, 2)); }
    // animals from stables
    for (const b of s.buildings) {
      const d = levelDef(b); if (!d.haulers) continue;
      const mine = s.haulers.filter((h) => h.homeId === b.id && h.kind === d.haulers!.kind);
      for (const h of mine) h.capacity = d.haulers.capacity;
      for (let i = mine.length; i < d.haulers.count; i++) s.haulers.push(makeHauler(s.nextId++, d.haulers.kind, b.x + b.w / 2 + (Math.random() - 0.5), b.y + b.h + 0.5, b.id, d.haulers.capacity));
      if (mine.length > d.haulers.count) { const extra = mine.slice(d.haulers.count); s.haulers = s.haulers.filter((h) => !extra.includes(h)); }
    }
    s.haulers = s.haulers.filter((h) => h.kind === 'founder' || h.kind === 'porter' || s.buildings.some((b) => b.id === h.homeId));
    const fc = this.founderCapacity(); const pc = 1 + 2 * (s.tech.frames || 0);
    for (const h of s.haulers) { if (h.kind === 'founder') h.capacity = fc; if (h.kind === 'porter') h.capacity = pc; }
  }
  updateHauler(h: Hauler, dt: number) {
    const s = this.s; const info = HAULER_INFO[h.kind];
    h.moving = false;
    switch (h.state) {
      case 'idle': {
        h.timer -= dt;
        if (h.timer > 0) return;
        if (h.kind === 'founder') { if (h.queue.length) { const id = h.queue.shift()!; const b = this.building(id); if (b && stockTotal(b.output) > 0) { this.assignPile(h, b, Math.min(h.capacity, stockTotal(b.output))); return; } } h.timer = 0.3; return; }
        if (!this.findJob(h)) { h.timer = 1 + Math.random() * 1.5; if (h.kind !== 'porter' && Math.random() < 0.3) this.goHome(h); }
        return;
      }
      case 'wander': case 'toPickup': case 'toDrop': {
        if (this.followPath(h, dt)) {
          if (h.state === 'wander') { h.state = 'idle'; h.timer = 0.5; return; }
          if (h.state === 'toPickup') {
            const b = this.building(h.pickupId);
            if (!b) { this.cancelJob(h); return; }
            h.state = 'loading'; h.timer = 0; h.loadRate = 0;
            const src = h.jobKind === 'supply' ? (h.want ? this.have(h.want) : 0) : stockTotal(b.output);
            h.wantAmt = Math.min(h.wantAmt, src);
            if (h.wantAmt <= 0) { this.cancelJob(h); return; }
            if (h.kind === 'elephant') sfx('elephant', 0.5);
          } else {
            h.state = 'unloading'; h.timer = 0; h.loadRate = 0;
          }
        }
        return;
      }
      case 'loading': {
        h.timer += dt;
        const lt = info.loadTime * (h.kind === 'founder' || h.kind === 'porter' ? 1 : 0.6 + 0.4 * Math.min(1, h.wantAmt / h.capacity));
        const target = Math.min(h.wantAmt, Math.floor((h.timer / lt) * h.wantAmt));
        const b = this.building(h.pickupId);
        if (!b) { this.cancelJob(h); return; }
        while (h.load < target) {
          let r: ResId | null = null;
          if (h.jobKind === 'supply') { r = h.want; if (!r || this.takeStore(r, 1) < 1) break; }
          else { for (const k of RES) if ((b.output[k] || 0) >= 1) { r = k; break; } if (!r) break; addStock(b.output, r, -1); b.reserved = Math.max(0, b.reserved - 1); }
          addStock(h.cargo, r!, 1); h.load++;
          if (h.load === 1 || h.load % Math.max(1, Math.floor(h.wantAmt / 6)) === 0) sfx('pickup', 0.4);
        }
        if (h.timer >= lt || h.load >= h.wantAmt) {
          if (h.jobKind === 'pile') b.reserved = Math.max(0, b.reserved - Math.max(0, h.reservedAmt - h.load));
          h.reservedAmt = 0;
          if (h.load === 0) { this.cancelJob(h); return; }
          if (h.kind === 'founder') { s.stats.hand += h.load; }
          this.goDrop(h);
        }
        return;
      }
      case 'unloading': {
        h.timer += dt;
        const b = this.building(h.dropId);
        if (!b) { this.goDrop(h); return; }
        if (!h.loadRate) h.loadRate = h.load;
        const total = h.loadRate; const lt = info.loadTime * (h.kind === 'founder' || h.kind === 'porter' ? 0.8 : 0.5 + 0.5 * Math.min(1, total / h.capacity));
        const shouldRemain = Math.max(0, h.loadRate - Math.floor((h.timer / lt) * h.loadRate));
        let stuck = false;
        while (h.load > shouldRemain) {
          let r: ResId | null = null; for (const k of RES) if ((h.cargo[k] || 0) >= 1) { r = k; break; }
          if (!r) break;
          if (h.jobKind === 'supply') { if (this.deliverTo(b, r, 1) < 1) { stuck = true; break; } addStock(b.inbound, r, -1); }
          else if (this.deliverTo(b, r, 1) < 1) { stuck = true; break; }
          addStock(h.cargo, r, -1); h.load--; s.stats.delivered++;
          if (h.kind !== 'founder' && h.kind !== 'porter') s.stats.animalHauled++;
          if (h.load === 0 || h.load % Math.max(1, Math.floor(total / 5)) === 0) { sfx('deliver', 0.5); }
        }
        if (stuck) { // storage full here -> find another
          if (h.jobKind === 'supply') { if (h.want) addStock(b.inbound, h.want, -h.load); h.jobKind = 'pile'; }
          const alt = this.nearestStoreWithSpace(h.x, h.y, 1);
          if (alt && alt.id !== b.id) { h.dropId = alt.id; this.pathTo(h, alt); h.state = 'toDrop'; }
          else { h.timer = 0; h.loadRate = 0; if (Math.random() < 0.02) this.text(h.x, h.y, 'storage full!', '#ffb4a2'); }
          return;
        }
        if (h.load <= 0) {
          h.cargo = {}; h.load = 0; h.jobKind = 'none'; h.state = 'idle'; h.timer = h.kind === 'founder' ? 0.1 : 0.4;
          const txt = total >= 100 ? `+${total} 📦📦📦` : total >= 10 ? `+${total} 📦📦` : `+${total} 📦`;
          this.text(b.x + b.w / 2, b.y + b.h - 0.1, txt, total >= 100 ? '#ffe89a' : '#ffffff', total >= 100 ? 1.4 : 1);
          if (total >= 100) this.shake = Math.max(this.shake, 0.4);
        }
        return;
      }
    }
  }
  cancelJob(h: Hauler) {
    if (h.jobKind === 'pile') { const b = this.building(h.pickupId); if (b) b.reserved = Math.max(0, b.reserved - h.reservedAmt); }
    if (h.jobKind === 'supply' && h.want) { const b = this.building(h.dropId); if (b) addStock(b.inbound, h.want, -Math.max(0, h.wantAmt - h.load)); }
    h.reservedAmt = 0; h.jobKind = h.load > 0 ? h.jobKind : 'none';
    if (h.load > 0) { this.goDrop(h); return; }
    h.state = 'idle'; h.timer = 0.5; h.path = []; h.wantAmt = 0; h.want = null;
  }
  goHome(h: Hauler) { const b = this.building(h.homeId); if (!b) return; if (Math.hypot(h.x - (b.x + b.w / 2), h.y - (b.y + b.h + 0.5)) < 2) return; if (this.pathTo(h, b)) h.state = 'wander'; }
  goDrop(h: Hauler) {
    let target: Building | null = null;
    if (h.jobKind === 'supply') target = this.building(h.dropId) || null;
    if (!target) target = this.nearestStoreWithSpace(h.x, h.y, Math.min(h.load, 5)) || this.nearestStoreWithSpace(h.x, h.y, 1);
    if (!target) { h.state = 'idle'; h.timer = 2; if (Math.random() < 0.3) this.text(h.x, h.y, 'no storage!', '#ffb4a2'); return; }
    h.dropId = target.id;
    if (this.pathTo(h, target)) h.state = 'toDrop'; else { h.state = 'idle'; h.timer = 2; }
  }
  assignPile(h: Hauler, b: Building, amt: number) {
    h.jobKind = 'pile'; h.pickupId = b.id; h.wantAmt = amt; h.reservedAmt = amt; b.reserved += amt; h.want = null;
    if (this.pathTo(h, b)) h.state = 'toPickup'; else { b.reserved -= amt; h.reservedAmt = 0; h.jobKind = 'none'; h.state = 'idle'; h.timer = 2; }
  }
  findJob(h: Hauler): boolean {
    const s = this.s; const info = HAULER_INFO[h.kind];
    let best: { score: number; b: Building; amt: number; kind: 'pile' | 'supply'; res: ResId | null; from: Building | null } | null = null;
    const anySpace = this.totalCap() - this.totalStored() > 0;
    if (anySpace) for (const b of s.buildings) {
      const avail = stockTotal(b.output) - b.reserved;
      if (avail < Math.min(info.minPile, levelDef(b).outCap * 0.5) || avail < 1) continue;
      const amt = Math.min(h.capacity, avail);
      const dist = Math.hypot(b.x + b.w / 2 - h.x, b.y + b.h - h.y);
      const fullness = stockTotal(b.output) / Math.max(1, levelDef(b).outCap);
      const dw = h.kind === 'elephant' ? 0.25 : h.kind === 'wagon' ? 0.4 : h.kind === 'donkey' ? 0.7 : 1; // big haulers don't mind distance
      const score = (amt * (0.5 + fullness)) / (dist * dw + 6);
      if (!best || score > best.score) best = { score, b, amt, kind: 'pile', res: null, from: null };
    }
    if (h.kind === 'porter' || h.kind === 'donkey' || h.kind === 'wagon') for (const b of s.buildings) {
      const acc = BUILDINGS[b.kind].accepts; const d = levelDef(b); if (!acc || d.storeCap || !d.inputCap) continue;
      if (d.workers > 0 && b.workers === 0) continue;
      for (const r of acc) {
        const deficit = d.inputCap - (b.input[r] || 0) - (b.inbound[r] || 0);
        if (deficit < 1) continue;
        const have = this.have(r); if (have < 1) continue;
        const amt = Math.min(h.capacity, deficit, have);
        if (amt < Math.min(info.minPile, d.inputCap * 0.5)) continue;
        const from = this.nearestStoreWith(r, h.x, h.y); if (!from) continue;
        const dist = Math.hypot(from.x - h.x, from.y - h.y) + Math.hypot(b.x - from.x, b.y - from.y);
        const urgency = (b.input[r] || 0) < (d.consumes?.[r] || 1) ? 2 : 1.1;
        const score = (amt * urgency) / (dist + 6);
        if (!best || score > best.score) best = { score, b, amt, kind: 'supply', res: r, from };
      }
    }
    if (!best) return false;
    if (best.kind === 'pile') { this.assignPile(h, best.b, best.amt); return h.state === 'toPickup'; }
    h.jobKind = 'supply'; h.want = best.res; h.wantAmt = best.amt; h.dropId = best.b.id; h.pickupId = best.from!.id; h.supplyFrom = best.from!.id;
    addStock(best.b.inbound, best.res!, best.amt);
    if (this.pathTo(h, best.from!)) { h.state = 'toPickup'; return true; }
    addStock(best.b.inbound, best.res!, -best.amt); h.jobKind = 'none'; return false;
  }
  nearestStoreWith(r: ResId, x: number, y: number): Building | null {
    let best: Building | null = null, bd = 1e9;
    for (const b of this.s.buildings) { if ((b.store[r] || 0) < 1) continue; const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  pathTo(h: Hauler, b: Building): boolean {
    const goals = approachTiles(this.grid, b);
    const sx = Math.max(0, Math.min(this.s.W - 1, Math.floor(h.x))), sy = Math.max(0, Math.min(this.s.H - 1, Math.floor(h.y)));
    const big = h.kind === 'wagon' || h.kind === 'elephant';
    const p = findPath(this.s, this.grid, sx, sy, goals, big);
    if (!p) { return false; }
    h.path = p; h.pi = 0; h.lateral = (Math.random() - 0.5) * (big ? 0.15 : 0.45);
    return true;
  }
  /** returns true when arrived */
  followPath(h: Hauler, dt: number): boolean {
    if (h.pi >= h.path.length) return true;
    const info = HAULER_INFO[h.kind];
    const t = h.path[h.pi];
    const tx = t.x + 0.5 + h.lateral, ty = t.y + 0.5 + h.lateral * 0.6;
    const dx = tx - h.x, dy = ty - h.y; const d = Math.hypot(dx, dy);
    const ti = Math.floor(h.y) * this.s.W + Math.floor(h.x); h.onRoad = this.s.terrain[ti] === 1;
    const sp = this.haulerSpeed(h) * (h.load > 0 && (h.kind === 'founder' || h.kind === 'porter') ? 0.9 : 1);
    const step = sp * dt;
    const want = Math.atan2(dy, dx);
    let da = want - h.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    const maxTurn = info.turn * dt;
    h.angle += Math.max(-maxTurn, Math.min(maxTurn, da));
    let ha = h.angle - h.headAngle; while (ha > Math.PI) ha -= Math.PI * 2; while (ha < -Math.PI) ha += Math.PI * 2;
    h.headAngle += ha * Math.min(1, dt * 6);
    const slow = Math.abs(da) > 1 && (h.kind === 'wagon' || h.kind === 'elephant') ? 0.5 : 1;
    if (d <= step * slow) { h.x = tx; h.y = ty; h.pi++; }
    else { h.x += (dx / d) * step * slow; h.y += (dy / d) * step * slow; }
    h.moving = true; h.dist += step * slow;
    h.phase += step * slow * (h.kind === 'elephant' ? 3.2 : h.kind === 'wagon' ? 4 : h.kind === 'donkey' ? 7 : 9);
    if ((h.kind === 'wagon' || h.kind === 'elephant') && Math.random() < dt * 4) this.puff(h.x, h.y + 0.1, 'dust', 1);
    return h.pi >= h.path.length;
  }

  // ---------- idle walkers, soldiers, loot ----------
  updateWalkers(dt: number) {
    const s = this.s;
    const idle = s.walkers.filter((w) => w.kind === 'idle');
    const target = Math.min(18, this.unemployed);
    if (idle.length < target && Math.random() < dt * 2) {
      const homes = s.buildings.filter((b) => b.kind === 'house' || b.kind === 'storehouse');
      const h = homes[Math.floor(Math.random() * homes.length)];
      if (h) { const p = nearestFree(this.grid, h.x + Math.floor(h.w / 2), h.y + h.h); if (p) s.walkers.push({ x: p.x + 0.5, y: p.y + 0.5, angle: Math.random() * 6.28, timer: 1, phase: 0, kind: 'idle', path: [], pi: 0, tone: Math.floor(Math.random() * 5) }); }
    } else if (idle.length > target + 1) { s.walkers.splice(s.walkers.indexOf(idle[0]), 1); }
    for (let i = s.walkers.length - 1; i >= 0; i--) {
      const w = s.walkers[i];
      if (w.pi < w.path.length) {
        const t = w.path[w.pi]; const tx = t.x + 0.5, ty = t.y + 0.5; const dx = tx - w.x, dy = ty - w.y; const d = Math.hypot(dx, dy);
        const sp = w.kind === 'lootcart' ? 1.9 : w.kind === 'idle' ? 1.1 : 2;
        const step = sp * dt; const want = Math.atan2(dy, dx); let da = want - w.angle; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; w.angle += Math.max(-8 * dt, Math.min(8 * dt, da));
        if (d <= step) { w.x = tx; w.y = ty; w.pi++; } else { w.x += (dx / d) * step; w.y += (dy / d) * step; }
        w.phase += step * (w.kind === 'lootcart' ? 4 : 9);
        if (w.kind === 'lootcart' && Math.random() < dt * 3) this.puff(w.x, w.y, 'dust', 1);
      } else {
        if (w.kind === 'soldier') { s.walkers.splice(i, 1); continue; }
        if (w.kind === 'returning') { s.walkers.splice(i, 1); continue; }
        if (w.kind === 'lootcart') {
          if (w.payload) { let lost = 0; for (const r of RES) if (w.payload[r]) { const added = this.addStore(r, w.payload[r]!, w.x, w.y); lost += w.payload[r]! - added; } this.msg(lost > 0 ? `Loot delivered — ${lost} goods lost (storage full!)` : 'Loot delivered to the Storehouse!', 'good'); sfx('coin'); this.puff(w.x, w.y, 'star', 12); }
          s.walkers.splice(i, 1); continue;
        }
        w.timer -= dt;
        if (w.timer <= 0) {
          w.timer = 1 + Math.random() * 3;
          const gx = Math.floor(w.x) + Math.floor(Math.random() * 9) - 4, gy = Math.floor(w.y) + Math.floor(Math.random() * 7) - 3;
          if (this.grid.inb(gx, gy) && !this.grid.blocked(gx, gy) && chunkOwned(s, gx, gy)) { const p = findPath(s, this.grid, Math.floor(w.x), Math.floor(w.y), [{ x: gx, y: gy }], false); if (p && p.length < 14) { w.path = p; w.pi = 0; } }
        }
      }
    }
  }
  edgeTile(nearY: number): Pt | null {
    const s = this.s;
    for (let d = 0; d < s.H; d++) for (const y of [nearY + d, nearY - d]) { if (y < 0 || y >= s.H) continue; if (!this.grid.blocked(s.W - 1, y)) return { x: s.W - 1, y }; }
    return null;
  }
  spawnMarch(from: Building, count: number, kind: 'soldier' | 'returning') {
    const start = approachTiles(this.grid, from)[0]; if (!start) return;
    const edge = this.edgeTile(from.y); if (!edge) return;
    const p = kind === 'soldier' ? findPath(this.s, this.grid, start.x, start.y, [edge], false) : findPath(this.s, this.grid, edge.x, edge.y, [start], false);
    if (!p) return;
    const n = Math.min(count, 14);
    for (let i = 0; i < n; i++) {
      const sx = kind === 'soldier' ? start.x + 0.5 : edge.x + 0.5, sy = kind === 'soldier' ? start.y + 0.5 : edge.y + 0.5;
      const w: Walker = { x: sx - (i % 3) * 0.35, y: sy + Math.floor(i / 3) * 0.3, angle: 0, timer: 0, phase: i, kind, path: p.map((t) => ({ x: t.x, y: t.y })), pi: 0, tone: i % 5 };
      this.s.walkers.push(w);
    }
  }
  spawnLoot(loot: Stock) {
    const sh = this.s.buildings.find((b) => b.kind === 'storehouse')!;
    const edge = this.edgeTile(sh.y); const goals = approachTiles(this.grid, sh);
    const p = edge ? findPath(this.s, this.grid, edge.x, edge.y, goals, true) : null;
    if (!p || !edge) { for (const r of RES) if (loot[r]) this.addStore(r, loot[r]!); this.msg('Loot arrived!', 'good'); return; }
    this.s.walkers.push({ x: edge.x + 0.5, y: edge.y + 0.5, angle: Math.PI, timer: 0, phase: 0, kind: 'lootcart', path: p, pi: 0, payload: loot, tone: 0, count: stockTotal(loot) });
  }

  // ---------- frontline ----------
  garrisonTotal() { let t = 0; for (const b of this.s.buildings) t += b.garrison; return t; }
  updateFrontline(dt: number) {
    const f = this.s.frontline; const st = stageDef(f.stage);
    f.hitFlash = Math.max(0, f.hitFlash - dt); f.enemyFlash = Math.max(0, f.enemyFlash - dt);
    if (f.army > 0 && f.state !== 'idle') {
      this.foodFront = (this.foodFront || 0) + dt * f.army * 0.03;
      if (this.foodFront >= 1) { this.foodFront -= 1; f.fed = this.takeStore('food', 1) >= 1; }
    }
    switch (f.state) {
      case 'marching': f.timer -= dt; if (f.timer <= 0) { f.state = 'fighting'; f.enemyMax = st.str * 10; f.enemyHp = f.enemyMax; f.log.unshift(`⚔️ Battle at ${st.name} begins`); } break;
      case 'fighting': {
        const tier = this.weaponTier(); const ourDps = f.army * (1 + 0.5 * tier) * (f.fed ? 1 : 0.45) * 1.1;
        const enemyDps = st.str * 0.42;
        f.enemyHp -= ourDps * dt; f.hp -= enemyDps * dt;
        if (Math.random() < dt * 3) f.enemyFlash = 0.15; if (Math.random() < dt * 2) f.hitFlash = 0.15;
        const per = 10 * (1 + this.vetBonus());
        const alive = Math.max(0, Math.ceil(f.hp / per));
        if (alive < f.army) { f.losses += f.army - alive; f.army = alive; }
        if (f.enemyHp <= 0) {
          f.enemyHp = 0; f.wins++; f.log.unshift(`🏆 ${st.name} conquered! Loot is on its way.`); if (f.log.length > 8) f.log.pop();
          this.msg(`Victory at ${st.name}! Loot caravan dispatched.`, 'good'); sfx('victory');
          this.spawnLoot({ ...st.loot }); f.stage++; f.state = 'resting'; f.timer = 12; f.hp = f.maxHp = f.army * per;
          this.shake = 0.6;
        } else if (f.hp <= 0 || f.army <= 0) {
          f.army = 0; f.hp = 0; f.state = 'idle'; f.log.unshift(`💀 Defeated at ${st.name}. Train more soldiers.`); if (f.log.length > 8) f.log.pop(); this.msg(`Army defeated at ${st.name}.`, 'error'); sfx('defeat');
        }
        break;
      }
      case 'resting': {
        f.timer -= dt; const per = 10 * (1 + this.vetBonus()); f.maxHp = f.army * per; f.hp = Math.min(f.maxHp, f.hp + f.maxHp * dt * 0.1);
        if (f.timer <= 0) { if (f.auto && f.army > 0) { f.state = 'marching'; f.timer = 3; } else f.state = 'idle'; }
        break;
      }
      case 'returning': f.timer -= dt; if (f.timer <= 0) { const bk = this.s.buildings.find((b) => b.kind === 'barracks'); if (bk) bk.garrison += f.army; else this.s.population += f.army; f.army = 0; f.hp = 0; f.state = 'idle'; } break;
      case 'idle': if (f.army > 0) { const per = 10 * (1 + this.vetBonus()); f.maxHp = f.army * per; f.hp = Math.min(f.maxHp, f.hp + f.maxHp * dt * 0.05); } break;
    }
  }
  foodFront = 0;
  dispatch() {
    const f = this.s.frontline; const g = this.garrisonTotal();
    if (g <= 0) { this.err('No soldiers in the garrison. Train some at the Barracks.'); return; }
    if (f.state === 'fighting' || f.state === 'marching') { // reinforce
      f.army += g; const per = 10 * (1 + this.vetBonus()); f.hp += g * per; f.maxHp = f.army * per;
    } else { f.army += g; const per = 10 * (1 + this.vetBonus()); f.maxHp = f.army * per; f.hp = f.maxHp; f.state = 'marching'; f.timer = 7; }
    const bk = this.s.buildings.find((b) => b.kind === 'barracks' && b.garrison > 0);
    if (bk) this.spawnMarch(bk, g, 'soldier');
    for (const b of this.s.buildings) b.garrison = 0;
    f.log.unshift(`🥁 ${g} soldiers march to ${stageDef(f.stage).name}`); if (f.log.length > 8) f.log.pop();
    sfx('march'); this.msg(`${g} soldiers march out.`, 'info');
  }
  retreat() {
    const f = this.s.frontline; if (f.army <= 0 || f.state === 'returning') return;
    f.state = 'returning'; f.timer = 6; const bk = this.s.buildings.find((b) => b.kind === 'barracks'); if (bk) this.spawnMarch(bk, f.army, 'returning');
    f.log.unshift('↩️ Army returns home'); if (f.log.length > 8) f.log.pop();
  }

  // ---------- goals ----------
  updateGoals() {
    const s = this.s; const g = GOALS[s.goalIdx]; if (!g) return;
    if (g.progress(s) >= g.target) {
      for (const u of g.unlock) s.unlocked[u] = true;
      if (g.reward) for (const r of RES) if (g.reward[r]) this.addStore(r, g.reward[r]!);
      s.goalIdx++; s.goalFlash = 3; sfx('goal');
      const names = g.unlock.map((u) => (BUILDINGS[u as BuildingKind]?.name) || (u === 'porter' ? 'Porters' : u === 'conveyor' ? 'Human Conveyors' : u));
      this.msg(`🎯 Goal done${names.length ? ' · unlocked ' + names.join(', ') : ''}`, 'good');
    }
  }

  // ---------- particles ----------
  puff(x: number, y: number, kind: Particle['kind'], n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = 0.3 + Math.random() * 0.6;
      this.particles.push({ x: x + (Math.random() - 0.5) * 0.4, y: y + (Math.random() - 0.5) * 0.2, z: kind === 'spark' ? 0.8 : 0.1, vx: Math.cos(a) * sp * (kind === 'dust' ? 0.5 : 1), vy: Math.sin(a) * sp * 0.4, vz: kind === 'smoke' ? 0.6 : kind === 'spark' ? 1.5 + Math.random() : kind === 'star' ? 1 + Math.random() * 1.5 : 0.4 + Math.random() * 0.5, life: 0, max: kind === 'dust' ? 0.7 : kind === 'star' ? 1.2 : 0.9, kind, size: 2 + Math.random() * 3 });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }
  text(x: number, y: number, text: string, color: string, size = 1) {
    this.particles.push({ x, y, z: 0.8, vx: 0, vy: 0, vz: 0.5, life: 0, max: 1.4, kind: 'text', text, color, size });
  }
  smoke(x: number, y: number, z: number) { this.particles.push({ x, y, z, vx: 0.15 + Math.random() * 0.1, vy: -0.05, vz: 0.5 + Math.random() * 0.3, life: 0, max: 2.2 + Math.random(), kind: 'smoke', size: 2 + Math.random() * 2 }); }
  updateParticles(dt: number) {
    const ps = this.particles;
    if (ps.length > 900) ps.splice(0, ps.length - 900);
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; p.life += dt; if (p.life >= p.max) { ps.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.kind === 'spark' || p.kind === 'star' || p.kind === 'leaf') { p.vz -= dt * (p.kind === 'leaf' ? 0.8 : 3); if (p.z < 0) { p.z = 0; p.vz *= -0.3; } }
      if (p.kind === 'smoke') { p.vx += dt * 0.05; p.size += dt * 3; }
    }
  }

  // ---------- actions ----------
  unlocked(k: string) { return !!this.s.unlocked[k]; }
  canPlace(kind: BuildingKind, x: number, y: number, opt: { ignoreId?: number; free?: boolean } = {}): { ok: boolean; reason: string } {
    const def = BUILDINGS[kind];
    if (!this.unlocked(kind)) return { ok: false, reason: 'Locked' };
    if (def.unique && opt.ignoreId === undefined && this.s.buildings.some((b) => b.kind === kind)) return { ok: false, reason: 'Only one allowed' };
    for (let ty = y; ty < y + def.h; ty++) for (let tx = x; tx < x + def.w; tx++) {
      if (!this.grid.inb(tx, ty)) return { ok: false, reason: 'Blocked' };
      const i = this.grid.idx(tx, ty);
      const occ = this.grid.occ[i];
      if ((occ >= 0 && occ !== opt.ignoreId) || this.grid.nat[i] > 0 || this.grid.conv[i] >= 0) return { ok: false, reason: 'Blocked' };
      if (!chunkOwned(this.s, tx, ty)) return { ok: false, reason: 'Outside territory' };
    }
    if (opt.free) return { ok: true, reason: '' };
    if (def.placement !== 'any') {
      const want = def.placement === 'trees' ? 1 : def.placement === 'rock' ? 2 : 3; let found = false;
      for (let ty = y - 2; ty < y + def.h + 2 && !found; ty++) for (let tx = x - 2; tx < x + def.w + 2; tx++) { if (this.grid.inb(tx, ty) && this.grid.nat[this.grid.idx(tx, ty)] === want) { found = true; break; } }
      if (!found) return { ok: false, reason: `Needs ${def.placement === 'trees' ? '🌳 trees' : def.placement === 'rock' ? '🪨 rocks' : '🟠 ore'} nearby` };
    }
    const cost = def.variants.base[0].cost;
    if (!this.canAfford(cost)) return { ok: false, reason: `Need ${fmtCost(cost)}` };
    return { ok: true, reason: '' };
  }
  place(kind: BuildingKind, x: number, y: number): boolean {
    const chk = this.canPlace(kind, x, y); if (!chk.ok) { this.err(chk.reason); return false; }
    const def = BUILDINGS[kind]; this.spend(def.variants.base[0].cost);
    const b = makeBuilding(this.s.nextId++, kind, x, y, this.s.time);
    this.s.buildings.push(b); this.grid.rebuild(this.s); this.relinkAll(); this.syncHaulers(); this.s.stats.built++;
    this.puff(x + def.w / 2, y + def.h, 'dust', 8); sfx('place'); this.groundDirty = true;
    if (kind === 'elephantstable') { sfx('elephant'); this.msg('🐘 Elephant: 1000 boxes per trip', 'good'); this.shake = 0.8; }
    if (kind === 'stable') this.msg('🐎 Wagons: 100 boxes, fast on roads', 'good');
    if (kind === 'donkeypen') this.msg('🫏 Donkeys fetch piles of 4+ boxes', 'good');
    if (kind === 'smithy') this.msg('Smithy needs ⛓️ + 🪵 delivered', 'info');
    return true;
  }
  upgradeOptions(b: Building): { variant: string; level: number; def: ReturnType<typeof levelDef> }[] {
    const def = BUILDINGS[b.kind]; const chain = def.variants[b.variant] || def.variants.base; const cur = chain[b.level];
    if (b.level + 1 < chain.length) return [{ variant: b.variant, level: b.level + 1, def: chain[b.level + 1] }];
    if (cur.next) return cur.next.map((v) => ({ variant: v, level: 0, def: def.variants[v][0] }));
    return [];
  }
  upgrade(b: Building, variant: string, level: number) {
    const def = BUILDINGS[b.kind]; const target = def.variants[variant][level];
    if (!this.canAfford(target.cost)) { this.err(`Need ${fmtCost(target.cost)}`); return; }
    this.spend(target.cost); b.variant = variant; b.level = level; b.tier++; b.flash = 1.2;
    this.syncHaulers(); this.puff(b.x + b.w / 2, b.y + b.h, 'star', 10); this.puff(b.x + b.w / 2, b.y + b.h / 2, 'dust', 10); sfx('upgrade');
    this.msg(`${target.name} — ${target.desc}`, 'good');
  }
  demolish(b: Building) {
    if (b.kind === 'storehouse') { this.err('You cannot demolish the Storehouse.'); return; }
    const d = levelDef(b); for (const r of RES) if (d.cost[r]) this.addStore(r, Math.floor(d.cost[r]! * 0.5));
    for (const r of RES) if (b.store[r]) this.addStore(r, b.store[r]!);
    this.s.buildings = this.s.buildings.filter((x) => x !== b);
    for (const h of this.s.haulers) if (h.pickupId === b.id || h.dropId === b.id) this.cancelJob(h);
    this.grid.rebuild(this.s); this.relinkAll(); this.syncHaulers(); this.puff(b.x + b.w / 2, b.y + b.h / 2, 'dust', 12); sfx('place'); this.groundDirty = true;
    if (this.ui.selected?.id === b.id) this.closeAll();
  }
  hirePorter() {
    if (!this.unlocked('porter')) { this.err('Porters are not unlocked yet.'); return; }
    if (this.unemployed < 1) { this.err('No free people to hire. Build houses.'); return; }
    if (!this.canAfford(PORTER_COST)) { this.err(`Need ${fmtCost(PORTER_COST)}`); return; }
    this.spend(PORTER_COST);
    const sh = this.s.buildings.find((b) => b.kind === 'storehouse')!;
    this.s.haulers.push(makeHauler(this.s.nextId++, 'porter', sh.x + Math.random() * sh.w, sh.y + sh.h + 0.5, sh.id, 1 + 2 * (this.s.tech.frames || 0)));
    sfx('upgrade'); this.msg('🧍 Porter hired — hauls piles automatically', 'good');
  }
  firePorter() { const i = this.s.haulers.findIndex((h) => h.kind === 'porter'); if (i >= 0) { const h = this.s.haulers[i]; if (h.load > 0) { for (const r of RES) if (h.cargo[r]) this.addStore(r, h.cargo[r]!); } this.cancelJob(h); this.s.haulers.splice(i, 1); } }
  buyTech(id: string) {
    const t = TECHS.find((x) => x.id === id)!; const n = this.s.tech[id] || 0; if (n >= t.max) return;
    const cost = t.cost(n); if (!this.canAfford(cost)) { this.err(`Need ${fmtCost(cost)}`); return; }
    this.spend(cost); this.s.tech[id] = n + 1; this.syncHaulers(); sfx('unlock'); this.msg(`${t.name} ${n + 1}: ${t.desc}`, 'good');
  }
  chunkCost(): Stock { const n = this.s.stats.expansions; const m = 1.45 ** n; return { wood: Math.round(50 * m), stone: Math.round(30 * m) }; }
  canExpand(cx: number, cy: number): boolean {
    const cols = Math.ceil(this.s.W / this.s.CH), rows = Math.ceil(this.s.H / this.s.CH);
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows || this.s.owned[cy * cols + cx]) return false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && this.s.owned[ny * cols + nx]) return true; }
    return false;
  }
  expand(cx: number, cy: number) {
    if (!this.canExpand(cx, cy)) return;
    const cost = this.chunkCost(); if (!this.canAfford(cost)) { this.err(`Expanding costs ${fmtCost(cost)}`); return; }
    this.spend(cost); const cols = Math.ceil(this.s.W / this.s.CH); this.s.owned[cy * cols + cx] = true; this.s.stats.expansions++;
    sfx('unlock'); this.msg('Territory expanded!', 'good'); this.groundDirty = true;
    this.puff(cx * this.s.CH + this.s.CH / 2, cy * this.s.CH + this.s.CH / 2, 'star', 16);
  }
  groundDirty = true;

  haulByHand(b: Building) {
    const f = this.s.haulers.find((h) => h.kind === 'founder')!;
    if (stockTotal(b.output) <= 0) return;
    if (f.state === 'idle' || f.state === 'wander') { f.queue = [b.id]; f.state = 'idle'; f.timer = 0; }
    else if (!f.queue.includes(b.id)) f.queue.push(b.id);
    this.ui.youFlagUntil = this.s.time + 6;
    sfx('click'); this.text(b.x + b.w / 2, b.y + b.h - 0.2, 'on my way!', '#fff');
  }

  // conveyor building
  conveyorCost(len: number): Stock { return { wood: CONV_COST * len }; }
  buildConveyor(tiles: Pt[]): boolean {
    if (!this.unlocked('conveyor')) { this.err('Human conveyors are not unlocked yet.'); return false; }
    // trim endpoints that lie on buildings (players drag from a yard onto storage), then dedupe & validate
    const onBuilding = (t: Pt) => this.grid.inb(t.x, t.y) && this.grid.occ[this.grid.idx(t.x, t.y)] >= 0;
    const origLen = tiles.length;
    let a = 0; while (a < tiles.length && onBuilding(tiles[a])) a++;
    let z = tiles.length - 1; while (z >= a && onBuilding(tiles[z])) z--;
    tiles = tiles.slice(a, z + 1);
    const seen = new Set<string>(); const clean: Pt[] = [];
    for (const t of tiles) { const k = `${t.x},${t.y}`; if (seen.has(k)) break; if (!this.grid.freeForBuild(t.x, t.y) || !chunkOwned(this.s, t.x, t.y)) break; seen.add(k); clean.push(t); }
    if (clean.length < 1) { if (origLen > 1) this.err('Drag across free ground: start beside a yard, end at storage or a workshop.'); return false; }
    // extension of an existing conveyor?
    let ext: Conveyor | null = null;
    const startTile = tiles[0];
    if (clean.length && !(clean[0].x === startTile.x && clean[0].y === startTile.y)) { /* start was occupied */ }
    for (const c of this.s.conveyors) { const fw = this.forwardTile(c); if (fw.x === clean[0].x && fw.y === clean[0].y) { ext = c; break; } }
    const cost = this.conveyorCost(clean.length);
    if (!this.canAfford(cost)) {
      const afford = Math.floor(this.have('wood') / CONV_COST); if (afford < 1) { this.err(`Need ${fmtCost(cost)} for ${clean.length} posts.`); return false; }
      clean.length = afford; this.msg(`Only enough wood for ${afford} posts.`, 'error');
    }
    this.spend(this.conveyorCost(clean.length));
    if (ext) { ext.tiles.push(...clean); ext.built = this.s.time; } else { this.s.conveyors.push({ id: this.s.nextId++, tiles: clean, items: [], laneRes: [null, null], staffed: 0, moved: 0, srcIds: [], sink: null, built: this.s.time }); }
    this.ui.extendId = null;
    this.grid.rebuild(this.s); this.relinkAll(); sfx('place');
    for (const t of clean) this.puff(t.x + 0.5, t.y + 0.5, 'dust', 2);
    if (this.unemployed < clean.length) this.msg(`${Math.max(0, clean.length - this.unemployed)} posts need workers — build houses`, 'info');
    return true;
  }
  removeConveyor(c: Conveyor) {
    for (const it of c.items) this.addStore(it.res, 1);
    this.addStore('wood', Math.floor(c.tiles.length * CONV_COST * 0.5));
    this.s.conveyors = this.s.conveyors.filter((x) => x !== c); this.grid.rebuild(this.s); this.relinkAll(); sfx('place');
    if (this.ui.selected?.type === 'conveyor' && this.ui.selected.id === c.id) this.closeAll();
  }
  reverseConveyor(c: Conveyor) { for (const it of c.items) this.addStore(it.res, 1); c.items = []; c.tiles.reverse(); c.laneRes = [null, null]; this.relinkAll(); sfx('click'); }
  clearLanes(c: Conveyor) { for (const it of c.items) this.addStore(it.res, 1); c.items = []; c.laneRes = [null, null]; sfx('click'); }
  setLane(c: Conveyor, lane: number, r: ResId | null) { c.items = c.items.filter((i) => i.lane !== lane); c.laneRes[lane] = r; }
  paintRoad(tiles: Pt[]) {
    let n = 0;
    for (const t of tiles) {
      if (!this.grid.inb(t.x, t.y) || !chunkOwned(this.s, t.x, t.y)) continue;
      const i = this.grid.idx(t.x, t.y); if (this.s.terrain[i] === 1 || this.grid.occ[i] >= 0 || this.grid.nat[i] > 0) continue;
      if (this.have('stone') < ROAD_COST) { if (n === 0) this.err('Roads cost 1 stone per tile.'); break; }
      this.takeStore('stone', ROAD_COST); this.s.terrain[i] = 1; n++;
    }
    if (n) { this.groundDirty = true; sfx('place'); }
  }
  removeRoad(t: Pt) { const i = this.grid.idx(t.x, t.y); if (this.s.terrain[i] === 1) { this.s.terrain[i] = 0; this.groundDirty = true; } }
  buildingAt(tx: number, ty: number): Building | undefined { if (!this.grid.inb(tx, ty)) return undefined; const id = this.grid.occ[this.grid.idx(tx, ty)]; return id >= 0 ? this.building(id) : undefined; }
  conveyorAt(tx: number, ty: number): Conveyor | undefined { if (!this.grid.inb(tx, ty)) return undefined; const id = this.grid.conv[this.grid.idx(tx, ty)]; return id >= 0 ? this.conveyor(id) : undefined; }
  pileAt(wx: number, wy: number): Building | undefined {
    for (const b of this.s.buildings) { if (stockTotal(b.output) <= 0) continue; if (wx >= b.x && wx <= b.x + b.w && wy >= b.y + b.h - 0.9 && wy <= b.y + b.h + 0.15) return b; }
    return undefined;
  }

  // ---------- UI flow (one active layer at a time) ----------
  private resetLayer() { const u = this.ui; u.selected = null; u.sheet = 'none'; u.subview = ''; u.dragPath = null; u.dragRoad = null; u.ghost = null; u.moveId = null; u.extendId = null; u.expandTarget = null; u.focus = null; }
  closeAll() { this.resetLayer(); this.ui.tool = 'select'; this.emit(); }
  setTool(t: Tool, kind?: BuildingKind) {
    const u = this.ui; const keepMove = u.moveId; const keepExt = u.extendId; this.resetLayer(); u.tool = t; if (kind) u.buildKind = kind;
    if (t === 'build') { u.moveId = keepMove; if (u.touch) u.ghost = this.centerOrigin(); }
    if (t === 'conveyor') u.extendId = keepExt;
    this.emit();
  }
  select(sel: Selection) {
    this.resetLayer(); this.ui.tool = 'select'; this.ui.selected = sel;
    if (sel?.type === 'building') { const b = this.building(sel.id); if (b) this.ui.focus = { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }
    else if (sel?.type === 'conveyor') { const c = this.conveyor(sel.id); if (c) { const t = c.tiles[Math.floor(c.tiles.length / 2)]; this.ui.focus = { x: t.x + 0.5, y: t.y + 0.5 }; } }
    this.emit();
  }
  openSheet(s: Sheet) { const t = this.ui.expandTarget; this.resetLayer(); this.ui.tool = 'select'; this.ui.sheet = s; if (s === 'expand') this.ui.expandTarget = t; this.emit(); }
  activeKind(): BuildingKind { const mv = this.ui.moveId !== null ? this.building(this.ui.moveId) : null; return mv ? mv.kind : this.ui.buildKind; }
  originFor(tx: number, ty: number): Pt { const d = BUILDINGS[this.activeKind()]; return { x: tx - Math.floor((d.w - 1) / 2), y: ty - Math.floor((d.h - 1) / 2) }; }
  centerOrigin(): Pt { return this.originFor(Math.floor(this.ui.cam.x), Math.floor(this.ui.cam.y)); }
  ghostCheck(p: Pt) { const mv = this.ui.moveId !== null ? this.building(this.ui.moveId) : null; return this.canPlace(this.activeKind(), p.x, p.y, mv ? { ignoreId: mv.id, free: true } : {}); }
  /** Place (or move) the active building at an origin. Returns success. */
  placeAt(x: number, y: number): boolean {
    const u = this.ui;
    if (u.moveId !== null) {
      const b = this.building(u.moveId); if (!b) { this.closeAll(); return false; }
      if (!this.moveBuilding(b, x, y)) return false;
      this.resetLayer(); u.tool = 'select'; u.selected = { type: 'building', id: b.id }; this.emit(); return true;
    }
    const kind = u.buildKind; const ok = this.place(kind, x, y);
    if (ok) {
      if (BUILDINGS[kind].unique) { this.resetLayer(); u.tool = 'select'; }
      else if (u.touch) { const d = BUILDINGS[kind]; const nx = { x: x + d.w, y }; u.ghost = this.canPlace(kind, nx.x, nx.y).ok ? nx : { x, y }; }
    }
    this.emit(); return ok;
  }
  placeGhost() { const g = this.ui.ghost; if (!g) return; const chk = this.ghostCheck(g); if (!chk.ok) { this.err(chk.reason); return; } this.placeAt(g.x, g.y); }
  startMove(b: Building) { this.resetLayer(); this.ui.tool = 'build'; this.ui.buildKind = b.kind; this.ui.moveId = b.id; this.ui.ghost = this.ui.touch ? { x: b.x, y: b.y } : null; this.emit(); }
  moveBuilding(b: Building, x: number, y: number): boolean {
    const chk = this.canPlace(b.kind, x, y, { ignoreId: b.id, free: true }); if (!chk.ok) { this.err(chk.reason); return false; }
    if (b.x === x && b.y === y) return true;
    b.x = x; b.y = y; b.built = this.s.time; this.grid.rebuild(this.s); this.relinkAll(); this.groundDirty = true;
    for (const h of this.s.haulers) {
      const tgt = h.state === 'toPickup' || h.state === 'loading' ? h.pickupId : h.state === 'toDrop' || h.state === 'unloading' ? h.dropId : -1;
      if (tgt !== b.id) continue;
      if (this.pathTo(h, b)) h.state = h.state === 'toPickup' || h.state === 'loading' ? 'toPickup' : 'toDrop'; else this.cancelJob(h);
    }
    this.puff(x + b.w / 2, y + b.h, 'dust', 10); sfx('place'); return true;
  }
  startExtend(c: Conveyor) { this.resetLayer(); this.ui.tool = 'conveyor'; this.ui.extendId = c.id; this.emit(); }
  toggleRoad(t: Pt) { if (!this.grid.inb(t.x, t.y)) return; const i = this.grid.idx(t.x, t.y); if (this.s.terrain[i] === 1) { this.s.terrain[i] = 0; this.groundDirty = true; this.addStore('stone', ROAD_COST); sfx('click'); } else this.paintRoad([t]); }
  /** Tap on the world with the select tool. */
  tapWorld(wx: number, wy: number, tx: number, ty: number) {
    const pile = this.pileAt(wx, wy); if (pile) { this.haulByHand(pile); this.select({ type: 'building', id: pile.id }); return; }
    const b = this.buildingAt(tx, ty); if (b) { this.select({ type: 'building', id: b.id }); return; }
    const c = this.conveyorAt(tx, ty); if (c) { this.select({ type: 'conveyor', id: c.id }); return; }
    const cx = Math.floor(tx / this.s.CH), cy = Math.floor(ty / this.s.CH);
    if (this.grid.inb(tx, ty) && this.canExpand(cx, cy)) { this.ui.expandTarget = { cx, cy }; this.openSheet('expand'); return; }
    this.closeAll();
  }
}

export function makeBuilding(id: number, kind: BuildingKind, x: number, y: number, time: number): Building {
  const def = BUILDINGS[kind];
  return { id, kind, variant: 'base', level: 0, tier: 1, x, y, w: def.w, h: def.h, workers: 0, progress: Math.random() * 0.5, built: time, flash: 0, input: {}, output: {}, store: {}, inbound: {}, reserved: 0, blocked: false, starved: false, garrison: 0, trainProg: 0, autoTrain: true, seed: Math.random() };
}
export function makeHauler(id: number, kind: HaulerKind, x: number, y: number, homeId: number, capacity: number): Hauler {
  return { id, kind, x, y, angle: Math.PI / 2, headAngle: Math.PI / 2, state: 'idle', path: [], pi: 0, timer: Math.random(), phase: Math.random() * 6, moving: false, cargo: {}, load: 0, capacity, speed: HAULER_INFO[kind].speed, pickupId: -1, dropId: -1, homeId, want: null, wantAmt: 0, reservedAmt: 0, dist: 0, lateral: 0, queue: [], jobKind: 'none', supplyFrom: -1, loadRate: 0, onRoad: false };
}

export function newGame(): GameState {
  const W = 48, H = 32, CH = 8;
  const cols = W / CH, rows = H / CH;
  const owned = new Array(cols * rows).fill(false);
  owned[1 * cols + 2] = owned[1 * cols + 3] = owned[2 * cols + 2] = owned[2 * cols + 3] = true;
  const s: GameState = {
    version: 3, time: 0, W, H, CH, owned, terrain: new Array(W * H).fill(0),
    buildings: [], conveyors: [], haulers: [], walkers: [], trees: [], rocks: [], nextId: 1, population: 3, growth: 0, hunger: 0,
    stats: { hand: 0, conveyed: 0, delivered: 0, animalHauled: 0, soldiers: 0, expansions: 0, built: 0 },
    unlocked: { house: true, woodcutter: true, farm: true, road: true, storehouse: true },
    goalIdx: 0, tech: {},
    frontline: { stage: 0, state: 'idle', army: 0, hp: 0, maxHp: 0, enemyHp: 0, enemyMax: 0, timer: 0, wins: 0, auto: true, log: ['Train soldiers at a Barracks, then dispatch them.'], fed: true, losses: 0, hitFlash: 0, enemyFlash: 0, lootPending: null },
    speed: 1, paused: false, muted: false, messages: [], goalFlash: 0,
  };
  const sh = makeBuilding(s.nextId++, 'storehouse', 23, 13, 0); sh.store = { wood: 45, food: 30, stone: 12 };
  const hs = makeBuilding(s.nextId++, 'house', 20, 14, 0);
  s.buildings.push(sh, hs);
  const rng = mulberry32(1337);
  generateNature(s, rng, [{ x: 19, y: 11, w: 9, h: 8 }, { x: 16, y: 8, w: 16, h: 2 }, { x: 22, y: 17, w: 6, h: 3 }]);
  // starter road in front of storehouse
  for (let x = 20; x < 27; x++) s.terrain[17 * W + x] = 1;
  return s;
}

export const game = new Game();
