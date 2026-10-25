import { BUILDINGS, RES, RES_INFO, TILE, levelDef, type Building, type Conveyor, type Hauler, type ResId, type Walker, type Pt } from './data';
import { type Game, stockTotal, makeBuilding } from './sim';
import { chunkOwned } from './world';
import { drawPerson, drawQuadruped, drawWagon, drawTree, drawRock, drawParticle, drawUnit, ell, line, shadow, toneColors, stockRes, DONKEY, ELEPHANT, TAU, facing, type Ctx } from './draw';
import { drawBuilding, drawBuildingGround, drawStoreCrates, buildingActors, type DrawEnv } from './buildings';

interface Drawable { y: number; x: number; fn: () => void }
type VisFn = (x: number, y: number, m?: number) => boolean;

export class Renderer {
  ground: HTMLCanvasElement | null = null;
  cw = 0; ch = 0;
  list: Drawable[] = [];
  hoverBuilding: Building | null = null; hoverPile: Building | null = null; hoverConv: Conveyor | null = null;

  toScreen(g: Game, wx: number, wy: number) { const k = TILE * g.ui.cam.zoom; return { x: (wx - g.ui.cam.x) * k + this.cw / 2, y: (wy - g.ui.cam.y) * k + this.ch / 2 }; }
  toWorld(g: Game, sx: number, sy: number) { const k = TILE * g.ui.cam.zoom; return { x: (sx - this.cw / 2) / k + g.ui.cam.x, y: (sy - this.ch / 2) / k + g.ui.cam.y }; }

  buildGround(g: Game) {
    const s = g.s; const T = 48;
    if (!this.ground) this.ground = document.createElement('canvas');
    this.ground.width = s.W * T; this.ground.height = s.H * T;
    const c = this.ground.getContext('2d')!;
    c.fillStyle = '#6fa04f'; c.fillRect(0, 0, s.W * T, s.H * T);
    for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; const v = h - Math.floor(h);
      c.fillStyle = `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 40},0,${0.035 + (v % 0.07)})`; c.fillRect(x * T, y * T, T, T);
      if (v > 0.86) { c.fillStyle = 'rgba(70,120,50,0.55)'; for (let i = 0; i < 3; i++) { const gx = x * T + (v * 97 + i * 13) % T, gy = y * T + (v * 57 + i * 19) % T; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 2, gy - 6); c.lineTo(gx + 1, gy); c.lineTo(gx + 3, gy - 5); c.lineTo(gx + 4, gy); c.fill(); } }
      if (v > 0.965) { c.fillStyle = ['#f5e08a', '#f0a0b8', '#ffffff'][Math.floor(v * 100) % 3]; c.beginPath(); c.arc(x * T + (v * 137) % T, y * T + (v * 71) % T, 2, 0, TAU); c.fill(); }
    }
    const isRoad = (x: number, y: number) => x >= 0 && y >= 0 && x < s.W && y < s.H && s.terrain[y * s.W + x] === 1;
    for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
      if (!isRoad(x, y)) continue;
      const cx = x * T + T / 2, cy = y * T + T / 2; const hw = T * 0.34;
      c.fillStyle = '#c4ad82'; c.beginPath(); c.roundRect(cx - hw, cy - hw, hw * 2, hw * 2, 6); c.fill();
      if (isRoad(x + 1, y)) c.fillRect(cx, cy - hw, T / 2 + 1, hw * 2);
      if (isRoad(x - 1, y)) c.fillRect(cx - T / 2 - 1, cy - hw, T / 2 + 1, hw * 2);
      if (isRoad(x, y + 1)) c.fillRect(cx - hw, cy, hw * 2, T / 2 + 1);
      if (isRoad(x, y - 1)) c.fillRect(cx - hw, cy - T / 2 - 1, hw * 2, T / 2 + 1);
    }
    for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) { if (!isRoad(x, y)) continue; const cx = x * T + T / 2, cy = y * T + T / 2; c.fillStyle = 'rgba(120,100,70,0.25)'; for (let i = 0; i < 4; i++) { const h = Math.sin(x * 3.1 + y * 7.7 + i * 5.3) * 100; c.beginPath(); c.arc(cx + (h % 14), cy + ((h * 1.7) % 14), 2, 0, TAU); c.fill(); } }
    const cols = Math.ceil(s.W / s.CH), rows = Math.ceil(s.H / s.CH);
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      if (s.owned[cy * cols + cx]) continue;
      c.fillStyle = 'rgba(30,40,60,0.38)'; c.fillRect(cx * s.CH * T, cy * s.CH * T, s.CH * T, s.CH * T);
    }
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 3; c.setLineDash([12, 8]);
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      if (!s.owned[cy * cols + cx]) continue; const X = cx * s.CH * T, Y = cy * s.CH * T, S = s.CH * T;
      const own = (a: number, b: number) => a >= 0 && b >= 0 && a < cols && b < rows && s.owned[b * cols + a];
      c.beginPath();
      if (!own(cx, cy - 1)) { c.moveTo(X, Y); c.lineTo(X + S, Y); }
      if (!own(cx, cy + 1)) { c.moveTo(X, Y + S); c.lineTo(X + S, Y + S); }
      if (!own(cx - 1, cy)) { c.moveTo(X, Y); c.lineTo(X, Y + S); }
      if (!own(cx + 1, cy)) { c.moveTo(X + S, Y); c.lineTo(X + S, Y + S); }
      c.stroke();
    }
    c.setLineDash([]);
    g.groundDirty = false;
  }

  draw(canvas: HTMLCanvasElement, g: Game) {
    const ctx = canvas.getContext('2d')!; const s = g.s; const ui = g.ui;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) { canvas.width = cw * dpr; canvas.height = ch * dpr; }
    this.cw = cw; this.ch = ch;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (g.groundDirty || !this.ground) this.buildGround(g);
    const cam = ui.cam; const k = TILE * cam.zoom; const time = s.time;
    if (ui.focus) { // nudge the camera so the selection sits above the bottom sheet
      const f = ui.focus;
      if (f.camX === undefined || f.camY === undefined) {
        const p = this.toScreen(g, f.x, f.y);
        const needY = p.y > ch * 0.5 || p.y < ch * 0.14; const needX = p.x < cw * 0.12 || p.x > cw * 0.88;
        if (!needY && !needX) ui.focus = null;
        else { f.camY = needY ? f.y - (ch * 0.34 - ch / 2) / k : cam.y; f.camX = needX ? f.x : cam.x; }
      }
      if (ui.focus) { cam.x += (f.camX! - cam.x) * 0.14; cam.y += (f.camY! - cam.y) * 0.14; if (Math.abs(f.camX! - cam.x) < 0.02 && Math.abs(f.camY! - cam.y) < 0.02) ui.focus = null; }
    }
    cam.x = Math.max(2, Math.min(s.W - 2, cam.x)); cam.y = Math.max(2, Math.min(s.H - 2, cam.y));
    const shakeX = g.shake > 0 ? Math.sin(time * 60) * g.shake * 3 : 0, shakeY = g.shake > 0 ? Math.cos(time * 53) * g.shake * 2 : 0;
    ctx.save(); ctx.translate(shakeX, shakeY);
    ctx.fillStyle = '#3d6b3a'; ctx.fillRect(-10, -10, cw + 20, ch + 20);
    const o = this.toScreen(g, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.ground!, o.x, o.y, s.W * k, s.H * k);
    const tl = this.toWorld(g, 0, 0), br = this.toWorld(g, cw, ch);
    const vis: VisFn = (x, y, m = 3) => x > tl.x - m && x < br.x + m && y > tl.y - m && y < br.y + m;
    const dayT = (time / 320) % 1; const night = Math.max(0, Math.min(1, (0.5 - 0.5 * Math.cos(dayT * TAU) - 0.6) / 0.4));
    const env: DrawEnv = { time, night, game: g, k };
    const sc = (wx: number, wy: number) => this.toScreen(g, wx, wy);
    const selB = ui.selected?.type === 'building' ? ui.selected.id : -1;
    const selC = ui.selected?.type === 'conveyor' ? ui.selected.id : -1;

    for (const b of s.buildings) { if (!vis(b.x, b.y, 5)) continue; const p = sc(b.x, b.y); drawBuildingGround(ctx, b, p.x, p.y, env); }
    for (const c of s.conveyors) this.drawConveyorFloor(ctx, g, c, k, vis);

    const L = this.list; L.length = 0;
    const push = (x: number, y: number, fn: () => void) => { L.push({ x, y, fn }); };
    for (const t of s.trees) { if (!vis(t.x, t.y)) continue; const p = sc(t.x + 0.5 + Math.sin(t.phase) * 0.15, t.y + 0.85); push(t.x, t.y + 0.85, () => drawTree(ctx, p.x, p.y, k, t, time)); }
    for (const r of s.rocks) { if (!vis(r.x, r.y)) continue; const p = sc(r.x + 0.5, r.y + 0.85); push(r.x, r.y + 0.85, () => drawRock(ctx, p.x, p.y, k, r)); }
    for (const b of s.buildings) {
      if (!vis(b.x, b.y, 6)) continue; const p = sc(b.x, b.y); const d = levelDef(b);
      const ghosted = ui.moveId === b.id;
      push(b.x, b.y + b.h - 0.62, () => { if (ghosted) ctx.globalAlpha = 0.35; drawBuilding(ctx, b, p.x, p.y, env); ctx.globalAlpha = 1; });
      if (d.storeCap) push(b.x, b.y + b.h - 0.2, () => drawStoreCrates(ctx, b, p.x, p.y, env));
      if (stockTotal(b.output) > 0) push(b.x, b.y + b.h - 0.3, () => this.drawPile(ctx, g, b, p.x, p.y, k, selB === b.id || this.hoverPile === b));
      if (d.consumes && stockTotal(b.input) > 0 && k > 26) push(b.x, b.y + b.h - 0.55, () => this.drawInputs(ctx, b, p.x, p.y, k));
      if (k > 22) for (const a of buildingActors(g, b, d, time)) { const ap = sc(a.x, a.y); push(a.x, a.y, () => drawPerson(ctx, ap.x, ap.y, k * (a.scale || 1), a.angle, a.opts)); }
    }
    for (const c of s.conveyors) this.pushConveyor(ctx, g, c, k, vis, push, time, selC === c.id);
    for (const h of s.haulers) { if (!vis(h.x, h.y)) continue; push(h.x, h.y, () => this.drawHauler(ctx, g, h, k, time)); }
    for (const w of s.walkers) { if (!vis(w.x, w.y)) continue; push(w.x, w.y, () => this.drawWalker(ctx, g, w, k, time)); }
    L.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const d of L) d.fn();

    for (const p of g.particles) { if (!vis(p.x, p.y)) continue; const sp = sc(p.x, p.y); drawParticle(ctx, p, sp.x, sp.y, k); }

    this.drawOverlays(ctx, g, k, time, vis);
    ctx.restore();
    if (night > 0.01) { ctx.fillStyle = `rgba(20,30,90,${night * 0.22})`; ctx.fillRect(0, 0, cw, ch); }
    const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.45, cw / 2, ch / 2, Math.max(cw, ch) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.28)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, cw, ch);
  }

  drawConveyorFloor(ctx: Ctx, g: Game, c: Conveyor, k: number, vis: VisFn) {
    const s = k / 48;
    for (let i = 0; i < c.tiles.length; i++) {
      const t = c.tiles[i]; if (!vis(t.x, t.y)) continue; const p = this.toScreen(g, t.x + 0.5, t.y + 0.5);
      ctx.fillStyle = i < c.staffed ? 'rgba(90,70,40,0.22)' : 'rgba(90,70,40,0.1)'; ctx.beginPath(); ctx.roundRect(p.x - k * 0.42, p.y - k * 0.42, k * 0.84, k * 0.84, 5 * s); ctx.fill();
      const d = g.convDir(c, i); const { fx, fy } = { fx: d.x, fy: d.y };
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5 * s;
      for (const off of [-0.16, 0.16]) { const cx = p.x + fx * off * k, cy = p.y + fy * off * k; ctx.beginPath(); ctx.moveTo(cx - fx * 4 * s - fy * 5 * s, cy - fy * 4 * s + fx * 5 * s); ctx.lineTo(cx + fx * 3 * s, cy + fy * 3 * s); ctx.lineTo(cx - fx * 4 * s + fy * 5 * s, cy - fy * 4 * s - fx * 5 * s); ctx.stroke(); }
    }
  }

  pushConveyor(ctx: Ctx, g: Game, c: Conveyor, k: number, vis: VisFn, push: (x: number, y: number, fn: () => void) => void, time: number, selected: boolean) {
    const s = k / 48; const n = c.tiles.length;
    for (let i = 0; i < n; i++) {
      const t = c.tiles[i]; if (!vis(t.x, t.y)) continue;
      const d = g.convDir(c, i); const ang = Math.atan2(d.y, d.x);
      const wx = t.x + 0.5, wy = t.y + 0.5; const p = this.toScreen(g, wx, wy);
      if (i >= c.staffed) { // empty post: a wooden stake, bubble only when inspected
        push(wx, wy + 0.01, () => {
          shadow(ctx, p.x + 1 * s, p.y + 2 * s, 4 * s, 1.8 * s, 0.2); line(ctx, p.x, p.y, p.x, p.y - 13 * s, 3 * s, '#8a6a44'); ell(ctx, p.x, p.y - 13 * s, 2 * s, 1.2 * s, '#a98a5c');
          if (selected) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.roundRect(p.x - 8 * s, p.y - 26 * s, 16 * s, 11 * s, 3 * s); ctx.fill(); ctx.fillStyle = '#333'; ctx.font = `${Math.round(8 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('👤?', p.x, p.y - 18 * s); }
        });
        continue;
      }
      let r1: { side: -1 | 1; t: number; res: ResId } | null = null, r2: { side: -1 | 1; t: number; res: ResId } | null = null;
      for (const it of c.items) { if (it.pos >= i && it.pos < i + 1) { const f0 = it.pos - i; const rr = { side: (it.lane === 0 ? -1 : 1) as -1 | 1, t: Math.min(1, Math.max(0, f0 + 0.1 * Math.sin(TAU * f0))), res: it.res }; if (!r1) r1 = rr; else if (!r2 && rr.side !== r1.side) r2 = rr; } }
      const twist = r1 ? (r1.t - 0.5) * 0.7 * -r1.side : Math.sin(time * 1.5 + i) * 0.08;
      const tone = toneColors((c.id * 7 + i * 3) % 40);
      const opts = { phase: time * 3 + i, moving: false, time, reach: r1, reach2: r2, ...tone };
      push(wx, wy, () => drawPerson(ctx, p.x, p.y, k, ang + twist, opts));
    }
    for (const it of c.items) {
      const f0 = it.pos - Math.floor(it.pos); const f = Math.min(0.999, Math.max(0, f0 + 0.1 * Math.sin(TAU * f0)));
      const vpos = Math.min(n - 0.001, Math.floor(it.pos) + f);
      const pt = g.convPoint(c, vpos, it.lane); if (!vis(pt.x, pt.y)) continue;
      const lift = 12 * s + Math.sin(f * Math.PI) * 3 * s;
      const p = this.toScreen(g, pt.x, pt.y);
      push(pt.x, pt.y + 0.001, () => { shadow(ctx, p.x, p.y + 1 * s, 3.5 * s, 1.6 * s, 0.2); drawUnit(ctx, p.x, p.y - lift, 6.5 * s, it.res); });
    }
    // connection warnings: only right after building, or while inspected
    const recent = time - c.built < 12;
    if (recent || selected) {
      const warn = (t: Pt, txt: string) => { const p = this.toScreen(g, t.x + 0.5, t.y + 0.5); const bob = Math.sin(time * 4) * 2 * s; const fs = Math.round(11 * Math.max(0.8, Math.min(1.3, s))); ctx.font = `bold ${fs}px system-ui`; ctx.textAlign = 'center'; const tw = ctx.measureText(txt).width; ctx.fillStyle = 'rgba(160,30,30,0.85)'; ctx.beginPath(); ctx.roundRect(p.x - tw / 2 - 5, p.y - 36 * s + bob, tw + 10, fs + 6, 5); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(txt, p.x, p.y - 36 * s + fs + 1 + bob); };
      const last = c.tiles[n - 1];
      if (!c.sink && vis(last.x, last.y)) push(last.x + 0.5, last.y + 5, () => warn(last, 'No destination'));
      if (!c.srcIds.length && vis(c.tiles[0].x, c.tiles[0].y)) push(c.tiles[0].x + 0.5, c.tiles[0].y + 5, () => warn(c.tiles[0], 'No source'));
    }
  }

  drawPile(ctx: Ctx, g: Game, b: Building, sx: number, sy: number, k: number, showLabel: boolean) {
    const s = k / 48; const res = RES.filter((r) => (b.output[r] || 0) > 0);
    const yardW = b.w * k - 8 * s; const slotW = yardW / res.length; const baseY = sy + b.h * k - 5 * s;
    if (showLabel) { ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(sx + 2 * s, sy + b.h * k - k * 0.85, b.w * k - 4 * s, k * 0.9, 4 * s); ctx.fill(); }
    res.forEach((r, ri) => {
      const n = b.output[r]!; const x0 = sx + 4 * s + ri * slotW;
      const pallets = Math.floor(n / 100), crates = Math.floor((n % 100) / 10), boxes = n % 10;
      const units: { size: number; big: number }[] = [];
      for (let i = 0; i < pallets; i++) units.push({ size: 16 * s, big: 2 });
      for (let i = 0; i < crates; i++) units.push({ size: 10 * s, big: 1 });
      for (let i = 0; i < boxes; i++) units.push({ size: 6.5 * s, big: 0 });
      let cx = 0, row = 0, lvl = 0; const rowsMax = 2; const placed: { x: number; y: number; size: number; big: number; row: number; lvl: number }[] = [];
      let lastSize = -1;
      for (const u of units) {
        if (lastSize !== u.size) { if (lastSize > 0) { cx = 0; row = 0; lvl += 1; } lastSize = u.size; }
        if (cx + u.size > slotW - 2 * s) { cx = 0; row++; if (row >= rowsMax) { row = 0; lvl++; } }
        placed.push({ x: x0 + cx + u.size / 2 + lvl * 1.5 * s, y: baseY - row * u.size * 0.55 - lvl * u.size * 0.8, size: u.size, big: u.big, row, lvl });
        cx += u.size * 1.08;
      }
      placed.sort((a, b2) => a.lvl - b2.lvl || b2.row - a.row);
      for (const p of placed) { if (p.lvl === 0) shadow(ctx, p.x + 1 * s, p.y + 1 * s, p.size * 0.55, p.size * 0.22, 0.2); drawUnit(ctx, p.x, p.y, p.size, r, p.big); }
      if (showLabel && k > 22) {
        const lx = x0 + slotW / 2, ly = baseY - 26 * s - Math.min(2, lvl) * 6 * s;
        const label = `${n} ${RES_INFO[r].emoji}`; const fs = Math.round(11 * Math.max(0.8, Math.min(1.3, s))); ctx.font = `bold ${fs}px system-ui`; const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.roundRect(lx - tw / 2 - 5, ly - fs, tw + 10, fs + 6, 5); ctx.fill();
        ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.fillText(label, lx, ly + 1);
      }
    });
    if (this.hoverPile === b && !g.ui.touch && k > 22) { const label = 'carry by hand'; const fs = 11; ctx.font = `bold ${fs}px system-ui`; ctx.textAlign = 'center'; const tw = ctx.measureText(label).width; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.roundRect(sx + b.w * k / 2 - tw / 2 - 6, sy + b.h * k + 4, tw + 12, 18, 5); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(label, sx + b.w * k / 2, sy + b.h * k + 17); }
  }
  drawInputs(ctx: Ctx, b: Building, sx: number, sy: number, k: number) {
    const s = k / 48; let i = 0;
    for (const r of RES) { const n = b.input[r] || 0; if (!n) continue; const cnt = Math.min(4, Math.ceil(n / 3)); for (let j = 0; j < cnt; j++) drawUnit(ctx, sx + b.w * k - 8 * s - i * 8 * s, sy + b.h * k - k * 0.6 - j * 4 * s, 5.5 * s, r); i++; }
  }

  drawHauler(ctx: Ctx, g: Game, h: Hauler, k: number, time: number) {
    const p = this.toScreen(g, h.x, h.y); const s = k / 48; const cargo = stockRes(h.cargo);
    const moving = h.moving;
    switch (h.kind) {
      case 'founder': {
        drawPerson(ctx, p.x, p.y, k * 1.05, h.angle, { phase: h.phase, moving, time, hat: 'straw', shirt: '#3c8c5a', pants: '#4a3a30', carry: h.load > 0 ? cargo : null, carryN: h.load, skin: '#f0c8a0' });
        if (k > 20 && (time < 150 || time < g.ui.youFlagUntil)) { const bob = Math.sin(time * 3) * 2 * s; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.moveTo(p.x, p.y - 34 * s + bob); ctx.lineTo(p.x - 4 * s, p.y - 40 * s + bob); ctx.lineTo(p.x + 4 * s, p.y - 40 * s + bob); ctx.closePath(); ctx.fill(); ctx.font = `bold ${Math.round(9 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.strokeText('YOU', p.x, p.y - 42 * s + bob); ctx.fillStyle = '#fff'; ctx.fillText('YOU', p.x, p.y - 42 * s + bob); }
        break;
      }
      case 'porter': { const tone = toneColors(h.id % 5); drawPerson(ctx, p.x, p.y, k, h.angle, { phase: h.phase, moving, time, hat: 'cap', ...tone, carry: h.load > 0 ? cargo : null, carryN: h.load }); break; }
      case 'donkey': drawQuadruped(ctx, p.x, p.y, k, h.angle, DONKEY, { phase: h.phase, moving, headAngle: h.headAngle, time, load: h.load, capacity: h.capacity, cargo, packs: true }); break;
      case 'wagon': drawWagon(ctx, p.x, p.y, k, h.angle, { phase: h.phase, dist: h.dist, moving, headAngle: h.headAngle, time, load: h.load, capacity: h.capacity, cargo, driver: true }); break;
      case 'elephant': drawQuadruped(ctx, p.x, p.y, k, h.angle, ELEPHANT, { phase: h.phase, moving, headAngle: h.headAngle, time, load: h.load, capacity: h.capacity, cargo, rider: true }); break;
    }
    if ((h.state === 'loading' || h.state === 'unloading') && h.kind !== 'founder' && h.kind !== 'porter' && k > 24) {
      const w = 22 * s; const frac = Math.min(1, h.timer / (h.kind === 'elephant' ? 5 : h.kind === 'wagon' ? 3 : 1.5)); const yy = p.y - (h.kind === 'elephant' ? 70 : h.kind === 'wagon' ? 38 : 30) * s;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(p.x - w / 2, yy, w, 3 * s); ctx.fillStyle = h.state === 'loading' ? '#ffd166' : '#8ee08a'; ctx.fillRect(p.x - w / 2, yy, w * frac, 3 * s);
    }
  }
  drawWalker(ctx: Ctx, g: Game, w: Walker, k: number, time: number) {
    const p = this.toScreen(g, w.x, w.y); const moving = w.pi < w.path.length;
    if (w.kind === 'idle') { const tone = toneColors(w.tone); drawPerson(ctx, p.x, p.y, k * 0.95, w.angle, { phase: w.phase, moving, time, ...tone, hat: w.tone === 3 ? 'straw' : null }); return; }
    if (w.kind === 'soldier' || w.kind === 'returning') { drawPerson(ctx, p.x, p.y, k, w.angle, { phase: w.phase, moving, time, hat: 'helmet', tool: 'spear', shield: true, shirt: '#8a3b2e', skin: toneColors(w.tone).skin }); return; }
    if (w.kind === 'lootcart') {
      const cargo = w.payload ? stockRes(w.payload) : ['gold' as ResId]; const cnt = w.count || 100;
      if (cnt >= 900) drawQuadruped(ctx, p.x, p.y, k, w.angle, ELEPHANT, { phase: w.phase, moving, headAngle: w.angle, time, load: 1, capacity: 1, cargo, rider: true });
      else drawWagon(ctx, p.x, p.y, k, w.angle, { phase: w.phase, dist: w.phase / 4, moving, headAngle: w.angle, time, load: 1, capacity: 1, cargo, driver: true });
      const s = k / 48; ctx.font = `bold ${Math.round(10 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(`🏆 ${cnt}`, p.x, p.y - 50 * s); ctx.fillStyle = '#ffe9a0'; ctx.fillText(`🏆 ${cnt}`, p.x, p.y - 50 * s);
    }
  }

  outline(ctx: Ctx, g: Game, b: Building, k: number, color: string, width = 3) {
    const p = this.toScreen(g, b.x, b.y); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.roundRect(p.x + 2, p.y + 2, b.w * k - 4, b.h * k - 4, 6); ctx.stroke();
  }
  chipLabel(ctx: Ctx, x: number, y: number, text: string, bg = 'rgba(0,0,0,0.7)', fg = '#fff', fs = 12) {
    ctx.font = `bold ${fs}px system-ui`; ctx.textAlign = 'center'; const tw = ctx.measureText(text).width;
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x - tw / 2 - 7, y - fs - 4, tw + 14, fs + 10, 7); ctx.fill(); ctx.fillStyle = fg; ctx.fillText(text, x, y);
  }

  drawOverlays(ctx: Ctx, g: Game, k: number, time: number, vis: VisFn) {
    const s = k / 48; const ui = g.ui; const st = g.s;
    // expandable chunks: quiet lock glyphs; the tapped one glows
    const cols = Math.ceil(st.W / st.CH), rows = Math.ceil(st.H / st.CH);
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      if (!g.canExpand(cx, cy)) continue; const wx = cx * st.CH + st.CH / 2, wy = cy * st.CH + st.CH / 2; if (!vis(wx, wy, 6)) continue;
      const p = this.toScreen(g, wx, wy); const isT = ui.expandTarget && ui.expandTarget.cx === cx && ui.expandTarget.cy === cy;
      if (isT) { const pulse = 0.5 + 0.5 * Math.sin(time * 5); ctx.fillStyle = `rgba(255,230,120,${0.08 + 0.08 * pulse})`; ctx.fillRect(p.x - st.CH * k / 2, p.y - st.CH * k / 2, st.CH * k, st.CH * k); ctx.strokeStyle = `rgba(255,230,120,${0.6 + 0.4 * pulse})`; ctx.lineWidth = 3; ctx.strokeRect(p.x - st.CH * k / 2 + 2, p.y - st.CH * k / 2 + 2, st.CH * k - 4, st.CH * k - 4); }
      ctx.globalAlpha = isT ? 1 : 0.5; ctx.font = `${Math.round(20 * Math.max(0.7, Math.min(1.3, s)))}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('🔓', p.x, p.y + 7); ctx.globalAlpha = 1;
    }
    // selection
    if (ui.selected) {
      ctx.setLineDash([6, 4]); ctx.lineDashOffset = -time * 20;
      if (ui.selected.type === 'building') { const b = g.building(ui.selected.id); if (b) this.outline(ctx, g, b, k, 'rgba(255,255,255,0.9)', 2); }
      else { const c = g.conveyor(ui.selected.id); if (c) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; for (const t of c.tiles) { const p = this.toScreen(g, t.x, t.y); ctx.strokeRect(p.x + 2, p.y + 2, k - 4, k - 4); } } }
      ctx.setLineDash([]);
    }
    // mouse hover
    if (!ui.touch && ui.tool === 'select') {
      if (this.hoverBuilding && !this.hoverPile) this.outline(ctx, g, this.hoverBuilding, k, 'rgba(255,255,255,0.5)', 2);
      if (this.hoverConv) for (const t of this.hoverConv.tiles) { const p = this.toScreen(g, t.x, t.y); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(p.x, p.y, k, k); }
    }
    // build / move ghost
    if (ui.tool === 'build') {
      const gpos = ui.ghost ?? (!ui.touch ? ui.hover : null);
      if (gpos) {
        const mv = ui.moveId !== null ? g.building(ui.moveId) : null; const kind = mv ? mv.kind : ui.buildKind; const def = BUILDINGS[kind];
        const chk = g.ghostCheck(gpos); const p = this.toScreen(g, gpos.x, gpos.y);
        ctx.fillStyle = chk.ok ? 'rgba(120,255,120,0.25)' : 'rgba(255,80,80,0.25)'; ctx.fillRect(p.x, p.y, def.w * k, def.h * k);
        ctx.strokeStyle = chk.ok ? 'rgba(120,255,120,0.9)' : 'rgba(255,80,80,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, def.w * k, def.h * k);
        if (def.placement !== 'any') { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([4, 4]); ctx.strokeRect(p.x - 2 * k, p.y - 2 * k, (def.w + 4) * k, (def.h + 4) * k); ctx.setLineDash([]); }
        ctx.globalAlpha = 0.7;
        const ghost = mv ? { ...mv, x: gpos.x, y: gpos.y, id: -1, built: -10, flash: 0 } : makeBuilding(-1, kind, gpos.x, gpos.y, -10);
        drawBuilding(ctx, ghost, p.x, p.y, { time, night: 0, game: g, k }); ctx.globalAlpha = 1;
        if (!chk.ok && chk.reason) this.chipLabel(ctx, p.x + def.w * k / 2, p.y - 12, chk.reason, 'rgba(120,20,20,0.85)');
        else if (ui.touch) this.chipLabel(ctx, p.x + def.w * k / 2, p.y - 12, mv ? 'Drag · then ✓' : `${def.name} · drag, then ✓`, 'rgba(0,0,0,0.6)');
        if (ui.touch) { // drag handle ring
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([3, 5]); ctx.lineDashOffset = -time * 15; ctx.beginPath(); ctx.arc(p.x + def.w * k / 2, p.y + def.h * k / 2, Math.min(def.w, def.h) * k * 0.28, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }
    // conveyor drawing preview
    if (ui.tool === 'conveyor') {
      if (ui.extendId !== null) { const c = g.conveyor(ui.extendId); if (c) { const fw = g.forwardTile(c); const p = this.toScreen(g, fw.x + 0.5, fw.y + 0.5); const pulse = 0.5 + 0.5 * Math.sin(time * 6); ctx.fillStyle = `rgba(255,230,120,${0.25 + 0.25 * pulse})`; ctx.beginPath(); ctx.roundRect(p.x - k * 0.45, p.y - k * 0.45, k * 0.9, k * 0.9, 6); ctx.fill(); if (!ui.dragPath) this.chipLabel(ctx, p.x, p.y - k * 0.6, 'drag from here', 'rgba(0,0,0,0.65)'); } }
      const raw = ui.dragPath && ui.dragPath.length ? ui.dragPath : (!ui.touch && ui.hover ? [ui.hover] : []);
      const onB = (t: Pt) => g.grid.inb(t.x, t.y) && g.grid.occ[g.grid.idx(t.x, t.y)] >= 0;
      let a0 = 0; while (a0 < raw.length && onB(raw[a0])) a0++; let z0 = raw.length - 1; while (z0 >= a0 && onB(raw[z0])) z0--;
      const path = raw.slice(a0, z0 + 1);
      for (const t of raw) if (onB(t)) { const p = this.toScreen(g, t.x, t.y); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(p.x + 2, p.y + 2, k - 4, k - 4); }
      if (path.length && ui.dragPath) { // highlight what the route would connect
        const tmp: Conveyor = { id: -1, tiles: path, items: [], laneRes: [null, null], staffed: 0, moved: 0, srcIds: [], sink: null, built: 0 };
        g.linkConveyor(tmp);
        let ext: Conveyor | null = null; for (const c of st.conveyors) { const fw = g.forwardTile(c); if (fw.x === path[0].x && fw.y === path[0].y) { ext = c; break; } }
        if (ext) { for (const t of ext.tiles) { const p = this.toScreen(g, t.x, t.y); ctx.fillStyle = 'rgba(255,230,120,0.2)'; ctx.fillRect(p.x + 2, p.y + 2, k - 4, k - 4); } }
        else for (const id of tmp.srcIds) { const b = g.building(id); if (b) { this.outline(ctx, g, b, k, 'rgba(120,255,120,0.95)', 3); const p = this.toScreen(g, b.x + b.w / 2, b.y); this.chipLabel(ctx, p.x, p.y - 8, 'pick up', 'rgba(30,120,50,0.85)'); } }
        if (tmp.sink) { if (tmp.sink.type === 'building') { const b = g.building(tmp.sink.id); if (b) { this.outline(ctx, g, b, k, 'rgba(120,200,255,0.95)', 3); const p = this.toScreen(g, b.x + b.w / 2, b.y); this.chipLabel(ctx, p.x, p.y - 8, 'deliver', 'rgba(30,80,160,0.85)'); } } else { const oc = g.conveyor(tmp.sink.id); if (oc) { const t = oc.tiles[tmp.sink.idx]; const p = this.toScreen(g, t.x, t.y); ctx.fillStyle = 'rgba(120,200,255,0.35)'; ctx.fillRect(p.x, p.y, k, k); } } }
      }
      const afford = Math.floor(g.have('wood') / 2);
      path.forEach((t, i) => {
        const ok = g.grid.freeForBuild(t.x, t.y) && chunkOwned(st, t.x, t.y) && i < afford; const p = this.toScreen(g, t.x + 0.5, t.y + 0.5);
        ctx.fillStyle = ok ? 'rgba(120,255,120,0.28)' : 'rgba(255,80,80,0.3)'; ctx.beginPath(); ctx.roundRect(p.x - k * 0.45, p.y - k * 0.45, k * 0.9, k * 0.9, 4 * s); ctx.fill();
        const nx = path[i + 1] || (i > 0 ? { x: t.x + (t.x - path[i - 1].x), y: t.y + (t.y - path[i - 1].y) } : { x: t.x + 1, y: t.y });
        const dx = nx.x - t.x, dy = nx.y - t.y; const { fx, fy } = facing(Math.atan2(dy, dx));
        ctx.globalAlpha = 0.55; drawPerson(ctx, p.x, p.y, k, Math.atan2(dy, dx), { phase: 0, moving: false, time, shirt: '#ddd' }); ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(p.x + fx * 6 * s, p.y + fy * 6 * s + 6 * s); ctx.lineTo(p.x + fx * 16 * s, p.y + fy * 16 * s + 6 * s); ctx.stroke();
        ell(ctx, p.x + fx * 16 * s, p.y + fy * 16 * s + 6 * s, 2.5 * s, 2.5 * s, '#fff');
      });
      if (path.length && ui.dragPath) { const t = path[path.length - 1]; const p = this.toScreen(g, t.x + 0.5, t.y + 0.5); this.chipLabel(ctx, p.x, p.y - k * 0.5 - 16, `${path.length} posts · ${path.length * 2}🪵`, path.length > afford ? 'rgba(120,20,20,0.85)' : 'rgba(0,0,0,0.7)'); }
    }
    if (ui.tool === 'road') {
      const path = ui.dragRoad && ui.dragRoad.length ? ui.dragRoad : (!ui.touch && ui.hover ? [ui.hover] : []);
      for (const t of path) { const p = this.toScreen(g, t.x, t.y); const ok = g.grid.inb(t.x, t.y) && g.grid.occ[g.grid.idx(t.x, t.y)] < 0 && g.grid.nat[g.grid.idx(t.x, t.y)] === 0 && chunkOwned(st, t.x, t.y); ctx.fillStyle = ok ? 'rgba(220,200,150,0.55)' : 'rgba(255,80,80,0.3)'; ctx.fillRect(p.x + 2, p.y + 2, k - 4, k - 4); }
      if (ui.dragRoad && ui.dragRoad.length > 1) { const t = ui.dragRoad[ui.dragRoad.length - 1]; const p = this.toScreen(g, t.x + 0.5, t.y); this.chipLabel(ctx, p.x, p.y - 10, `${ui.dragRoad.length}🪨`); }
    }
    // founder's target marker while on a hand-haul errand
    const f = st.haulers.find((h) => h.kind === 'founder');
    if (f && (f.state === 'toPickup' || f.state === 'toDrop') && f.path.length && k > 20) { const tgt = f.path[f.path.length - 1]; const p = this.toScreen(g, tgt.x + 0.5, tgt.y + 0.5); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.lineDashOffset = -time * 30; ctx.beginPath(); ctx.ellipse(p.x, p.y, k * 0.4, k * 0.2, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    void line;
  }
}
