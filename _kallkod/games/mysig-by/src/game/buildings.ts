import { levelDef, RES_INFO, type Building, type LevelDef, type Vis, type ResId, type Tree, type Rock } from './data';
import { type Ctx, ell, line, rrect, shade, shadow, lerp, clamp, drawUnit, drawQuadruped, DONKEY, HORSE, ELEPHANT, type PersonOpts, toneColors, stockRes } from './draw';
import type { Game } from './sim';
import { stockTotal } from './sim';

const ROOF: Record<NonNullable<Vis['roof']>, string> = { thatch: '#c9a75a', tile: '#b5553f', flat: '#a89a86', slate: '#5b6b7c', wood: '#7d5a3a' };

export interface DrawEnv { time: number; night: number; game: Game; k: number }

/** Pitched/flat roof over a wall box at screen rect (X,Y top-left of footprint top face at ground), width W, depth D, wall height H. */
function drawRoof(ctx: Ctx, X: number, Y: number, W: number, D: number, H: number, vis: Vis, s: number, t: number) {
  const type = vis.roof || 'tile'; const col = vis.roofColor || ROOF[type];
  const frontEave = Y + D - H, backEave = Y - H; const ov = 2.5 * s;
  if (type === 'flat') {
    ctx.fillStyle = shade(col, 0.05); ctx.fillRect(X - ov, backEave - 2 * s, W + ov * 2, D + 2 * s);
    ctx.fillStyle = shade(col, -0.25); ctx.fillRect(X - ov, frontEave - 2 * s, W + ov * 2, 3 * s);
    ctx.fillStyle = shade(col, 0.2); ctx.fillRect(X - ov, backEave - 2 * s, W + ov * 2, 2 * s);
    return { ridgeY: backEave };
  }
  const roofH = clamp(W * 0.32, 8 * s, 26 * s); const ridgeY = Y + D * 0.45 - H - roofH;
  // back slope
  ctx.fillStyle = shade(col, -0.3); ctx.beginPath(); ctx.moveTo(X - ov, backEave); ctx.lineTo(X + W + ov, backEave); ctx.lineTo(X + W, ridgeY); ctx.lineTo(X, ridgeY); ctx.closePath(); ctx.fill();
  // front slope
  const g = ctx.createLinearGradient(0, ridgeY, 0, frontEave); g.addColorStop(0, shade(col, 0.18)); g.addColorStop(1, shade(col, -0.08));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(X, ridgeY); ctx.lineTo(X + W, ridgeY); ctx.lineTo(X + W + ov, frontEave + 1); ctx.lineTo(X - ov, frontEave + 1); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.moveTo(X, ridgeY); ctx.lineTo(X + W, ridgeY); ctx.lineTo(X + W + ov, frontEave + 1); ctx.lineTo(X - ov, frontEave + 1); ctx.closePath(); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = Math.max(0.8, 0.9 * s);
  if (type === 'tile' || type === 'slate') { for (let yy = ridgeY + 3 * s; yy < frontEave; yy += 3.5 * s) { ctx.beginPath(); ctx.moveTo(X - ov, yy); ctx.lineTo(X + W + ov, yy); ctx.stroke(); } }
  else if (type === 'thatch') { for (let xx = X - ov; xx < X + W + ov; xx += 4 * s) { ctx.beginPath(); ctx.moveTo(xx, ridgeY); ctx.lineTo(xx - 3 * s, frontEave); ctx.stroke(); } }
  else { for (let xx = X; xx < X + W; xx += 6 * s) { ctx.beginPath(); ctx.moveTo(xx, ridgeY); ctx.lineTo(xx, frontEave); ctx.stroke(); } }
  ctx.restore();
  ctx.fillStyle = shade(col, -0.35); ctx.fillRect(X - 1, ridgeY - 1.2 * s, W + 2, 2.2 * s);
  void t;
  return { ridgeY };
}

function drawWalls(ctx: Ctx, X: number, Y: number, W: number, D: number, H: number, wall: string, vis: Vis, s: number, night: number, floors: number) {
  const front = Y + D - H;
  // contact shadow / AO
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.roundRect(X + 3 * s, Y + D - 2 * s, W + 2 * s, 5 * s, 3 * s); ctx.fill();
  const g = ctx.createLinearGradient(0, front, 0, Y + D); g.addColorStop(0, shade(wall, 0.1)); g.addColorStop(1, shade(wall, -0.12));
  ctx.fillStyle = g; ctx.fillRect(X, front, W, H);
  // top face (visible under flat roof only, otherwise covered by roof)
  ctx.fillStyle = shade(wall, 0.25); ctx.fillRect(X, Y - H, W, D);
  // plinth
  ctx.fillStyle = 'rgba(60,50,40,0.35)'; ctx.fillRect(X, Y + D - 3 * s, W, 3 * s);
  // floors & windows
  const fh = H / floors;
  for (let f = 0; f < floors; f++) {
    const fy = Y + D - (f + 1) * fh;
    if (f > 0) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(X, fy + fh - 1.5 * s, W, 1.5 * s); }
    const nWin = vis.windows || Math.max(1, Math.floor(W / (13 * s)));
    for (let i = 0; i < nWin; i++) {
      const wx = X + ((i + 0.5) / nWin) * W - 3 * s, wy = fy + fh * 0.28;
      if (f === 0 && Math.abs(wx + 3 * s - (X + W / 2)) < 6 * s && floors >= 1) continue; // door spot
      const glow = night * (0.6 + 0.4 * Math.sin(i * 3.1 + f * 1.7));
      ctx.fillStyle = `rgb(${lerp(120, 255, glow) | 0},${lerp(150, 220, glow) | 0},${lerp(170, 120, glow) | 0})`; ctx.fillRect(wx, wy, 6 * s, Math.min(7 * s, fh * 0.45));
      ctx.strokeStyle = 'rgba(60,40,20,0.7)'; ctx.lineWidth = Math.max(0.8, 0.9 * s); ctx.strokeRect(wx, wy, 6 * s, Math.min(7 * s, fh * 0.45));
      if (glow > 0.3) { ctx.fillStyle = `rgba(255,200,100,${glow * 0.25})`; ctx.fillRect(wx - 2 * s, wy - 2 * s, 10 * s, Math.min(7 * s, fh * 0.45) + 4 * s); }
    }
    if (vis.balcony && f === 1) { ctx.fillStyle = shade(wall, -0.3); ctx.fillRect(X + W * 0.15, fy + fh * 0.75, W * 0.7, 2.5 * s); for (let i = 0; i <= 6; i++) line(ctx, X + W * 0.15 + (i / 6) * W * 0.7, fy + fh * 0.75, X + W * 0.15 + (i / 6) * W * 0.7, fy + fh * 0.45, 0.9 * s, shade(wall, -0.35)); }
  }
  // door
  const dw = Math.min(9 * s, W * 0.3), dh = Math.min(fh * 0.7, 12 * s);
  ctx.fillStyle = '#4a3220'; ctx.beginPath(); ctx.roundRect(X + W / 2 - dw / 2, Y + D - dh, dw, dh, [dw / 2, dw / 2, 0, 0]); ctx.fill();
  ctx.fillStyle = 'rgba(255,200,120,' + 0.15 * night + ')'; ctx.fillRect(X + W / 2 - dw / 2, Y + D - dh, dw, dh);
}

function chimney(ctx: Ctx, x: number, y: number, s: number, env: DrawEnv, active: boolean, wx: number, wy: number) {
  rrect(ctx, x - 2.5 * s, y - 9 * s, 5 * s, 10 * s, 1 * s, '#6b5a50'); rrect(ctx, x - 3 * s, y - 10 * s, 6 * s, 2.5 * s, 1 * s, '#54463e');
  if (active && Math.random() < 0.09) env.game.smoke(wx, wy, 0.9 + Math.random() * 0.2);
}
function banner(ctx: Ctx, x: number, y: number, s: number, t: number, col = '#c9402f') {
  line(ctx, x, y, x, y - 26 * s, 1.6 * s, '#5a4a3a');
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - 26 * s); const w = Math.sin(t * 6) * 2 * s; ctx.lineTo(x + 11 * s, y - 23 * s + w); ctx.lineTo(x, y - 19 * s); ctx.closePath(); ctx.fill();
}
function crane(ctx: Ctx, x: number, y: number, s: number, t: number, res: ResId) {
  line(ctx, x, y, x, y - 30 * s, 3 * s, '#6b4a2e'); const ang = Math.sin(t * 0.7) * 0.5; const ax = x + Math.cos(ang) * 22 * s, ay = y - 30 * s + Math.sin(ang) * 6 * s;
  line(ctx, x, y - 30 * s, ax, ay, 2.4 * s, '#7d5a3a'); line(ctx, x, y - 20 * s, x + 12 * s, y - 28 * s, 1.5 * s, '#7d5a3a');
  const rope = 10 * s + Math.sin(t * 1.3) * 5 * s; line(ctx, ax, ay, ax, ay + rope, 0.9 * s, '#333'); drawUnit(ctx, ax + Math.sin(t * 2) * 1.5 * s, ay + rope + 5 * s, 6 * s, res, 1);
}

// ---------- ground decals (drawn before objects) ----------
export function drawBuildingGround(ctx: Ctx, b: Building, sx: number, sy: number, env: DrawEnv) {
  const k = env.k, s = k / 48; const d = levelDef(b); const W = b.w * k, H = b.h * k;
  // yard
  ctx.fillStyle = 'rgba(120,100,70,0.22)'; ctx.beginPath(); ctx.roundRect(sx + 2 * s, sy + 3 * s, W - 4 * s, H - 4 * s, 4 * s); ctx.fill();
  if (b.kind === 'farm') {
    const fieldTop = sy + k * 0.15, fieldL = sx + k * 0.1, fw = W - k * 0.2, fhgt = H - k * 0.85;
    ctx.fillStyle = '#8a6a3f'; ctx.fillRect(fieldL, fieldTop, fw, fhgt);
    const rows = d.workers >= 4 ? 7 : d.workers >= 3 ? 6 : 5; const grow = b.progress;
    for (let r = 0; r < rows; r++) {
      const ry = fieldTop + ((r + 0.5) / rows) * fhgt; ctx.fillStyle = 'rgba(70,50,30,0.35)'; ctx.fillRect(fieldL, ry, fw, 1.5 * s);
      const cols = Math.floor(fw / (6 * s));
      for (let c = 0; c < cols; c++) { const cx = fieldL + (c + 0.5) * (fw / cols); if ((c * 7 + r * 3) % 5 === 0 && b.kind === 'farm' && (r + c) % 9 === 0) continue; const hgt = (2 + grow * 7) * s * (0.8 + 0.2 * Math.sin(c * 2 + r)); const col = grow < 0.6 ? `rgb(${80 + grow * 80 | 0},${150 + grow * 30 | 0},60)` : `rgb(${190 + (grow - 0.6) * 100 | 0},${170 + (grow - 0.6) * 20 | 0},70)`; const sw = Math.sin(env.time * 2 + c * 0.7 + r) * s; line(ctx, cx, ry, cx + sw, ry - hgt, 1.6 * s, col); if (grow > 0.7) ell(ctx, cx + sw, ry - hgt, 1.6 * s, 1.1 * s, '#f0d070'); }
    }
  }
  if (b.kind === 'quarry') { ctx.fillStyle = '#8b8378'; ctx.beginPath(); ctx.roundRect(sx + k * 0.1, sy + k * 0.1, W - k * 0.2, H - k * 0.75, 6 * s); ctx.fill(); ctx.fillStyle = '#6f685f'; ctx.beginPath(); ctx.roundRect(sx + k * 0.35, sy + k * 0.35, W - k * 0.9, H - k * 1.2, 5 * s); ctx.fill(); }
  if (b.kind === 'mine' && d.vis.rail) { const y0 = sy + H * 0.55, y1 = sy + H - 6 * s; line(ctx, sx + W * 0.5 - 4 * s, y0, sx + W * 0.5 - 4 * s, y1, 1.2 * s, '#5a4a3a'); line(ctx, sx + W * 0.5 + 4 * s, y0, sx + W * 0.5 + 4 * s, y1, 1.2 * s, '#5a4a3a'); for (let y = y0; y < y1; y += 5 * s) line(ctx, sx + W * 0.5 - 5 * s, y, sx + W * 0.5 + 5 * s, y, 1.5 * s, '#6f5a44'); }
  if (d.vis.fence) {
    const px = sx + k * 0.08, py = sy + k * 0.1, pw = W - k * 0.16, ph = H - k * 0.7;
    ctx.fillStyle = 'rgba(160,130,80,0.25)'; ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 1.6 * s; ctx.strokeRect(px, py, pw, ph);
  }
  if (b.kind === 'house' && b.level === 0 && b.variant === 'base') { for (let i = 0; i < 6; i++) { const fx = sx + k * 0.25 + ((i * 37) % 100) / 100 * (W - k * 0.5), fy = sy + H - k * 0.55 + ((i * 53) % 100) / 100 * k * 0.35; ell(ctx, fx, fy, 1.6 * s, 1.6 * s, ['#e86a8a', '#f0d060', '#f5f5f5'][i % 3]); } }
}

// ---------- main structure ----------
export function drawBuilding(ctx: Ctx, b: Building, sx: number, sy: number, env: DrawEnv) {
  const k = env.k, s = k / 48, t = env.time; const d = levelDef(b); const vis = d.vis;
  const age = Math.min(1, (t - b.built) / 0.6); const pop = 1 - Math.pow(1 - age, 3);
  const flash = b.flash > 0 ? Math.sin(b.flash * 10) * 0.5 + 0.5 : 0;
  const scale = (vis.scale || 1) * (0.2 + 0.8 * pop) * (1 + flash * 0.02);
  const W = (b.w - 0.25) * k * scale, D = Math.max(0.35 * k, (b.h - 0.9) * k) * (0.85 + 0.15 * scale), Hh = d.height * k * 0.62 * scale;
  const X = sx + (b.w * k - W) / 2 + (b.kind === 'farm' ? -(b.w * k - W) / 2 + k * 0.1 : 0), Y = sy + (b.kind === 'farm' ? k * 0.1 : k * 0.15) + (b.h - 0.9) * k * (1 - (0.85 + 0.15 * scale));
  const wall = vis.wall || '#c9a97a'; const floors = vis.floors || 1;
  const active = b.id >= 0 && (d.workers === 0 || b.workers > 0) && !b.blocked && !b.starved;
  const cx = sx + (b.w * k) / 2;
  ctx.save();
  if (flash > 0) { ctx.shadowColor = 'rgba(255,240,150,0.9)'; ctx.shadowBlur = 18 * flash; }
  switch (b.kind) {
    case 'farm': {
      const hw = 0.9 * k * scale, hd = 0.5 * k, hh = Hh;
      const hx = sx + b.w * k - hw - k * 0.12, hy = sy + k * 0.12;
      drawWalls(ctx, hx, hy, hw, hd, hh, wall, vis, s, env.night, 1); drawRoof(ctx, hx, hy, hw, hd, hh, vis, s, t);
      if (vis.silo) { const sxx = sx + k * 0.15, syy = sy + k * 0.15; shadow(ctx, sxx + 12 * s, syy + 14 * s, 12 * s, 5 * s, 0.25); rrect(ctx, sxx, syy - 22 * s, 18 * s, 34 * s, 4 * s, '#b9a58a'); ell(ctx, sxx + 9 * s, syy - 22 * s, 9 * s, 4 * s, '#8a3b2e'); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(sxx + 12 * s, syy - 22 * s, 6 * s, 34 * s); }
      if (vis.mill) { const mx = sx + k * 0.6, my = sy + k * 0.2; shadow(ctx, mx + 6 * s, my + 8 * s, 14 * s, 6 * s, 0.25); ctx.fillStyle = '#d8c6a4'; ctx.beginPath(); ctx.moveTo(mx - 11 * s, my + 8 * s); ctx.lineTo(mx + 11 * s, my + 8 * s); ctx.lineTo(mx + 7 * s, my - 34 * s); ctx.lineTo(mx - 7 * s, my - 34 * s); ctx.closePath(); ctx.fill(); ell(ctx, mx, my - 34 * s, 8 * s, 5 * s, '#8a3b2e'); const an = t * (active ? 1.6 : 0.2); for (let i = 0; i < 4; i++) { const a = an + (i * Math.PI) / 2; line(ctx, mx, my - 30 * s, mx + Math.cos(a) * 20 * s, my - 30 * s + Math.sin(a) * 20 * s, 2.5 * s, '#e8dcc0'); line(ctx, mx + Math.cos(a) * 6 * s, my - 30 * s + Math.sin(a) * 6 * s, mx + Math.cos(a) * 20 * s, my - 30 * s + Math.sin(a) * 20 * s, 5 * s, 'rgba(255,255,255,0.5)'); } ell(ctx, mx, my - 30 * s, 2.5 * s, 2.5 * s, '#4a3a2a'); }
      break;
    }
    case 'quarry': {
      // small hut + scaffolding + rock chunks
      const hw = W * 0.5, hd = D * 0.7, hx = X, hy = Y + D * 0.15;
      drawWalls(ctx, hx, hy, hw, hd, Hh * 0.8, wall, vis, s, env.night, 1); drawRoof(ctx, hx, hy, hw, hd, Hh * 0.8, vis, s, t);
      for (let i = 0; i < 3 + b.level * 2; i++) { const rx = X + W * 0.62 + ((i * 29) % 40) / 40 * W * 0.35, ry = Y + D * 0.3 + ((i * 17) % 30) / 30 * D * 0.6; shadow(ctx, rx + 1.5 * s, ry + 1 * s, 5 * s, 2.2 * s, 0.25); ell(ctx, rx, ry - 3 * s, 5 * s, 4 * s, '#a3a8ad'); ell(ctx, rx - 1.5 * s, ry - 4.5 * s, 2.5 * s, 1.6 * s, '#d0d5da'); }
      if (b.level >= 1) { for (let i = 0; i < 3; i++) line(ctx, X + W * 0.6 + i * 10 * s, Y + D, X + W * 0.6 + i * 10 * s, Y + D - Hh * 1.2, 1.6 * s, '#7a5a3a'); line(ctx, X + W * 0.58, Y + D - Hh * 1.2, X + W * 0.6 + 22 * s, Y + D - Hh * 1.2, 1.6 * s, '#7a5a3a'); line(ctx, X + W * 0.58, Y + D - Hh * 0.6, X + W * 0.6 + 22 * s, Y + D - Hh * 0.6, 1.6 * s, '#7a5a3a'); }
      if (vis.crane) crane(ctx, X + W * 0.85, Y + D * 0.9, s, t, 'stone');
      break;
    }
    case 'mine': {
      // mound with entrance
      const mw = W, mh = Hh * 1.3;
      shadow(ctx, X + mw / 2 + 4 * s, Y + D + 1 * s, mw * 0.55, 6 * s, 0.3);
      ctx.fillStyle = '#6f6259'; ctx.beginPath(); ctx.moveTo(X, Y + D); ctx.quadraticCurveTo(X + mw * 0.1, Y + D - mh, X + mw * 0.5, Y + D - mh * 1.05); ctx.quadraticCurveTo(X + mw * 0.9, Y + D - mh, X + mw, Y + D); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#867870'; ctx.beginPath(); ctx.moveTo(X + mw * 0.15, Y + D - mh * 0.3); ctx.quadraticCurveTo(X + mw * 0.3, Y + D - mh * 0.95, X + mw * 0.55, Y + D - mh * 0.95); ctx.quadraticCurveTo(X + mw * 0.45, Y + D - mh * 0.6, X + mw * 0.15, Y + D - mh * 0.3); ctx.fill();
      const ew = mw * 0.32, eh = mh * 0.55; ctx.fillStyle = '#1e1a18'; ctx.beginPath(); ctx.roundRect(X + mw / 2 - ew / 2, Y + D - eh, ew, eh, [ew / 2, ew / 2, 0, 0]); ctx.fill();
      ctx.fillStyle = `rgba(255,170,80,${0.25 + 0.15 * Math.sin(t * 5)})`; ctx.beginPath(); ctx.roundRect(X + mw / 2 - ew / 2 + 2 * s, Y + D - eh * 0.6, ew - 4 * s, eh * 0.6, 2 * s); ctx.fill();
      line(ctx, X + mw / 2 - ew / 2 - 2 * s, Y + D, X + mw / 2 - ew / 2 - 2 * s, Y + D - eh, 3 * s, '#8a6a44'); line(ctx, X + mw / 2 + ew / 2 + 2 * s, Y + D, X + mw / 2 + ew / 2 + 2 * s, Y + D - eh, 3 * s, '#8a6a44'); line(ctx, X + mw / 2 - ew / 2 - 4 * s, Y + D - eh, X + mw / 2 + ew / 2 + 4 * s, Y + D - eh, 3 * s, '#8a6a44');
      if (vis.rail) { const ph = (t * 0.35 + b.seed) % 1; const cy = Y + D - eh * 0.3 + (b.h * k - D - eh * 0.3 - 0.5 * k) * Math.abs(Math.sin(ph * Math.PI)); const cxx = sx + (b.w * k) / 2; rrect(ctx, cxx - 5 * s, cy - 6 * s, 10 * s, 6 * s, 1.5 * s, '#4a4a52'); if (b.workers > 0) { ell(ctx, cxx, cy - 6 * s, 4 * s, 2 * s, RES_INFO.iron.light); } ell(ctx, cxx - 3 * s, cy, 1.4 * s, 1.4 * s, '#222'); ell(ctx, cxx + 3 * s, cy, 1.4 * s, 1.4 * s, '#222'); }
      if (vis.tower) { const tx = X + mw * 0.82, ty = Y + D - mh * 0.3; line(ctx, tx - 8 * s, ty, tx, ty - 36 * s, 2.2 * s, '#5a4a3a'); line(ctx, tx + 8 * s, ty, tx, ty - 36 * s, 2.2 * s, '#5a4a3a'); line(ctx, tx - 6 * s, ty - 14 * s, tx + 6 * s, ty - 14 * s, 2 * s, '#5a4a3a'); const wa = t * (active ? 3 : 0.3); ell(ctx, tx, ty - 34 * s, 5 * s, 5 * s, '#333'); line(ctx, tx + Math.cos(wa) * 5 * s, ty - 34 * s + Math.sin(wa) * 5 * s, tx - Math.cos(wa) * 5 * s, ty - 34 * s - Math.sin(wa) * 5 * s, 1.2 * s, '#999'); }
      if (vis.chimneys) chimney(ctx, X + mw * 0.2, Y + D - mh * 0.5, s, env, active, b.x + 0.4, b.y + 0.4);
      break;
    }
    default: {
      // generic walled structure with optional extension / tower
      let mainW = W, mainX = X;
      if (vis.extension) { mainW = W * 0.7; const ew = W * 0.36, eh = Hh * 0.62, ex = X + W - ew, ed = D * 0.85; drawWalls(ctx, ex, Y + D - ed, ew, ed, eh, shade(wall, -0.06), { windows: 1 }, s, env.night, 1); drawRoof(ctx, ex, Y + D - ed, ew, ed, eh, { roof: vis.roof, roofColor: vis.roofColor }, s, t); }
      if (vis.tower) { const tw = W * 0.2, th = Hh * 1.55, tx = X + (vis.extension ? W * 0.02 : W * 0.05); drawWalls(ctx, tx, Y + D * 0.1, tw, D * 0.5, th, shade(wall, -0.05), { windows: 1 }, s, env.night, 2); ctx.fillStyle = shade(vis.roofColor || ROOF[vis.roof || 'tile'], -0.2); ctx.beginPath(); ctx.moveTo(tx - 2 * s, Y + D * 0.6 - th); ctx.lineTo(tx + tw + 2 * s, Y + D * 0.6 - th); ctx.lineTo(tx + tw / 2, Y + D * 0.6 - th - tw * 0.9); ctx.closePath(); ctx.fill(); }
      if (b.kind === 'donkeypen' && !vis.roof) { /* just a fence + trough */ rrect(ctx, X + W * 0.3, Y + D * 0.5, W * 0.4, 6 * s, 2 * s, '#7a5a3a'); }
      else drawWalls(ctx, mainX, Y, mainW, D, Hh, wall, vis, s, env.night, floors);
      if (b.kind === 'elephantstable') { const aw = mainW * 0.45, ah = Hh * 0.8; ctx.fillStyle = '#2a2018'; ctx.beginPath(); ctx.roundRect(mainX + mainW / 2 - aw / 2, Y + D - ah, aw, ah, [aw / 2, aw / 2, 0, 0]); ctx.fill(); }
      if (b.kind === 'smithy') { // forge glow in open front
        const gw = mainW * 0.34, gx = mainX + mainW * 0.08, gy = Y + D; const fl = 0.7 + 0.3 * Math.sin(t * 9 + Math.sin(t * 13)); ctx.fillStyle = '#2a1e18'; ctx.fillRect(gx, gy - Hh * 0.75, gw, Hh * 0.75); const rg = ctx.createRadialGradient(gx + gw / 2, gy - Hh * 0.25, 1, gx + gw / 2, gy - Hh * 0.25, gw * 0.7); rg.addColorStop(0, `rgba(255,190,80,${active ? 0.95 * fl : 0.3})`); rg.addColorStop(1, 'rgba(255,90,20,0)'); ctx.fillStyle = rg; ctx.fillRect(gx, gy - Hh * 0.75, gw, Hh * 0.75); }
      if (b.kind === 'barracks') { // shields on wall
        for (let i = 0; i < 3; i++) { const bx = mainX + mainW * (0.25 + i * 0.25), by = Y + D - Hh * 0.75; ell(ctx, bx, by, 3.5 * s, 4 * s, '#8a3b2e'); ell(ctx, bx, by, 1.3 * s, 1.5 * s, '#e0c060'); } }
      if (b.kind === 'warehouse' || b.kind === 'storehouse') { // big shutter door
        const dw = mainW * 0.32, dh = Hh * 0.55; ctx.fillStyle = '#5a3d24'; ctx.fillRect(mainX + mainW * 0.55, Y + D - dh, dw, dh); for (let i = 1; i < 4; i++) line(ctx, mainX + mainW * 0.55, Y + D - dh + (dh * i) / 4, mainX + mainW * 0.55 + dw, Y + D - dh + (dh * i) / 4, 0.8 * s, 'rgba(0,0,0,0.3)'); }
      if (!(b.kind === 'donkeypen' && !vis.roof)) drawRoof(ctx, mainX, Y, mainW, D, Hh, vis, s, t);
      if (vis.chimneys) for (let i = 0; i < vis.chimneys; i++) { const cxp = mainX + mainW * (0.78 - i * 0.28); chimney(ctx, cxp, Y + D * 0.35 - Hh - (vis.roof === 'flat' ? 0 : 6 * s), s, env, active && (b.kind !== 'house' || env.night > 0.2 || b.seed > 0.6), b.x + b.w * (0.78 - i * 0.28) - 0.05, b.y + 0.3); }
      if (vis.banner) banner(ctx, mainX + mainW - 3 * s, Y + D - Hh - 2 * s, s, t + b.seed, b.kind === 'barracks' ? '#c9402f' : b.kind === 'storehouse' ? '#3f7dbf' : '#c9a24a');
      if (vis.crane) crane(ctx, X + W + 6 * s, Y + D * 0.8, s, t + b.seed * 3, b.kind === 'storehouse' ? 'wood' : 'food');
      if (vis.wheel) { const wx = X - 4 * s, wy = Y + D * 0.7, r = 13 * s; ctx.fillStyle = '#5a7fa8'; ctx.fillRect(X - 12 * s, Y + D - 4 * s, 10 * s, 6 * s); const an = t * (active ? 1.4 : 0); ell(ctx, wx, wy - r, r, r, '#6b4a2e'); ell(ctx, wx, wy - r, r * 0.8, r * 0.8, '#8a6a44'); for (let i = 0; i < 6; i++) { const a = an + (i * Math.PI) / 3; line(ctx, wx, wy - r, wx + Math.cos(a) * r, wy - r + Math.sin(a) * r, 2 * s, '#4a3220'); } ell(ctx, wx, wy - r, 2.5 * s, 2.5 * s, '#333'); }
      if (vis.roof === 'flat' && b.kind === 'house') { // laundry lines
        const ly = Y - Hh - 2 * s; line(ctx, mainX + 4 * s, ly, mainX + mainW - 4 * s, ly - 3 * s, 0.8 * s, '#444'); for (let i = 0; i < 4; i++) { const lx = mainX + 8 * s + i * (mainW - 16 * s) / 3; const sw = Math.sin(t * 3 + i) * 1.5 * s; ctx.fillStyle = ['#e86a6a', '#f5f5f5', '#6ab0e8', '#f0d060'][i]; ctx.beginPath(); ctx.moveTo(lx - 2.5 * s, ly - (i * 0.75) * s); ctx.lineTo(lx + 2.5 * s, ly - (i * 0.75) * s); ctx.lineTo(lx + 2.5 * s + sw, ly + 5 * s); ctx.lineTo(lx - 2.5 * s + sw, ly + 5 * s); ctx.closePath(); ctx.fill(); } }
      if (b.kind === 'woodcutter') { // log stack + chopping block
        for (let i = 0; i < 3 + b.level; i++) drawUnit(ctx, X - 6 * s + (i % 3) * 7 * s, Y + D + 2 * s - Math.floor(i / 3) * 5 * s, 7 * s, 'wood');
        ell(ctx, X + W + 5 * s, Y + D * 0.9, 4.5 * s, 2.4 * s, '#6b4a2e'); ctx.fillStyle = '#7d5a3a'; ctx.fillRect(X + W + 0.5 * s, Y + D * 0.9 - 6 * s, 9 * s, 6 * s); ell(ctx, X + W + 5 * s, Y + D * 0.9 - 6 * s, 4.5 * s, 2.4 * s, '#a97d4e');
      }
      if (b.kind === 'smithy') { ctx.fillStyle = '#3a3a42'; ctx.fillRect(cx - 6 * s, Y + D + 2 * s, 12 * s, 3 * s); ctx.fillRect(cx - 3 * s, Y + D - 2 * s, 6 * s, 5 * s); ctx.fillRect(cx - 7 * s, Y + D - 4 * s, 14 * s, 3 * s); }
      break;
    }
  }
  ctx.restore();
  // decorative animals inside pens
  if (b.kind === 'donkeypen' || b.kind === 'stable' || b.kind === 'elephantstable') {
    const n = b.kind === 'donkeypen' ? 1 : b.kind === 'stable' ? Math.min(2, b.level + 1) : 1;
    for (let i = 0; i < n; i++) {
      const spec = b.kind === 'donkeypen' ? DONKEY : b.kind === 'stable' ? HORSE : ELEPHANT;
      const ax = sx + b.w * k * (b.kind === 'stable' ? 0.28 + i * 0.44 : b.kind === 'elephantstable' ? 0.5 : 0.5), ay = sy + b.h * k - k * (b.kind === 'elephantstable' ? 0.62 : 0.55) + (i % 2) * 4 * s;
      const ang = Math.PI / 2 + Math.sin(t * 0.3 + i * 2 + b.seed * 6) * 0.9;
      drawQuadruped(ctx, ax, ay, k * (b.kind === 'elephantstable' ? 0.8 : 0.85), ang, spec, { phase: 0, moving: false, headAngle: ang + Math.sin(t * 0.8 + i) * 0.5, time: t + i, packs: false });
    }
  }
  // blocked / starved status
  if (b.blocked || b.starved || (levelDef(b).workers > 0 && b.workers === 0)) {
    const ix = cx, iy = sy - 8 * s + Math.sin(t * 3) * 2 * s; ctx.font = `${Math.round(13 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(ix - 10 * s, iy - 12 * s, 20 * s, 16 * s, 4 * s); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(b.blocked ? '📦!' : b.starved ? '⛓️?' : '👤?', ix, iy);
  }
}

/** Stored-goods crates outside warehouses (visual fill level). */
export function drawStoreCrates(ctx: Ctx, b: Building, sx: number, sy: number, env: DrawEnv) {
  const d = levelDef(b); if (!d.storeCap) return; const k = env.k, s = k / 48;
  const fill = stockTotal(b.store) / d.storeCap; const n = Math.min(14, Math.ceil(fill * 14));
  const res = stockRes(b.store);
  const x0 = sx + 4 * s, y0 = sy + b.h * k - 3 * s;
  for (let i = 0; i < n; i++) { const col = i % 5, lvl = Math.floor(i / 5); const bw = 7.5 * s; drawUnit(ctx, x0 + col * bw * 1.05 + lvl * 2 * s, y0 - lvl * bw * 0.8 - (col % 2) * 1.5 * s, bw, res[i % res.length], 1); }
}

// ---------- actors (workers animated around buildings) ----------
export interface Actor { x: number; y: number; angle: number; opts: PersonOpts; scale?: number; alpha?: number }
const nearCache = new Map<number, { t: number; p: { x: number; y: number } | null }>();
const chopState = new Map<string, number>();

function nearest<T extends { x: number; y: number }>(list: T[], b: Building, filter?: (v: T) => boolean): T | null {
  let best: T | null = null, bd = 1e9; const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  for (const v of list) { if (filter && !filter(v)) continue; const dd = Math.hypot(v.x + 0.5 - cx, v.y + 0.5 - cy); if (dd < bd && dd < 6) { bd = dd; best = v; } }
  return best;
}
function target(game: Game, b: Building): { x: number; y: number } | null {
  const c = nearCache.get(b.id); if (c && game.s.time - c.t < 4) return c.p;
  let p: { x: number; y: number } | null = null;
  if (b.kind === 'woodcutter') { const tr = nearest<Tree>(game.s.trees, b); if (tr) p = { x: tr.x + 0.5, y: tr.y + 0.75 }; }
  if (b.kind === 'quarry') { const r = nearest<Rock>(game.s.rocks, b, (r) => !r.ore); if (r) p = { x: r.x + 0.5, y: r.y + 0.9 }; }
  if (b.kind === 'mine') { const r = nearest<Rock>(game.s.rocks, b, (r) => r.ore); if (r) p = { x: r.x + 0.5, y: r.y + 0.9 }; }
  nearCache.set(b.id, { t: game.s.time, p });
  return p;
}
const smooth = (t: number) => t * t * (3 - 2 * t);

export function buildingActors(game: Game, b: Building, d: LevelDef, time: number): Actor[] {
  const out: Actor[] = [];
  const n = Math.min(b.workers, Math.max(1, d.workers) === 1 ? 1 : 4); if (n === 0 && b.kind !== 'barracks' && b.kind !== 'storehouse') return out;
  const door = { x: b.x + b.w / 2, y: b.y + b.h - 0.45 };
  const tone = (i: number) => toneColors(Math.floor(b.seed * 5 + i * 3));
  if (b.kind === 'woodcutter' || b.kind === 'quarry' || b.kind === 'mine') {
    const tp = target(game, b); const res: ResId = b.kind === 'woodcutter' ? 'wood' : b.kind === 'quarry' ? 'stone' : 'iron';
    const tool = b.kind === 'woodcutter' ? 'axe' : 'pick';
    for (let i = 0; i < n; i++) {
      const T = b.kind === 'woodcutter' ? 6 : 5.5; const ph = ((time + i * (T / n) + b.seed * 7) / T) % 1;
      if (b.blocked || !tp) { out.push({ x: door.x + (i - (n - 1) / 2) * 0.35, y: door.y + 0.1, angle: Math.PI / 2, opts: { phase: 0, moving: false, time, sit: true, tool: b.blocked ? null : tool, ...tone(i) } }); continue; }
      const tgt = { x: tp.x + (i - (n - 1) / 2) * 0.3, y: tp.y + (i % 2) * 0.15 };
      const ang = Math.atan2(tgt.y - door.y, tgt.x - door.x);
      if (ph < 0.28) { const u = smooth(ph / 0.28); out.push({ x: lerp(door.x, tgt.x, u), y: lerp(door.y, tgt.y, u), angle: ang, opts: { phase: time * 10 + i, moving: true, time, tool, ...tone(i) } }); }
      else if (ph < 0.62) { const cp = (ph - 0.28) / 0.34; const swings = 3; const sw = (cp * swings) % 1; const key = `${b.id}:${i}`; const idx = Math.floor(cp * swings); if (chopState.get(key) !== idx) { chopState.set(key, idx); if (b.kind === 'woodcutter') { const tr = game.s.trees.find((x) => Math.abs(x.x + 0.5 - tp.x) < 0.6 && Math.abs(x.y + 0.75 - tp.y) < 0.6); if (tr) tr.shake = 1; game.puff(tgt.x, tgt.y - 0.3, 'leaf', 2); } else game.puff(tgt.x, tgt.y - 0.2, 'spark', 2); } out.push({ x: tgt.x, y: tgt.y, angle: ang, opts: { phase: 0, moving: false, time, tool, swing: 1 - Math.abs(sw * 2 - 1), ...tone(i) } }); }
      else if (ph < 0.92) { const u = smooth((ph - 0.62) / 0.3); out.push({ x: lerp(tgt.x, door.x, u), y: lerp(tgt.y, door.y, u), angle: ang + Math.PI, opts: { phase: time * 10 + i, moving: true, time, carry: [res], carryN: b.level + 1, ...tone(i) } }); }
      else out.push({ x: door.x, y: door.y, angle: Math.PI / 2, opts: { phase: 0, moving: false, time, ...tone(i) } });
    }
    return out;
  }
  if (b.kind === 'farm') {
    for (let i = 0; i < n; i++) {
      const T = 14; const ph = ((time / T) + i / n + b.seed) % 1; const row = i % 3;
      const y = b.y + 0.5 + row * 0.6 + 0.1; const back = ph > 0.5; const u = back ? (1 - ph) * 2 : ph * 2; const x = b.x + 0.35 + u * (b.w - 0.8);
      out.push({ x, y, angle: back ? Math.PI : 0, opts: { phase: time * 7 + i, moving: true, time, tool: 'hoe', swing: (Math.sin(time * 6 + i) + 1) / 2 * 0.5, hat: 'straw', ...tone(i) } });
    }
    return out;
  }
  if (b.kind === 'smithy') {
    for (let i = 0; i < n; i++) { const sw = (Math.sin(time * 5 + i * 2.1) + 1) / 2; out.push({ x: b.x + b.w / 2 + (i - (n - 1) / 2) * 0.45, y: b.y + b.h - 0.35, angle: -Math.PI / 2 + (i - (n - 1) / 2) * 0.4, opts: { phase: 0, moving: false, time, tool: 'hammer', swing: b.starved || b.blocked ? 0 : sw, hat: 'cap', ...tone(i), shirt: '#5a4a44' } }); }
    return out;
  }
  if (b.kind === 'barracks') {
    const g = Math.min(b.garrison, 4); if (g === 0) return out;
    for (let i = 0; i < g; i++) { const sx = b.x + 0.5 + (i % 2) * (b.w - 1), sy = b.y + b.h - 0.45 - Math.floor(i / 2) * 0.12; out.push({ x: sx, y: sy, angle: i % 2 ? Math.PI : 0, opts: { phase: 0, moving: false, time, tool: 'spear', hat: 'helmet', shield: true, swing: (Math.sin(time * 4 + i * 1.6) + 1) / 2 * 0.6, shirt: '#8a3b2e', skin: toneColors(i).skin } }); }
    return out;
  }
  if (b.kind === 'storehouse' || b.kind === 'warehouse') {
    if (b.kind === 'warehouse' && n === 0) return out;
    out.push({ x: b.x + b.w - 0.45, y: b.y + b.h - 0.4, angle: Math.PI / 2 + Math.sin(time * 0.7 + b.seed * 5) * 0.8, opts: { phase: 0, moving: false, time, hat: 'cap', shirt: '#6b8fb8', ...{ skin: toneColors(2).skin } } });
    return out;
  }
  if (b.kind === 'donkeypen' || b.kind === 'stable' || b.kind === 'elephantstable') {
    for (let i = 0; i < n; i++) out.push({ x: b.x + b.w * (b.kind === 'stable' ? 0.28 + i * 0.44 : 0.5) + 0.45, y: b.y + b.h - 0.5 + i * 0.1, angle: Math.PI + Math.sin(time + i) * 0.3, opts: { phase: 0, moving: false, time, reach: { side: 1, t: 0.5 + Math.sin(time * 3 + i) * 0.3, res: 'food' }, ...tone(i) } });
    return out;
  }
  return out;
}
