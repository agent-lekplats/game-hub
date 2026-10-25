import { RES_INFO, type ResId, type Stock, type Tree, type Rock, type Particle } from './data';

export type Ctx = CanvasRenderingContext2D;
export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Facing vectors for angle a (0 = east, PI/2 = south/toward viewer). Foreshortened in y. */
export function facing(a: number) {
  const c = Math.cos(a), s = Math.sin(a);
  return { fx: c, fy: s * 0.5, rx: -s, ry: c * 0.5, s, c };
}

export function shadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.28) {
  ctx.fillStyle = `rgba(20,30,20,${alpha})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
}
export function ell(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); ctx.fill();
}
export function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}
export function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, color: string) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
export function shade(hex: string, amt: number): string {
  // amt -1..1 darker/lighter
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; } else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// ---------- cargo ----------
/** Draw a single cargo unit with bottom-center at (x,y). size = width px. */
export function drawUnit(ctx: Ctx, x: number, y: number, size: number, res: ResId, big = 0) {
  const info = RES_INFO[res]; const w = size, h = size * 0.8;
  if (res === 'wood' && big === 0) { // log
    ctx.fillStyle = info.color; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h * 0.75, w, h * 0.7, h * 0.3); ctx.fill();
    ell(ctx, x + w / 2 - h * 0.12, y - h * 0.4, h * 0.22, h * 0.35, info.light); ell(ctx, x + w / 2 - h * 0.12, y - h * 0.4, h * 0.1, h * 0.17, info.dark);
    return;
  }
  if (res === 'food' && big === 0) { // sack
    ctx.fillStyle = info.color; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h, w, h, w * 0.35); ctx.fill();
    ctx.fillStyle = info.light; ctx.beginPath(); ctx.ellipse(x - w * 0.15, y - h * 0.65, w * 0.22, h * 0.2, -0.5, 0, TAU); ctx.fill();
    line(ctx, x - w * 0.25, y - h * 0.85, x + w * 0.25, y - h * 0.85, Math.max(1, w * 0.12), info.dark);
    return;
  }
  // crate
  const top = w * 0.3;
  ctx.fillStyle = info.color; ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = info.light; ctx.fillRect(x - w / 2, y - h - top, w, top);
  ctx.fillStyle = info.dark; ctx.fillRect(x - w / 2, y - h * 0.18, w, h * 0.18);
  if (big >= 1) { ctx.strokeStyle = info.dark; ctx.lineWidth = Math.max(1, w * 0.06); ctx.strokeRect(x - w / 2 + 0.5, y - h + 0.5, w - 1, h - 1); line(ctx, x - w / 2, y - h / 2, x + w / 2, y - h / 2, Math.max(1, w * 0.06), info.dark); }
  if (res === 'weapons') { line(ctx, x - w * 0.25, y - h * 0.75, x + w * 0.25, y - h * 0.3, Math.max(1, w * 0.08), info.light); line(ctx, x + w * 0.25, y - h * 0.75, x - w * 0.25, y - h * 0.3, Math.max(1, w * 0.08), info.light); }
  if (res === 'iron') { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - w * 0.35, y - h - top * 0.7, w * 0.3, top * 0.4); }
  if (res === 'gold') { ell(ctx, x, y - h * 0.55, w * 0.22, w * 0.22, info.light); }
}

/** Draw a stack of `n` units (bottom center) e.g. in hands or on a back. */
export function drawStack(ctx: Ctx, x: number, y: number, size: number, res: ResId[], n: number, lean = 0) {
  const shown = Math.min(n, 5);
  for (let i = 0; i < shown; i++) drawUnit(ctx, x + lean * i, y - i * size * 0.85, size, res[i % res.length] || res[0]);
  if (n > 5) { const t = `${n}`; ctx.font = `bold ${Math.max(8, size * 0.9)}px system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(t, x, y - shown * size * 0.85 - size * 0.5); ctx.fillStyle = '#fff'; ctx.fillText(t, x, y - shown * size * 0.85 - size * 0.5); }
}

export function stockRes(s: Stock): ResId[] { const out: ResId[] = []; for (const k in s) if (s[k as ResId]) out.push(k as ResId); return out.length ? out : ['wood']; }

// ---------- person ----------
export interface PersonOpts {
  phase: number; moving: boolean; carry?: ResId[] | null; carryN?: number; skin?: string; shirt?: string; pants?: string; hair?: string;
  hat?: 'straw' | 'helmet' | 'cap' | null; tool?: 'axe' | 'pick' | 'spear' | 'hoe' | 'hammer' | 'whip' | null; swing?: number; // 0..1 tool raise
  reach?: { side: -1 | 1; t: number; res: ResId } | null; // conveyor hand-off: t 0..1 from behind to ahead
  reach2?: { side: -1 | 1; t: number; res: ResId } | null;
  time: number; alpha?: number; shield?: boolean; scale?: number; sit?: boolean;
}
const SKINS = ['#f2c9a0', '#e0ac7c', '#c98d5e', '#8d5a3b', '#f7d7b5'];
const SHIRTS = ['#3f7dbf', '#c95c4a', '#4a9a5e', '#c9a04a', '#7a5ec9', '#3aa3a0', '#b06aa0', '#8b6a4a'];
export function toneColors(tone: number) { return { skin: SKINS[tone % SKINS.length], shirt: SHIRTS[(tone * 3) % SHIRTS.length], pants: '#4b3d33', hair: ['#3a2a1e', '#7a4a20', '#d9b36b', '#1e1a18', '#a34a2a'][tone % 5] }; }

export function drawPerson(ctx: Ctx, x: number, y: number, k: number, a: number, o: PersonOpts) {
  const s = (k / 48) * (o.scale || 1);
  const { fx, fy, rx, ry } = facing(a);
  const skin = o.skin || SKINS[0], shirt = o.shirt || SHIRTS[0], pants = o.pants || '#4b3d33', hair = o.hair || '#3a2a1e';
  const carrying = !!(o.carry && o.carry.length && (o.carryN || 0) > 0);
  const bob = o.moving ? Math.abs(Math.sin(o.phase)) * 1.3 * s : Math.sin(o.time * 2.2 + x * 0.01) * 0.35 * s;
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  shadow(ctx, x + 1.2 * s, y + 0.8 * s, 6.2 * s, 2.6 * s, 0.26);
  const by = y - 12 * s - bob; // body center
  // legs
  const legs: { hx: number; hy: number; px: number; py: number; depth: number }[] = [];
  for (const side of [-1, 1]) {
    const ph = o.phase + (side < 0 ? Math.PI : 0);
    const off = o.moving ? Math.sin(ph) * 3.2 * s : 0; const lift = o.moving ? Math.max(0, Math.sin(ph)) * 2.2 * s : 0;
    const hx = x + rx * 2.2 * s * side, hy = y - 8 * s + ry * 2.2 * s * side - bob * 0.5;
    legs.push({ hx, hy, px: hx + fx * off, py: y + fy * off - lift + ry * 2.2 * s * side, depth: fy * off });
  }
  legs.sort((p, q) => p.depth - q.depth);
  for (const l of legs) { if (o.sit) continue; line(ctx, l.hx, l.hy, l.px, l.py, 2.8 * s, pants); ell(ctx, l.px, l.py + 0.5 * s, 2 * s, 1.1 * s, '#2e2620'); }
  // arms & carried object, computed with depth
  const shL = { x: x - rx * 4.2 * s, y: by - 4 * s - ry * 4.2 * s }, shR = { x: x + rx * 4.2 * s, y: by - 4 * s + ry * 4.2 * s };
  const items: { depth: number; draw: () => void }[] = [];
  const armCol = shirt;
  const drawArm = (sh: { x: number; y: number }, hx: number, hy: number) => { line(ctx, sh.x, sh.y, hx, hy, 2.6 * s, armCol); ell(ctx, hx, hy, 1.7 * s, 1.5 * s, skin); };
  let handL = { x: shL.x + fx * Math.sin(o.phase + Math.PI) * (o.moving ? 3.5 : 0.5) * s, y: shL.y + 6 * s };
  let handR = { x: shR.x + fx * Math.sin(o.phase) * (o.moving ? 3.5 : 0.5) * s, y: shR.y + 6 * s };
  let depthL = -ry, depthR = ry;
  if (carrying) {
    const hx = x + fx * 5 * s, hy = by + 0.5 * s + fy * 4 * s;
    handL = { x: hx - rx * 2.5 * s, y: hy - ry * 2.5 * s }; handR = { x: hx + rx * 2.5 * s, y: hy + ry * 2.5 * s };
    depthL = depthR = fy;
    const n = o.carryN || 1; const size = 6.5 * s;
    items.push({ depth: fy + 0.01, draw: () => drawStack(ctx, hx, hy + 2 * s, size, o.carry!, n, Math.sin(o.phase) * 0.3 * s) });
  }
  if (o.reach) { // conveyor: right or left hand extends toward item passing on that side
    const r = o.reach; const along = (r.t - 0.5) * 2; // -1 behind .. +1 ahead
    const hx = x + fx * along * 7 * s + rx * r.side * 7 * s, hy = by + 1 * s + fy * along * 7 * s + ry * r.side * 7 * s - Math.sin(r.t * Math.PI) * 2 * s;
    if (r.side > 0) { handR = { x: hx, y: hy }; depthR = fy * along + ry * r.side; } else { handL = { x: hx, y: hy }; depthL = fy * along + ry * r.side; }
  }
  if (o.reach2) {
    const r = o.reach2; const along = (r.t - 0.5) * 2;
    const hx = x + fx * along * 7 * s + rx * r.side * 7 * s, hy = by + 1 * s + fy * along * 7 * s + ry * r.side * 7 * s - Math.sin(r.t * Math.PI) * 2 * s;
    if (r.side > 0) { handR = { x: hx, y: hy }; depthR = fy * along + ry * r.side; } else { handL = { x: hx, y: hy }; depthL = fy * along + ry * r.side; }
  }
  if (o.tool && !carrying) {
    const sw = o.swing || 0; // 0 = down/rest, 1 = raised
    const raise = Math.sin(sw * Math.PI);
    handR = { x: x + rx * 4 * s + fx * (2 + 4 * (1 - sw)) * s, y: by - 2 * s - raise * 9 * s + fy * 3 * s };
    depthR = fy;
    const tl = 10 * s;
    const tipX = handR.x + fx * (1 - raise) * tl * 0.6, tipY = handR.y - raise * tl - (1 - raise) * tl * 0.2 + fy * (1 - raise) * tl * 0.4;
    items.push({ depth: fy + 0.02, draw: () => {
      if (o.tool === 'spear') { line(ctx, handR.x, handR.y + 5 * s, handR.x + fx * 2 * s, handR.y - 14 * s, 1.6 * s, '#8a6a3a'); ell(ctx, handR.x + fx * 2 * s, handR.y - 15 * s, 1.5 * s, 2.5 * s, '#c9d3dc'); return; }
      line(ctx, handR.x, handR.y, tipX, tipY, 1.8 * s, '#7a5a34');
      if (o.tool === 'axe') { ctx.fillStyle = '#9aa5ad'; ctx.beginPath(); ctx.moveTo(tipX, tipY - 2.5 * s); ctx.lineTo(tipX + fx * 4 * s + 1.5 * s, tipY - 1 * s); ctx.lineTo(tipX + fx * 4 * s + 1.5 * s, tipY + 2.5 * s); ctx.lineTo(tipX, tipY + 1.5 * s); ctx.fill(); }
      else if (o.tool === 'pick') { line(ctx, tipX - 4 * s, tipY + 1.5 * s, tipX + 4 * s, tipY + 1.5 * s, 2 * s, '#8b96a0'); }
      else if (o.tool === 'hoe') { line(ctx, tipX, tipY, tipX + fx * 3 * s, tipY + 3 * s, 2.4 * s, '#8b96a0'); }
      else if (o.tool === 'hammer') { rrect(ctx, tipX - 2.5 * s, tipY - 2 * s, 5 * s, 3.5 * s, s, '#6f7a84'); }
      else if (o.tool === 'whip') { ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = s; ctx.beginPath(); ctx.moveTo(handR.x, handR.y); ctx.quadraticCurveTo(tipX + 4 * s, tipY - 6 * s, tipX + 8 * s, tipY + Math.sin(o.time * 6) * 3 * s); ctx.stroke(); }
    } });
  }
  items.push({ depth: depthL, draw: () => drawArm(shL, handL.x, handL.y) });
  items.push({ depth: depthR, draw: () => drawArm(shR, handR.x, handR.y) });
  if (o.shield) items.push({ depth: depthL + 0.01, draw: () => { ell(ctx, handL.x, handL.y - 1 * s, 3.6 * s, 4.2 * s, '#8a3b2e'); ell(ctx, handL.x, handL.y - 1 * s, 1.4 * s, 1.6 * s, '#e0c060'); } });
  // back items
  items.sort((p, q) => p.depth - q.depth);
  for (const it of items) if (it.depth < -0.12) it.draw();
  // body
  const bw = (3.9 + 1.8 * Math.abs(Math.sin(a))) * s;
  if (o.sit) { ell(ctx, x, by + 4 * s, bw * 1.1, 4 * s, pants); }
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(x, by, bw, 6 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(x - bw * 0.3, by - 2 * s, bw * 0.4, 3 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = pants; ctx.beginPath(); ctx.ellipse(x, by + 4 * s, bw * 0.95, 2.4 * s, 0, 0, TAU); ctx.fill();
  // head
  const hx = x + fx * 1.2 * s, hy = by - 9 * s - bob * 0.2;
  ell(ctx, hx - fx * 1.6 * s, hy - 0.6 * s, 4.6 * s, 4.4 * s, hair); // hair mass (back)
  if (Math.sin(a) > -0.45) {
    ell(ctx, hx + fx * 0.5 * s, hy + 0.2 * s, 3.9 * s, 3.9 * s, skin);
    ell(ctx, hx - fx * 1.0 * s, hy - 2.2 * s, 4.2 * s, 2.4 * s, hair); // fringe
    if (fy > -0.05) { const ex = hx + fx * 1.6 * s, ey = hy + 0.6 * s; ell(ctx, ex - rx * 1.6 * s, ey - ry * 1.6 * s, 0.7 * s, 0.9 * s, '#2a1e18'); ell(ctx, ex + rx * 1.6 * s, ey + ry * 1.6 * s, 0.7 * s, 0.9 * s, '#2a1e18'); }
  }
  if (o.hat === 'straw') { ell(ctx, hx, hy - 2.2 * s, 6.5 * s, 2.4 * s, '#d9b45a'); ell(ctx, hx, hy - 3.6 * s, 3.6 * s, 2.4 * s, '#e6c56c'); }
  else if (o.hat === 'helmet') { ell(ctx, hx, hy - 1.5 * s, 4.4 * s, 4 * s, '#8f99a3'); ell(ctx, hx - 1 * s, hy - 3 * s, 2 * s, 1.5 * s, '#c7d0d8'); line(ctx, hx, hy - 5.5 * s, hx - fx * 2 * s, hy - 2 * s, 1.5 * s, '#b03a30'); }
  else if (o.hat === 'cap') { ell(ctx, hx, hy - 2.6 * s, 4.4 * s, 2.4 * s, '#5a3d2a'); }
  for (const it of items) if (it.depth >= -0.12) it.draw();
  if (o.alpha !== undefined) ctx.globalAlpha = 1;
}

// ---------- quadrupeds ----------
export interface QuadSpec { len: number; bodyH: number; bodyR: number; bodyW: number; legLen: number; legW: number; headR: number; headUp: number; neck: number; color: string; dark: string; light: string; ears: 'long' | 'short' | 'elephant'; mane?: boolean; trunk?: boolean; tusks?: boolean; tail: number }
export const DONKEY: QuadSpec = { len: 0.55, bodyH: 0.24, bodyR: 0.1, bodyW: 0.11, legLen: 0.2, legW: 2.2, headR: 0.075, headUp: 0.08, neck: 0.05, color: '#9b8b7a', dark: '#6e6055', light: '#c2b4a3', ears: 'long', tail: 0.12 };
export const HORSE: QuadSpec = { len: 0.7, bodyH: 0.34, bodyR: 0.12, bodyW: 0.13, legLen: 0.3, legW: 2.4, headR: 0.085, headUp: 0.2, neck: 0.1, color: '#8a5a3a', dark: '#5c3a22', light: '#b58058', ears: 'short', mane: true, tail: 0.2 };
export const ELEPHANT: QuadSpec = { len: 1.25, bodyH: 0.5, bodyR: 0.3, bodyW: 0.32, legLen: 0.42, legW: 7, headR: 0.24, headUp: 0.06, neck: 0.02, color: '#8e8a90', dark: '#5f5b64', light: '#b7b3bb', ears: 'elephant', trunk: true, tusks: true, tail: 0.25 };

export interface QuadOpts { phase: number; moving: boolean; headAngle: number; time: number; load?: number; capacity?: number; cargo?: ResId[]; alpha?: number; packs?: boolean; rider?: boolean }

export function drawQuadruped(ctx: Ctx, x: number, y: number, k: number, a: number, sp: QuadSpec, o: QuadOpts) {
  const { fx, fy, rx, ry } = facing(a);
  const hf = facing(o.headAngle);
  const s = k / 48;
  const big = sp.ears === 'elephant';
  const breath = Math.sin(o.time * (big ? 1.2 : 2.5) + x * 0.01) * (big ? 1.5 : 0.6) * s;
  const swayX = big ? Math.sin(o.phase * 0.5) * 1.6 * s : 0;
  const bodyRx = lerp(sp.bodyW * k, (sp.len / 2) * k, Math.abs(Math.cos(a)));
  const bodyRy = sp.bodyR * k + breath * 0.3;
  const bounce = o.moving ? Math.abs(Math.sin(o.phase)) * (big ? 1.5 : 1.2) * s : 0;
  const bc = { x: x + swayX, y: y - sp.bodyH * k - bounce };
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  const shW = lerp(sp.bodyW * 1.3, sp.len * 0.55, Math.abs(Math.cos(a))) * k;
  shadow(ctx, x + 2 * s, y + 1.5 * s, shW, Math.max(sp.bodyW * 0.8 * k, Math.abs(fy) * sp.len * 0.5 * k + sp.bodyW * 0.6 * k), big ? 0.34 : 0.28);
  // legs
  const legs: { bx: number; by: number; fx2: number; fy2: number; depth: number }[] = [];
  for (const dl of [-1, 1]) for (const dw of [-1, 1]) {
    const pair = dl * dw; const ph = o.phase + (pair > 0 ? 0 : Math.PI);
    const off = o.moving ? Math.sin(ph) * sp.len * 0.13 * k : 0; const lift = o.moving ? Math.max(0, Math.sin(ph)) * 3 * s : 0;
    const lx = bc.x + fx * dl * sp.len * 0.33 * k + rx * dw * sp.bodyW * 0.75 * k;
    const ly = bc.y + fy * dl * sp.len * 0.33 * k + ry * dw * sp.bodyW * 0.75 * k + sp.bodyR * 0.4 * k;
    const gx = lx + fx * off, gy = y + fy * (dl * sp.len * 0.33 * k + off) + ry * dw * sp.bodyW * 0.75 * k - lift;
    legs.push({ bx: lx, by: ly, fx2: gx, fy2: gy, depth: fy * dl + ry * dw });
  }
  legs.sort((p, q) => p.depth - q.depth);
  const drawLeg = (l: typeof legs[0]) => { line(ctx, l.bx, l.by, l.fx2, l.fy2, sp.legW * s, sp.dark); if (big) ell(ctx, l.fx2, l.fy2 + 1 * s, sp.legW * 0.6 * s, sp.legW * 0.32 * s, sp.dark); else ell(ctx, l.fx2, l.fy2 + 0.5 * s, 1.6 * s, 1 * s, '#3a302a'); };
  for (const l of legs) if (l.depth < 0) drawLeg(l);
  // tail (behind)
  const tx = bc.x - fx * (sp.len / 2) * k, ty = bc.y - fy * (sp.len / 2) * k;
  const tailSw = Math.sin(o.time * 3 + x) * 3 * s;
  if (fy > -0.3) line(ctx, tx, ty, tx - fx * sp.tail * k * 0.5 + tailSw, ty + sp.tail * k * 0.8, big ? 2.5 * s : 1.6 * s, sp.dark);
  // head behind body?
  const headBehind = fy < -0.3;
  const drawHead = () => {
    const hxp = bc.x + hf.fx * (sp.len / 2 + sp.neck) * k + fx * sp.headR * 0.4 * k, hyp = bc.y + hf.fy * (sp.len / 2 + sp.neck) * k - sp.headUp * k + Math.sin(o.time * 2) * 0.6 * s;
    if (sp.mane) { line(ctx, bc.x + fx * sp.len * 0.35 * k, bc.y + fy * sp.len * 0.35 * k - sp.bodyR * 0.6 * k, hxp, hyp - sp.headR * 0.4 * k, sp.headR * 1.6 * k, sp.color); line(ctx, bc.x + fx * sp.len * 0.35 * k, bc.y + fy * sp.len * 0.35 * k - sp.bodyR * 0.9 * k, hxp - hf.fx * sp.headR * 0.3 * k, hyp - sp.headR * 0.9 * k, sp.headR * 0.6 * k, sp.dark); }
    else line(ctx, bc.x + fx * sp.len * 0.4 * k, bc.y + fy * sp.len * 0.4 * k - sp.bodyR * 0.3 * k, hxp, hyp, sp.headR * 1.5 * k, sp.color); // neck
    if (sp.ears === 'elephant') {
      const flap = 0.75 + 0.25 * Math.sin(o.time * 2.5 + x);
      for (const side of [-1, 1]) { ell(ctx, hxp + hf.rx * side * sp.headR * 0.9 * k, hyp + hf.ry * side * sp.headR * 0.9 * k + 1 * s, sp.headR * 0.85 * k * (0.4 + 0.6 * Math.abs(hf.rx) * flap + 0.2), sp.headR * 0.95 * k, shade(sp.color, -0.12)); }
    }
    ell(ctx, hxp, hyp, sp.headR * k * (0.85 + 0.15 * Math.abs(hf.s)), sp.headR * k * 0.9, sp.color);
    ell(ctx, hxp - hf.fx * sp.headR * 0.3 * k, hyp - sp.headR * 0.35 * k, sp.headR * 0.55 * k, sp.headR * 0.4 * k, sp.light);
    // muzzle / trunk
    if (sp.trunk) {
      const tx0 = hxp + hf.fx * sp.headR * 0.6 * k, ty0 = hyp + hf.fy * sp.headR * 0.6 * k + sp.headR * 0.3 * k;
      const sw = Math.sin(o.time * 2 + o.phase * 0.3) * 4 * s;
      ctx.strokeStyle = sp.color; ctx.lineWidth = sp.headR * 0.55 * k; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx0, ty0);
      ctx.quadraticCurveTo(tx0 + hf.fx * sp.headR * 1.4 * k + sw, ty0 + sp.headR * 1.0 * k, tx0 + hf.fx * sp.headR * 1.2 * k + sw * 1.5 + hf.rx * sw * 0.3, ty0 + sp.headR * 2.1 * k); ctx.stroke();
      ctx.lineWidth = sp.headR * 0.3 * k; ctx.strokeStyle = shade(sp.color, -0.15); ctx.stroke();
      if (sp.tusks && hf.fy > -0.4) for (const side of [-1, 1]) { ctx.strokeStyle = '#f3ecd8'; ctx.lineWidth = 2.4 * s; ctx.beginPath(); const sx0 = hxp + hf.fx * sp.headR * 0.5 * k + hf.rx * side * sp.headR * 0.5 * k, sy0 = hyp + sp.headR * 0.5 * k; ctx.moveTo(sx0, sy0); ctx.quadraticCurveTo(sx0 + hf.fx * sp.headR * 0.9 * k, sy0 + sp.headR * 0.6 * k, sx0 + hf.fx * sp.headR * 1.1 * k, sy0 - sp.headR * 0.1 * k); ctx.stroke(); }
    } else {
      ell(ctx, hxp + hf.fx * sp.headR * 0.8 * k, hyp + hf.fy * sp.headR * 0.8 * k + sp.headR * 0.3 * k, sp.headR * 0.65 * k, sp.headR * 0.5 * k, sp.light);
    }
    if (sp.ears !== 'elephant') { const el = sp.ears === 'long' ? 1.3 : 0.7; for (const side of [-1, 1]) { const ex = hxp + hf.rx * side * sp.headR * 0.7 * k, ey = hyp + hf.ry * side * sp.headR * 0.7 * k - sp.headR * 0.8 * k; ctx.fillStyle = sp.color; ctx.beginPath(); ctx.ellipse(ex, ey - sp.headR * el * 0.4 * k, sp.headR * 0.3 * k, sp.headR * el * 0.55 * k, side * 0.3, 0, TAU); ctx.fill(); } }
    // eyes
    if (hf.fy > -0.2) for (const side of [-1, 1]) ell(ctx, hxp + hf.fx * sp.headR * 0.35 * k + hf.rx * side * sp.headR * 0.55 * k, hyp + hf.ry * side * sp.headR * 0.55 * k - sp.headR * 0.1 * k, 1 * s * (big ? 1.6 : 1), 1.2 * s * (big ? 1.6 : 1), '#1e1a18');
  };
  if (headBehind) drawHead();
  // body
  ctx.fillStyle = sp.color; ctx.beginPath(); ctx.ellipse(bc.x, bc.y, bodyRx, bodyRy, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.ellipse(bc.x - bodyRx * 0.25, bc.y - bodyRy * 0.35, bodyRx * 0.5, bodyRy * 0.35, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.beginPath(); ctx.ellipse(bc.x, bc.y + bodyRy * 0.55, bodyRx * 0.9, bodyRy * 0.4, 0, 0, TAU); ctx.fill();
  // cargo
  const load = o.load || 0, cap = o.capacity || 1; const cargo = o.cargo && o.cargo.length ? o.cargo : ['wood' as ResId];
  if (o.packs) { // donkey side packs
    const n = load > 0 ? clamp(Math.ceil((load / cap) * 4), 1, 4) : 0;
    const bagY = bc.y - bodyRy * 0.2;
    line(ctx, bc.x - rx * sp.bodyW * k, bagY - bodyRy * 0.8 - ry * sp.bodyW * k, bc.x + rx * sp.bodyW * k, bagY - bodyRy * 0.8 + ry * sp.bodyW * k, 2 * s, '#6a4a2a');
    for (const side of [-1, 1]) {
      const px = bc.x + rx * side * (sp.bodyW * k + 2 * s), py = bagY + ry * side * (sp.bodyW * k + 2 * s);
      const depth = ry * side;
      if (depth < 0 && Math.abs(rx) < 0.35) continue; // hidden behind body when facing N/S
      ell(ctx, px, py, 4.5 * s, 4.5 * s, '#7c5a3a');
      for (let i = 0; i < Math.min(n, 3); i++) drawUnit(ctx, px + (i - 1) * 2 * s * Math.abs(rx), py - 2 * s - i * 2.5 * s * (1 - Math.abs(rx)) - (Math.abs(rx) < 0.5 ? i * 2 * s : 0), 5 * s, cargo[i % cargo.length]);
    }
  } else if (big) { // elephant howdah with crate pyramid
    const platY = bc.y - bodyRy - 2 * s;
    const pw = lerp(sp.bodyW * 1.5, sp.len * 0.6, Math.abs(Math.cos(a))) * k;
    rrect(ctx, bc.x - pw / 2, platY - 3 * s, pw, 6 * s, 2 * s, '#8a3b2e'); rrect(ctx, bc.x - pw / 2, platY - 3 * s, pw, 2 * s, 1 * s, '#c9a24a');
    line(ctx, bc.x - pw / 2, platY, bc.x - pw / 2, bc.y + bodyRy * 0.9, 2 * s, '#4a2a1a'); line(ctx, bc.x + pw / 2, platY, bc.x + pw / 2, bc.y + bodyRy * 0.9, 2 * s, '#4a2a1a');
    const frac = load / cap; const rows = load > 0 ? clamp(Math.ceil(frac * 3), 1, 3) : 0;
    const cols = 3; const cw = Math.min(10 * s, pw / 3.3);
    const lean = Math.sin(o.phase * 0.5) * 1.2 * s;
    for (let r = 0; r < rows; r++) { const nc = cols - r; for (let c = 0; c < nc; c++) { const cx = bc.x + (c - (nc - 1) / 2) * cw * 1.05 + lean * r; const cy = platY - 3 * s - r * cw * 0.85; drawUnit(ctx, cx, cy, cw, cargo[(r + c) % cargo.length], 2); } }
    if (o.rider) drawPerson(ctx, bc.x + fx * sp.len * 0.28 * k, bc.y - bodyRy + 4 * s + fy * sp.len * 0.28 * k, k * 0.85, a, { phase: 0, moving: false, time: o.time, hat: 'cap', tool: 'whip', shirt: '#c9a04a', sit: true });
  }
  if (!headBehind) drawHead();
  for (const l of legs) if (l.depth >= 0) drawLeg(l);
  if (fy <= -0.3) line(ctx, tx, ty, tx - fx * sp.tail * k * 0.5 + tailSw, ty + sp.tail * k * 0.8, big ? 2.5 * s : 1.6 * s, sp.dark);
  if (o.alpha !== undefined) ctx.globalAlpha = 1;
}

/** Ground-plane rectangle corners (rotated by facing), returns screen points. */
function groundQuad(x: number, y: number, k: number, a: number, L: number, W: number) {
  const { fx, fy, rx, ry } = facing(a);
  const hl = (L / 2) * k, hw = (W / 2) * k;
  return [
    { x: x + fx * hl + rx * hw, y: y + fy * hl + ry * hw }, { x: x + fx * hl - rx * hw, y: y + fy * hl - ry * hw },
    { x: x - fx * hl - rx * hw, y: y - fy * hl - ry * hw }, { x: x - fx * hl + rx * hw, y: y - fy * hl + ry * hw },
  ];
}
/** Extruded box from rotated ground quad. */
export function drawBox3D(ctx: Ctx, x: number, y: number, k: number, a: number, L: number, W: number, h: number, color: string) {
  const q = groundQuad(x, y, k, a, L, W);
  const top = q.map((p) => ({ x: p.x, y: p.y - h }));
  // visible side faces: edges whose outward normal points toward viewer (positive y)
  for (let i = 0; i < 4; i++) {
    const p1 = q[i], p2 = q[(i + 1) % 4]; const nx = p2.y - p1.y, ny = -(p2.x - p1.x);
    // quad winding: outward normal for CW screen ordering
    if (ny <= 0) continue;
    const shadeAmt = -0.25 + 0.15 * (Math.abs(nx) / (Math.hypot(nx, ny) || 1));
    ctx.fillStyle = shade(color, shadeAmt); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(top[(i + 1) % 4].x, top[(i + 1) % 4].y); ctx.lineTo(top[i].x, top[i].y); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = shade(color, 0.12); ctx.beginPath(); ctx.moveTo(top[0].x, top[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(top[i].x, top[i].y); ctx.closePath(); ctx.fill();
  return { q, top };
}

export interface WagonOpts { phase: number; dist: number; moving: boolean; headAngle: number; time: number; load: number; capacity: number; cargo: ResId[]; alpha?: number; driver?: boolean }
export function drawWagon(ctx: Ctx, x: number, y: number, k: number, a: number, o: WagonOpts) {
  const { fx, fy, rx, ry } = facing(a); const s = k / 48;
  const L = 0.85, W = 0.46, wr = 0.13 * k;
  // entity position sits between horse and cart so the whole rig stays centred on its tile
  const horseX = x + fx * 0.5 * k, horseY = y + fy * 0.5 * k;
  x = x - fx * 0.5 * k; y = y - fy * 0.5 * k;
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  const drawCart = () => {
    shadow(ctx, x + 2 * s, y + 2 * s, lerp(W * 0.6, L * 0.55, Math.abs(Math.cos(a))) * k, lerp(L * 0.28, W * 0.6, Math.abs(Math.cos(a))) * k, 0.3);
    const wheels: { x: number; y: number; depth: number }[] = [];
    for (const dl of [-1, 1]) for (const dw of [-1, 1]) wheels.push({ x: x + fx * dl * L * 0.32 * k + rx * dw * (W / 2 + 0.03) * k, y: y + fy * dl * L * 0.32 * k + ry * dw * (W / 2 + 0.03) * k, depth: ry * dw });
    const wheelRx = Math.max(wr * 0.18, wr * Math.abs(Math.cos(a)));
    const spin = o.dist * k / wr;
    const drawWheel = (w: { x: number; y: number }) => {
      ell(ctx, w.x, w.y - wr, wheelRx + 1.2 * s, wr + 1.2 * s, '#3e2c1e'); ell(ctx, w.x, w.y - wr, wheelRx, wr, '#8a6a44');
      ctx.strokeStyle = '#3e2c1e'; ctx.lineWidth = 1.2 * s; for (let i = 0; i < 3; i++) { const an = spin + (i * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(w.x + Math.cos(an) * wheelRx, w.y - wr + Math.sin(an) * wr); ctx.lineTo(w.x - Math.cos(an) * wheelRx, w.y - wr - Math.sin(an) * wr); ctx.stroke(); }
      ell(ctx, w.x, w.y - wr, 1.5 * s, 1.5 * s, '#3e2c1e');
    };
    for (const w of wheels) if (w.depth < 0) drawWheel(w);
    const bob = o.moving ? Math.sin(o.phase * 2) * 0.8 * s : 0;
    const { top } = drawBox3D(ctx, x, y - wr * 0.9 - bob, k, a, L, W, 8 * s, '#a4703f');
    // cargo grid on the bed
    const frac = o.load / o.capacity; const n = o.load > 0 ? clamp(Math.ceil(frac * 8), 1, 8) : 0;
    const cw = 7 * s; const cargo = o.cargo.length ? o.cargo : ['wood' as ResId];
    const units: { x: number; y: number; i: number; depth: number; lvl: number }[] = [];
    for (let i = 0; i < n; i++) { const lvl = i >= 6 ? 1 : 0; const j = lvl ? i - 6 : i; const col = j % 3, row = Math.floor(j / 3); const dl = (col - 1) * L * 0.3, dw = (row - 0.5) * W * 0.45 * (lvl ? 0 : 1); units.push({ x: x + fx * dl * k + rx * dw * k, y: y - wr * 0.9 - bob - 8 * s + fy * dl * k + ry * dw * k, i, depth: fy * dl + ry * dw, lvl }); }
    units.sort((p, q) => p.depth - q.depth);
    for (const u of units) drawUnit(ctx, u.x, u.y - u.lvl * cw * 0.85 + 1 * s, cw, cargo[u.i % cargo.length], 1);
    if (o.driver) drawPerson(ctx, top[3].x * 0.5 + top[0].x * 0.5 - fx * 2 * s, top[3].y * 0.5 + top[0].y * 0.5 + 6 * s, k * 0.8, a, { phase: 0, moving: false, time: o.time, hat: 'straw', shirt: '#6b8fb8', sit: true, tool: 'whip' });
    for (const w of wheels) if (w.depth >= 0) drawWheel(w);
    // shafts to horse
    line(ctx, x + fx * L * 0.5 * k + rx * 5 * s, y - wr * 0.6 + fy * L * 0.5 * k + ry * 5 * s, horseX - fx * 0.3 * k + rx * 5 * s, horseY - wr + ry * 5 * s - fy * 0.3 * k, 1.5 * s, '#5a3d24');
    line(ctx, x + fx * L * 0.5 * k - rx * 5 * s, y - wr * 0.6 + fy * L * 0.5 * k - ry * 5 * s, horseX - fx * 0.3 * k - rx * 5 * s, horseY - wr + ry * 5 * s - fy * 0.3 * k, 1.5 * s, '#5a3d24');
  };
  const drawHorse = () => drawQuadruped(ctx, horseX, horseY, k, a, HORSE, { phase: o.phase, moving: o.moving, headAngle: o.headAngle, time: o.time });
  if (fy < 0) { drawHorse(); drawCart(); } else { drawCart(); drawHorse(); }
  if (o.alpha !== undefined) ctx.globalAlpha = 1;
}

// ---------- nature ----------
export function drawTree(ctx: Ctx, x: number, y: number, k: number, t: Tree, time: number) {
  const s = (k / 48) * t.size;
  const sway = Math.sin(time * 1.1 + t.phase) * 1.2 * s + (t.shake > 0 ? Math.sin(time * 40) * 3 * s * t.shake : 0);
  shadow(ctx, x + 4 * s, y + 2 * s, 11 * s, 4.5 * s, 0.22);
  const trunk = '#6b4a2e';
  if (t.kind === 1) { // pine
    line(ctx, x, y, x + sway * 0.3, y - 14 * s, 3.5 * s, trunk);
    const cols = ['#2f6b3a', '#3a7d45', '#4b9457'];
    for (let i = 0; i < 3; i++) { const w = (16 - i * 4) * s, ty = y - 8 * s - i * 8 * s; ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(x - w / 2 + sway * i * 0.3, ty); ctx.lineTo(x + w / 2 + sway * i * 0.3, ty); ctx.lineTo(x + sway * (i + 1) * 0.4, ty - 11 * s); ctx.closePath(); ctx.fill(); }
    return;
  }
  line(ctx, x, y, x + sway * 0.4, y - 13 * s, 4 * s, trunk);
  const base = t.kind === 2 ? ['#4f8a3a', '#66a04a', '#86bd60'] : ['#3d7f3f', '#4f9a4e', '#72b866'];
  ell(ctx, x + 3 * s + sway * 0.7, y - 18 * s, 11 * s, 9 * s, base[0]);
  ell(ctx, x - 3 * s + sway * 0.8, y - 20 * s, 10 * s, 8.5 * s, base[1]);
  ell(ctx, x - 1 * s + sway, y - 25 * s, 8 * s, 6.5 * s, base[2]);
  ell(ctx, x - 4 * s + sway, y - 27 * s, 3.5 * s, 2.5 * s, 'rgba(255,255,255,0.22)');
}
export function drawRock(ctx: Ctx, x: number, y: number, k: number, r: Rock) {
  const s = (k / 48) * r.size;
  shadow(ctx, x + 3 * s, y + 2 * s, 12 * s, 5 * s, 0.25);
  const base = r.ore ? '#7a6a62' : '#8f959b', light = r.ore ? '#a08e84' : '#b9c0c6', dark = r.ore ? '#5a4d47' : '#646b72';
  ctx.fillStyle = base; ctx.beginPath(); ctx.moveTo(x - 12 * s, y); ctx.lineTo(x - 9 * s, y - 9 * s); ctx.lineTo(x - 2 * s, y - 14 * s); ctx.lineTo(x + 7 * s, y - 11 * s); ctx.lineTo(x + 12 * s, y - 3 * s); ctx.lineTo(x + 10 * s, y + 1 * s); ctx.lineTo(x - 10 * s, y + 1 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(x - 9 * s, y - 9 * s); ctx.lineTo(x - 2 * s, y - 14 * s); ctx.lineTo(x + 7 * s, y - 11 * s); ctx.lineTo(x + 1 * s, y - 7 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(x + 1 * s, y - 7 * s); ctx.lineTo(x + 7 * s, y - 11 * s); ctx.lineTo(x + 12 * s, y - 3 * s); ctx.lineTo(x + 10 * s, y + 1 * s); ctx.lineTo(x + 3 * s, y + 1 * s); ctx.closePath(); ctx.fill();
  if (r.kind === 1) ell(ctx, x - 12 * s, y - 1 * s, 5 * s, 3.5 * s, base);
  if (r.ore) { for (let i = 0; i < 5; i++) { const ox = x + Math.sin(i * 2.4 + r.kind) * 7 * s, oy = y - 4 * s - Math.abs(Math.cos(i * 1.7)) * 7 * s; ell(ctx, ox, oy, 1.8 * s, 1.4 * s, '#d9782a'); ell(ctx, ox - 0.5 * s, oy - 0.5 * s, 0.7 * s, 0.6 * s, '#ffd08a'); } }
}

// ---------- particles ----------
export function drawParticle(ctx: Ctx, p: Particle, sx: number, sy: number, k: number) {
  const t = p.life / p.max; const s = k / 48;
  switch (p.kind) {
    case 'smoke': ctx.fillStyle = `rgba(200,200,205,${0.45 * (1 - t)})`; ctx.beginPath(); ctx.arc(sx, sy - p.z * k, p.size * s * (0.6 + t), 0, TAU); ctx.fill(); break;
    case 'dust': ctx.fillStyle = `rgba(190,170,130,${0.4 * (1 - t)})`; ctx.beginPath(); ctx.arc(sx, sy - p.z * k * 0.5, p.size * s * (0.5 + t * 1.5), 0, TAU); ctx.fill(); break;
    case 'spark': ctx.fillStyle = `rgba(255,${180 - t * 120},60,${1 - t})`; ctx.beginPath(); ctx.arc(sx, sy - p.z * k, 1.6 * s, 0, TAU); ctx.fill(); break;
    case 'leaf': ctx.fillStyle = `rgba(110,170,80,${1 - t})`; ctx.beginPath(); ctx.ellipse(sx, sy - p.z * k, 2.2 * s, 1.3 * s, p.life * 5, 0, TAU); ctx.fill(); break;
    case 'star': { ctx.fillStyle = `rgba(255,230,120,${1 - t})`; const r = 2.5 * s; const cx = sx, cy = sy - p.z * k; ctx.beginPath(); for (let i = 0; i < 8; i++) { const an = (i * Math.PI) / 4 + p.life * 3; const rr = i % 2 ? r * 0.4 : r; ctx.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); } ctx.closePath(); ctx.fill(); break; }
    case 'ring': ctx.strokeStyle = `rgba(255,255,255,${1 - t})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, p.size * s * (1 + t * 3), p.size * s * 0.5 * (1 + t * 3), 0, 0, TAU); ctx.stroke(); break;
    case 'text': {
      const a = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3; ctx.globalAlpha = a; ctx.font = `bold ${Math.round(12 * p.size * Math.max(0.7, k / 48))}px system-ui, sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.strokeText(p.text || '', sx, sy - p.z * k); ctx.fillStyle = p.color || '#fff'; ctx.fillText(p.text || '', sx, sy - p.z * k); ctx.globalAlpha = 1; break;
    }
  }
}
