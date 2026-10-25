import type { GameState, Pt, Building, Tree, Rock } from './data';

// ---------- Seeded random ----------
export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Grid caches (not serialized) ----------
export class Grid {
  W: number; H: number;
  occ: Int32Array; // building id or -1
  conv: Int32Array; // conveyor id or -1
  nat: Uint8Array; // 0 none 1 tree 2 rock 3 ore
  natIdx: Int32Array; // index into trees/rocks
  constructor(W: number, H: number) {
    this.W = W; this.H = H;
    this.occ = new Int32Array(W * H).fill(-1);
    this.conv = new Int32Array(W * H).fill(-1);
    this.nat = new Uint8Array(W * H);
    this.natIdx = new Int32Array(W * H).fill(-1);
  }
  inb(x: number, y: number) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  idx(x: number, y: number) { return y * this.W + x; }
  rebuild(s: GameState) {
    this.occ.fill(-1); this.conv.fill(-1); this.nat.fill(0); this.natIdx.fill(-1);
    for (const b of s.buildings) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (this.inb(x, y)) this.occ[this.idx(x, y)] = b.id;
    for (const c of s.conveyors) for (const t of c.tiles) if (this.inb(t.x, t.y)) this.conv[this.idx(t.x, t.y)] = c.id;
    s.trees.forEach((t, i) => { if (this.inb(t.x, t.y)) { this.nat[this.idx(t.x, t.y)] = 1; this.natIdx[this.idx(t.x, t.y)] = i; } });
    s.rocks.forEach((r, i) => { if (this.inb(r.x, r.y)) { this.nat[this.idx(r.x, r.y)] = r.ore ? 3 : 2; this.natIdx[this.idx(r.x, r.y)] = i; } });
  }
  blocked(x: number, y: number): boolean {
    if (!this.inb(x, y)) return true;
    const i = this.idx(x, y);
    return this.occ[i] >= 0 || this.nat[i] > 0;
  }
  freeForBuild(x: number, y: number): boolean {
    if (!this.inb(x, y)) return false;
    const i = this.idx(x, y);
    return this.occ[i] < 0 && this.nat[i] === 0 && this.conv[i] < 0;
  }
}

export function chunkOwned(s: GameState, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= s.W || ty >= s.H) return false;
  const cx = Math.floor(tx / s.CH), cy = Math.floor(ty / s.CH);
  const cols = Math.ceil(s.W / s.CH);
  return !!s.owned[cy * cols + cx];
}

// ---------- Pathfinding (A*, 8-dir) ----------
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

class Heap {
  a: number[] = []; p: number[] = [];
  push(v: number, pr: number) {
    this.a.push(v); this.p.push(pr);
    let i = this.a.length - 1;
    while (i > 0) { const j = (i - 1) >> 1; if (this.p[j] <= this.p[i]) break; this.swap(i, j); i = j; }
  }
  pop(): number {
    const top = this.a[0]; const lv = this.a.pop()!; const lp = this.p.pop()!;
    if (this.a.length) {
      this.a[0] = lv; this.p[0] = lp; let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < this.a.length && this.p[l] < this.p[m]) m = l;
        if (r < this.a.length && this.p[r] < this.p[m]) m = r;
        if (m === i) break; this.swap(i, m); i = m;
      }
    }
    return top;
  }
  swap(i: number, j: number) { [this.a[i], this.a[j]] = [this.a[j], this.a[i]]; [this.p[i], this.p[j]] = [this.p[j], this.p[i]]; }
  get size() { return this.a.length; }
}

let gScore: Float32Array | null = null, cameFrom: Int32Array | null = null, closed: Uint8Array | null = null;

/** Find path from start tile to any tile in goal set. Returns list of tiles (excluding start) or null. */
export function findPath(s: GameState, g: Grid, sx: number, sy: number, goals: Pt[], big: boolean): Pt[] | null {
  const W = s.W, H = s.H, N = W * H;
  if (!gScore || gScore.length !== N) { gScore = new Float32Array(N); cameFrom = new Int32Array(N); closed = new Uint8Array(N); }
  gScore.fill(1e9); cameFrom!.fill(-1); closed!.fill(0);
  const goalMask = new Uint8Array(N);
  let gx = 0, gy = 0, gc = 0;
  for (const p of goals) if (g.inb(p.x, p.y)) { goalMask[p.y * W + p.x] = 1; gx += p.x; gy += p.y; gc++; }
  if (!gc) return null;
  gx /= gc; gy /= gc;
  const h = (x: number, y: number) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
  const heap = new Heap();
  const si = sy * W + sx;
  gScore[si] = 0; heap.push(si, h(sx, sy));
  let found = -1, iter = 0;
  while (heap.size && iter++ < 20000) {
    const cur = heap.pop();
    if (closed![cur]) continue;
    closed![cur] = 1;
    if (goalMask[cur]) { found = cur; break; }
    const cx = cur % W, cy = (cur / W) | 0;
    for (let d = 0; d < 8; d++) {
      const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (closed![ni]) continue;
      const isGoal = goalMask[ni] === 1;
      if (!isGoal && g.blocked(nx, ny)) continue;
      if (isGoal && g.occ[ni] >= 0) continue; // never step into buildings
      if (d >= 4) { // no corner cutting
        if (g.blocked(cx + DIRS[d][0], cy) || g.blocked(cx, cy + DIRS[d][1])) continue;
      }
      let cost = d >= 4 ? 1.414 : 1;
      if (s.terrain[ni] === 1) cost *= 0.55;
      if (g.conv[ni] >= 0) cost *= big ? 6 : 3;
      const ng = gScore[cur] + cost;
      if (ng < gScore[ni]) { gScore[ni] = ng; cameFrom![ni] = cur; heap.push(ni, ng + h(nx, ny)); }
    }
  }
  if (found < 0) return null;
  const path: Pt[] = [];
  let c = found;
  while (c !== si && c >= 0) { path.push({ x: c % W, y: (c / W) | 0 }); c = cameFrom![c]; }
  path.reverse();
  return path;
}

/** Tiles in front of a building (south row), falling back to full ring. */
export function approachTiles(g: Grid, b: Building): Pt[] {
  const front: Pt[] = [];
  for (let x = b.x; x < b.x + b.w; x++) if (g.inb(x, b.y + b.h) && !g.blocked(x, b.y + b.h)) front.push({ x, y: b.y + b.h });
  if (front.length) return front;
  const ring: Pt[] = [];
  for (let x = b.x - 1; x <= b.x + b.w; x++) for (let y = b.y - 1; y <= b.y + b.h; y++) {
    const inside = x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
    if (!inside && g.inb(x, y) && !g.blocked(x, y)) ring.push({ x, y });
  }
  return ring;
}

export function nearestFree(g: Grid, x: number, y: number, r = 4): Pt | null {
  for (let d = 0; d <= r; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
    if (!g.blocked(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  }
  return null;
}

// ---------- Terrain generation ----------
export function generateNature(s: GameState, rng: () => number, protect: { x: number; y: number; w: number; h: number }[]) {
  const W = s.W, H = s.H;
  const used = new Uint8Array(W * H);
  for (const p of protect) for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) used[y * W + x] = 1;
  const trees: Tree[] = []; const rocks: Rock[] = [];
  const place = (x: number, y: number) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H || used[y * W + x]) return false; used[y * W + x] = 1; return { x, y }; };
  const gauss = () => (rng() + rng() + rng() - 1.5) * 2;
  const forest = (cx: number, cy: number, n: number, spread: number) => {
    for (let i = 0; i < n; i++) {
      const p = place(cx + gauss() * spread, cy + gauss() * spread * 0.8);
      if (p) trees.push({ x: p.x, y: p.y, size: 0.75 + rng() * 0.5, phase: rng() * 6.28, kind: Math.floor(rng() * 3), shake: 0 });
    }
  };
  const rockField = (cx: number, cy: number, n: number, spread: number, ore: boolean) => {
    for (let i = 0; i < n; i++) {
      const p = place(cx + gauss() * spread, cy + gauss() * spread * 0.7);
      if (p) rocks.push({ x: p.x, y: p.y, size: 0.7 + rng() * 0.5, ore, kind: Math.floor(rng() * 3) });
    }
  };
  // start region 16..31 x 8..23 -> forest west, rocks north-east
  forest(18, 11, 16, 1.6); forest(19, 20, 10, 1.4); rockField(29, 10, 6, 1.1, false);
  // outer world
  forest(8, 6, 22, 2.2); forest(6, 22, 26, 2.4); forest(40, 26, 22, 2.2); forest(38, 5, 18, 2); forest(24, 29, 14, 1.8); forest(24, 3, 12, 1.6);
  rockField(42, 14, 10, 1.6, false); rockField(12, 28, 8, 1.5, false); rockField(10, 14, 7, 1.3, false);
  rockField(5, 12, 8, 1.4, true); rockField(43, 22, 7, 1.3, true); rockField(36, 30, 6, 1.2, true); rockField(12, 4, 6, 1.2, true); rockField(44, 4, 6, 1.2, true);
  // scattered singles
  for (let i = 0; i < 70; i++) { const p = place(rng() * W, rng() * H); if (p) trees.push({ x: p.x, y: p.y, size: 0.7 + rng() * 0.5, phase: rng() * 6.28, kind: Math.floor(rng() * 3), shake: 0 }); }
  for (let i = 0; i < 14; i++) { const p = place(rng() * W, rng() * H); if (p) rocks.push({ x: p.x, y: p.y, size: 0.6 + rng() * 0.4, ore: false, kind: Math.floor(rng() * 3) }); }
  s.trees = trees; s.rocks = rocks;
}
