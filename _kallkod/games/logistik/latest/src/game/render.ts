// ---------- canvas renderer: a living miniature world (hyper-juicy edition) ----------
import { WORLD, RES_META, UNITS, ENEMIES, PLOTS, BUILDINGS } from "./data";
import { NODE_DEF } from "./world";
import { canAfford } from "./state";
import type { GameState, NodeEnt, WorkerEnt, UnitEnt, EnemyEnt, BuildingEnt } from "./state";
import { clamp, lerp } from "./util";
import { dayFactor } from "./logic";

// ---------- ground cache ----------
let groundCache: { seed: number; cvs: HTMLCanvasElement } | null = null;

function groundCanvas(seed: number): HTMLCanvasElement {
  if (groundCache && groundCache.seed === seed) return groundCache.cvs;
  const cvs = document.createElement("canvas");
  cvs.width = WORLD.w;
  cvs.height = WORLD.h;
  const g = cvs.getContext("2d")!;
  // base
  const grad = g.createLinearGradient(0, 0, WORLD.w, WORLD.h);
  grad.addColorStop(0, "#a89a6c");
  grad.addColorStop(0.5, "#9c8f66");
  grad.addColorStop(1, "#8d8160");
  g.fillStyle = grad;
  g.fillRect(0, 0, WORLD.w, WORLD.h);
  // meadow blobs
  let rngState = seed >>> 0;
  const rnd = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  };
  for (let i = 0; i < 420; i++) {
    const x = rnd() * WORLD.w;
    const y = rnd() * WORLD.h;
    const r = 30 + rnd() * 120;
    const ashen = x > 1450;
    const gg = g.createRadialGradient(x, y, 0, x, y, r);
    const col = ashen
      ? `rgba(${120 + rnd() * 20 | 0},${112 + rnd() * 18 | 0},${100 + rnd() * 16 | 0},0.16)`
      : `rgba(${96 + rnd() * 30 | 0},${126 + rnd() * 34 | 0},${62 + rnd() * 20 | 0},0.15)`;
    gg.addColorStop(0, col);
    gg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // speckle
  for (let i = 0; i < 2400; i++) {
    const x = rnd() * WORLD.w;
    const y = rnd() * WORLD.h;
    g.fillStyle = rnd() < 0.5 ? "rgba(60,50,30,0.05)" : "rgba(255,240,200,0.04)";
    g.fillRect(x, y, 2 + rnd() * 3, 2 + rnd() * 3);
  }
  // ashen frontier wash
  const ashGrad = g.createLinearGradient(1400, 0, 1900, 0);
  ashGrad.addColorStop(0, "rgba(90,80,76,0)");
  ashGrad.addColorStop(1, "rgba(88,78,74,0.4)");
  g.fillStyle = ashGrad;
  g.fillRect(1400, 0, WORLD.w - 1400, WORLD.h);
  // scorched far east
  const sc = g.createLinearGradient(2100, 0, WORLD.w, 0);
  sc.addColorStop(0, "rgba(50,40,38,0)");
  sc.addColorStop(1, "rgba(46,38,36,0.5)");
  g.fillStyle = sc;
  g.fillRect(2050, 0, WORLD.w - 2050, WORLD.h);
  // the road
  g.strokeStyle = "rgba(146,118,74,0.55)";
  g.lineCap = "round";
  g.lineWidth = 26;
  g.beginPath();
  g.moveTo(WORLD.stockX - 30, WORLD.stockY);
  g.quadraticCurveTo(800, WORLD.stockY + 26, WORLD.rallyX + 60, WORLD.rallyY);
  g.stroke();
  g.strokeStyle = "rgba(120,95,58,0.5)";
  g.lineWidth = 18;
  g.beginPath();
  g.moveTo(WORLD.stockX - 30, WORLD.stockY);
  g.quadraticCurveTo(800, WORLD.stockY + 26, WORLD.rallyX + 60, WORLD.rallyY);
  g.stroke();
  // wheel ruts
  g.strokeStyle = "rgba(90,70,44,0.35)";
  g.lineWidth = 3;
  for (const off of [-6, 6]) {
    g.beginPath();
    g.moveTo(WORLD.stockX - 30, WORLD.stockY + off);
    g.quadraticCurveTo(800, WORLD.stockY + 26 + off, WORLD.rallyX + 60, WORLD.rallyY + off);
    g.stroke();
  }
  groundCache = { seed, cvs };
  return cvs;
}

export function screenToWorld(s: GameState, sx: number, sy: number, vw: number, vh: number) {
  const z = s.cam.tz;
  return {
    x: (sx - vw / 2) / z + s.cam.tx,
    y: (sy - vh / 2) / z + s.cam.ty,
  };
}

// ---------- main draw ----------
export function drawScene(ctx: CanvasRenderingContext2D, s: GameState, vw: number, vh: number) {
  const t = s.time;
  const z = s.cam.z * (1 + (s.cam.zoomPunch ?? 0));
  const shx = (Math.random() - 0.5) * s.cam.shake + (s.cam.kickX ?? 0);
  const shy = (Math.random() - 0.5) * s.cam.shake + (s.cam.kickY ?? 0);
  ctx.clearRect(0, 0, vw, vh);
  ctx.save();
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(z, z);
  ctx.translate(-s.cam.x + shx, -s.cam.y + shy);

  const day = dayFactor(s);

  // ground
  ctx.drawImage(groundCanvas(s.seed), 0, 0);

  // claimed territory warmth
  const claim = ctx.createLinearGradient(s.frontX - 400, 0, s.frontX, 0);
  claim.addColorStop(0, "rgba(255,180,90,0)");
  claim.addColorStop(1, "rgba(255,180,90,0.05)");
  ctx.fillStyle = claim;
  ctx.fillRect(0, 0, s.frontX, WORLD.h);

  // battle scorch band just east of the line
  const band = ctx.createLinearGradient(s.frontX, 0, s.frontX + 150, 0);
  band.addColorStop(0, "rgba(60,44,40,0.4)");
  band.addColorStop(1, "rgba(60,44,40,0)");
  ctx.fillStyle = band;
  ctx.fillRect(s.frontX, 0, 150, WORLD.h);

  drawDecor(ctx, s, t);
  drawCloudShadows(ctx, s);
  drawFront(ctx, s, t);
  drawRally(ctx, s, t);
  drawHordeGate(ctx, t);
  drawHoverReticle(ctx, s, t);
  drawRings(ctx, s);

  // depth-sorted entities
  type D = { y: number; f: () => void };
  const list: D[] = [];
  for (const n of s.nodes) list.push({ y: n.y + 8, f: () => drawNode(ctx, s, n, t) });
  let bi = 0;
  for (const b of s.buildingEnts) {
    const idx = bi++;
    list.push({ y: b.y + 30, f: () => drawBuilding(ctx, s, b, idx, t, day) });
  }
  list.push({ y: WORLD.stockY + 40, f: () => drawStockpile(ctx, s, t, day) });
  for (const w of s.workers) list.push({ y: w.y + 6, f: () => drawWorker(ctx, s, w, t) });
  for (const u of s.units) list.push({ y: u.y + 8, f: () => drawUnit(ctx, s, u, t) });
  for (const e of s.enemies) list.push({ y: e.y + 8, f: () => drawEnemy(ctx, s, e, t) });
  list.sort((a, b2) => a.y - b2.y);
  for (const d of list) d.f();

  drawPlots(ctx, s, t);
  drawSlashes(ctx, s);
  drawBolts(ctx, s);
  drawProjectiles(ctx, s);
  drawOrbs(ctx, s, t);
  drawParticles(ctx, s);
  drawBirds(ctx, s, t);
  drawClouds(ctx, s, day);
  drawFloats(ctx, s);

  ctx.restore();

  // day / night grade (screen space)
  const night = 1 - day;
  if (night > 0.03) {
    ctx.fillStyle = `rgba(22,18,48,${0.4 * night})`;
    ctx.fillRect(0, 0, vw, vh);
  }
  const dusk = clamp(1 - Math.abs(day - 0.45) * 3.4, 0, 1);
  if (dusk > 0.02) {
    const dg = ctx.createLinearGradient(vw, 0, 0, 0);
    dg.addColorStop(0, `rgba(255,110,40,${0.1 * dusk})`);
    dg.addColorStop(1, "rgba(255,110,40,0)");
    ctx.fillStyle = dg;
    ctx.fillRect(0, 0, vw, vh);
  }

  // impact flash overlay (screen space)
  if (s.cam.flash && s.cam.flash > 0.005) {
    const fg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.2, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    fg.addColorStop(0, "rgba(255,255,255,0)");
    fg.addColorStop(1, s.cam.flashColor ?? "#ffd89a");
    ctx.save();
    ctx.globalAlpha = s.cam.flash;
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }
}

// ---------- hover reticle ----------
function drawHoverReticle(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  let tx = 0;
  let ty = 0;
  let col = "#ffd86b";
  let r = 22;
  if (s.hoverWorld.enemyId !== null) {
    const e = s.enemies.find((x) => x.id === s.hoverWorld.enemyId);
    if (!e || e.hp <= 0) return;
    tx = e.x;
    ty = e.y - 6;
    col = "#ff6a4d";
    r = 22 * ENEMIES[e.type].scale;
  } else if (s.hoverWorld.nodeId !== null) {
    const n = s.nodes.find((x) => x.id === s.hoverWorld.nodeId);
    if (!n || n.amount <= 0) return;
    tx = n.x;
    ty = n.y - 4;
    col = "#ffe08a";
    r = 23;
  } else {
    return;
  }
  const pulse = 1 + Math.sin(t * 8) * 0.08;
  ctx.save();
  ctx.translate(tx, ty);
  ctx.scale(1, 0.55);
  ctx.rotate(t * 1.8);
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.2;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ---------- decor ----------
function drawDecor(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  const wind = Math.sin(t * 0.7) * 0.6 + Math.sin(t * 1.7) * 0.4;
  for (const g of s.decor.grass) {
    const sway = Math.sin(t * 1.6 + g.ph) * 2.2 * g.s * (1 + wind * 0.5);
    ctx.strokeStyle = g.x > 1450 ? "rgba(110,104,88,0.55)" : "rgba(84,116,58,0.6)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.quadraticCurveTo(g.x + sway * 0.4, g.y - 5 * g.s, g.x + sway, g.y - 9 * g.s);
    ctx.moveTo(g.x + 3, g.y);
    ctx.quadraticCurveTo(g.x + 3 + sway * 0.3, g.y - 4 * g.s, g.x + 3 + sway * 0.8, g.y - 7 * g.s);
    ctx.stroke();
  }
  for (const f of s.decor.flowers) {
    ctx.fillStyle = f.c;
    ctx.beginPath();
    ctx.arc(f.x, f.y - 3, 2.2 * f.s, 0, 6.28);
    ctx.arc(f.x + 2 * f.s, f.y - 2, 1.7 * f.s, 0, 6.28);
    ctx.fill();
    ctx.strokeStyle = "rgba(80,110,60,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.lineTo(f.x, f.y - 3);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(90,86,76,0.5)";
  for (const p of s.decor.pebbles) {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.s * 1.6, p.s, p.a, 0, 6.28);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(66,58,54,0.45)";
  for (const a of s.decor.ash) {
    ctx.fillRect(a.x, a.y, a.s * 1.8, a.s);
  }
}

function drawCloudShadows(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.fillStyle = "rgba(40,40,30,0.08)";
  for (const c of s.decor.clouds) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 300, c.s * 1.3, c.s * 0.5, 0, 0, 6.28);
    ctx.fill();
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, s: GameState, day: number) {
  const a = 0.1 + day * 0.14;
  ctx.fillStyle = `rgba(255,250,240,${a})`;
  for (const c of s.decor.clouds) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.s, c.s * 0.42, 0, 0, 6.28);
    ctx.ellipse(c.x + c.s * 0.5, c.y + 6, c.s * 0.6, c.s * 0.3, 0, 0, 6.28);
    ctx.ellipse(c.x - c.s * 0.5, c.y + 8, c.s * 0.55, c.s * 0.28, 0, 0, 6.28);
    ctx.fill();
  }
}

function drawBirds(ctx: CanvasRenderingContext2D, s: GameState, _t: number) {
  ctx.strokeStyle = "rgba(60,50,40,0.8)";
  ctx.lineWidth = 1.6;
  for (const b of s.decor.birds) {
    const w = Math.sin(b.ph) * 4;
    ctx.beginPath();
    ctx.moveTo(b.x - 5, b.y - w);
    ctx.quadraticCurveTo(b.x, b.y + 2, b.x + 5, b.y - w);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x - 15, b.y - 6 - w * 0.7);
    ctx.quadraticCurveTo(b.x - 10, b.y - 4, b.x - 5, b.y - 6 - w * 0.7);
    ctx.stroke();
  }
}

// ---------- the front ----------
function drawFront(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  const x = s.frontX;
  ctx.strokeStyle = `rgba(255,190,120,${0.2 + (s.frontAnim > 0 ? 0.5 * s.frontAnim : 0)})`;
  ctx.lineWidth = 2 + (s.frontAnim > 0 ? s.frontAnim * 2 : 0);
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(x, 160);
  ctx.lineTo(x, WORLD.h - 120);
  ctx.stroke();
  ctx.setLineDash([]);
  // torches along the line
  for (let y = 210; y < WORLD.h - 160; y += 90) {
    ctx.strokeStyle = "#5c4630";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 18);
    ctx.stroke();
    const fl = 0.8 + Math.sin(t * 9 + y) * 0.2;
    ctx.fillStyle = "rgba(255,150,60,0.25)";
    ctx.beginPath();
    ctx.arc(x, y - 22, 9 * fl, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = "#ffb25e";
    ctx.beginPath();
    ctx.arc(x, y - 22, 3.4 * fl, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = "#ffe3a8";
    ctx.beginPath();
    ctx.arc(x, y - 23, 1.6 * fl, 0, 6.28);
    ctx.fill();
  }
  // the war banner
  const bx = x;
  const by = WORLD.h / 2 + 10;
  ctx.strokeStyle = "#4a3826";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx, by - 96);
  ctx.stroke();
  const wav = (o: number) => Math.sin(t * 3.2 + o) * 6;
  ctx.fillStyle = "#c9541e";
  ctx.beginPath();
  ctx.moveTo(bx, by - 96);
  ctx.quadraticCurveTo(bx + 30, by - 92 + wav(0), bx + 56 + wav(1), by - 84 + wav(2));
  ctx.quadraticCurveTo(bx + 34, by - 76 + wav(3), bx, by - 62);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#7e2f0e";
  ctx.beginPath();
  ctx.moveTo(bx + 8, by - 88);
  ctx.lineTo(bx + 20 + wav(1) * 0.4, by - 79);
  ctx.lineTo(bx + 8, by - 70);
  ctx.closePath();
  ctx.fill();
  ctx.font = "600 11px Sora";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,220,170,0.55)";
  ctx.letterSpacing = "4px";
  ctx.fillText("T H E   L I N E", x, 178);
  ctx.letterSpacing = "0px";
}

function drawHordeGate(ctx: CanvasRenderingContext2D, t: number) {
  const x = WORLD.enemyX + 20;
  const y = WORLD.h / 2;
  ctx.fillStyle = "#241d20";
  for (let i = -1; i <= 1; i++) {
    const h = 90 - Math.abs(i) * 26;
    ctx.beginPath();
    ctx.moveTo(x + i * 34 - 10, y + 30);
    ctx.lineTo(x + i * 34, y - h);
    ctx.lineTo(x + i * 34 + 10, y + 30);
    ctx.closePath();
    ctx.fill();
  }
  const gl = 0.6 + Math.sin(t * 2.4) * 0.4;
  ctx.fillStyle = `rgba(200,60,50,${0.35 * gl})`;
  ctx.beginPath();
  ctx.arc(x, y - 20, 26 * gl, 0, 6.28);
  ctx.fill();
  ctx.fillStyle = "#ff5a3c";
  ctx.beginPath();
  ctx.arc(x, y - 20, 5, 0, 6.28);
  ctx.fill();
}

function drawRally(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  if ((s.buildings.barracks ?? 0) === 0) return;
  const { x, y } = s.rally;
  const rp = s.rallyPulse ?? 0;
  ctx.strokeStyle = rp > 0 ? "rgba(180,230,255,0.85)" : "rgba(140,190,255,0.4)";
  ctx.lineWidth = 1.5 + rp * 2;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.arc(x, y, 24 + Math.sin(t * 2) * 2 + rp * 10, 0, 6.28);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.translate(x, y);
  if (rp > 0) {
    const sq = Math.sin(rp * Math.PI * 3) * rp * 0.28;
    ctx.scale(1 - sq * 0.5, 1 + sq);
  }
  ctx.strokeStyle = "#3a4a5c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -44);
  ctx.stroke();
  ctx.fillStyle = "#5e8fbf";
  const w = Math.sin(t * 4) * 3;
  ctx.beginPath();
  ctx.moveTo(0, -44);
  ctx.quadraticCurveTo(14, -41 + w, 26 + w, -36 + w);
  ctx.lineTo(0, -30);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------- nodes (with spring squash/tilt & hit flash) ----------
function drawNode(ctx: CanvasRenderingContext2D, s: GameState, n: NodeEnt, t: number) {
  const alive = n.amount > 0;
  const isHovered = alive && s.hoverWorld.nodeId === n.id;
  const hit = n.hitAnim ?? 0;
  const fl = n.flash ?? 0;

  ctx.save();
  ctx.translate(n.x, n.y);
  if (alive && (hit > 0 || isHovered)) {
    const wave = Math.sin(hit * Math.PI * 3.5) * hit;
    const sx = (isHovered ? 1.07 : 1) * (1 + wave * 0.26);
    const sy = (isHovered ? 1.07 : 1) * (1 - wave * 0.22);
    const rot = wave * 0.22 * (n.hitDir ?? 1);
    ctx.rotate(rot);
    ctx.scale(sx, sy);
  }

  ctx.fillStyle = "rgba(0,0,0,0.22)";
  if (n.type === "tree") {
    const sway = Math.sin(t * 0.9 + n.seed) * 2;
    if (!alive) {
      if (n.regrow > 0) drawRegrowRing(ctx, 0, 0, 1 - n.regrow / NODE_DEF.tree.regrow);
      ctx.beginPath();
      ctx.ellipse(0, 3, 6, 2.5, 0, 0, 6.28);
      ctx.fill();
      ctx.strokeStyle = "#6b4a2c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(sway * 0.3, -8);
      ctx.stroke();
      ctx.fillStyle = "#5c8a44";
      ctx.beginPath();
      ctx.arc(sway * 0.3, -10, 4, 0, 6.28);
      ctx.fill();
      ctx.restore();
      return;
    }
    const k = 0.65 + 0.35 * (n.amount / n.max);
    ctx.beginPath();
    ctx.ellipse(0, 4, 16 * k, 5, 0, 0, 6.28);
    ctx.fill();
    ctx.strokeStyle = fl > 0.2 ? "#fff4d2" : "#6b4a2c";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(sway * 0.4, -26 * k);
    ctx.stroke();
    const cx = sway;
    const cy = -30 * k;
    const cols = ["#4e7a3a", "#5d8a45", "#6b9a4f"];
    ctx.fillStyle = fl > 0.2 ? "#e8ffcf" : cols[Math.floor(n.seed) % 3];
    ctx.beginPath();
    ctx.arc(cx - 8 * k, cy + 4, 12 * k, 0, 6.28);
    ctx.arc(cx + 8 * k, cy + 4, 11 * k, 0, 6.28);
    ctx.arc(cx, cy - 7 * k, 13 * k, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,220,0.14)";
    ctx.beginPath();
    ctx.arc(cx - 4 * k, cy - 10 * k, 7 * k, 0, 6.28);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (n.type === "rock" || n.type === "iron") {
    if (!alive) {
      if (n.regrow > 0) drawRegrowRing(ctx, 0, 0, 1 - n.regrow / NODE_DEF[n.type].regrow);
      ctx.beginPath();
      ctx.ellipse(0, 2, 10, 3.4, 0, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = "#7c8592";
      ctx.beginPath();
      ctx.ellipse(0, -2, 6, 4, 0, 0, 6.28);
      ctx.fill();
      ctx.restore();
      return;
    }
    const k = 0.7 + 0.3 * (n.amount / n.max);
    ctx.beginPath();
    ctx.ellipse(0, 4, 15 * k, 5, 0, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = fl > 0.2 ? "#fff5e0" : n.type === "rock" ? "#8a94a0" : "#84756e";
    ctx.beginPath();
    const pts = 6;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2 - Math.PI / 2;
      const rr = (13 + Math.sin(n.seed + i * 2.4) * 3) * k;
      const px = Math.cos(a) * rr;
      const py = -6 * k + Math.sin(a) * rr * 0.8;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.ellipse(-4 * k, -12 * k, 5 * k, 3 * k, -0.4, 0, 6.28);
    ctx.fill();
    if (n.type === "iron") {
      const gl = 0.5 + Math.sin(t * 2 + n.seed) * 0.3;
      ctx.strokeStyle = `rgba(255,150,60,${gl})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-7 * k, -8 * k);
      ctx.lineTo(-1, -4 * k);
      ctx.lineTo(5 * k, -10 * k);
      ctx.moveTo(-2, -12 * k);
      ctx.lineTo(3, -6 * k);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (n.type === "crystal") {
    if (!alive) { ctx.restore(); return; }
    const gl = 0.6 + Math.sin(t * 2.4 + n.seed) * 0.35;
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(0, 3, 14, 4.5, 0, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = `rgba(127,217,255,${0.18 * gl})`;
    ctx.beginPath();
    ctx.arc(0, -12, 26 * gl, 0, 6.28);
    ctx.fill();
    const shards = 3;
    for (let i = 0; i < shards; i++) {
      const a = (i - 1) * 0.5 + Math.sin(n.seed) * 0.2;
      const h = (16 + i * 6) * (0.6 + 0.4 * (n.amount / n.max));
      ctx.save();
      ctx.translate((i - 1) * 9, 0);
      ctx.rotate(a * 0.4);
      ctx.fillStyle = fl > 0.2 ? "#ffffff" : i === 1 ? "#aee9ff" : "#7fd9ff";
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(5, -h * 0.35);
      ctx.lineTo(3, 0);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-5, -h * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(2.4, -h * 0.4);
      ctx.lineTo(0, -h * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    return;
  }
  // ruin
  if (!alive) {
    ctx.fillStyle = "rgba(90,84,76,0.5)";
    ctx.fillRect(-12, -8, 7, 10);
    ctx.restore();
    return;
  }
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 3, 18, 5, 0, 0, 6.28);
  ctx.fill();
  ctx.fillStyle = fl > 0.2 ? "#fff3d6" : "#9a917e";
  ctx.fillRect(-14, -22, 8, 24);
  ctx.fillRect(6, -16, 8, 18);
  ctx.save();
  ctx.translate(7, -24);
  ctx.rotate(0.5);
  ctx.fillRect(-2, -4, 18, 6);
  ctx.restore();
  const gl = 0.5 + Math.sin(t * 3 + n.seed) * 0.4;
  ctx.fillStyle = `rgba(242,193,77,${0.3 * gl})`;
  ctx.beginPath();
  ctx.arc(-2, -8, 10 * gl, 0, 6.28);
  ctx.fill();
  ctx.fillStyle = "#f2c14d";
  ctx.beginPath();
  ctx.arc(-2, -8, 2.6, 0, 6.28);
  ctx.fill();
  ctx.restore();
}

function drawRegrowRing(ctx: CanvasRenderingContext2D, x: number, y: number, p: number) {
  ctx.strokeStyle = "rgba(158,208,122,0.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - 6, 12, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
  ctx.stroke();
}

// ---------- buildings ----------
function drawPlots(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  const pulse = 0.5 + Math.sin(t * 2.6) * 0.18;
  (Object.keys(PLOTS) as (keyof typeof PLOTS)[]).forEach((key) => {
    const owned = s.buildings[key] ?? 0;
    const def = (BUILDINGS as any)[key];
    if (!def || owned >= def.max) return;
    const p = (PLOTS[key] as { x: number; y: number }[])[owned];
    const afford = canAfford(s, def.cost(owned));
    ctx.strokeStyle = afford ? `rgba(255,190,110,${pulse})` : "rgba(255,220,180,0.22)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 6]);
    roundRect(ctx, p.x - 36, p.y - 36, 72, 56, 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = afford ? "rgba(255,220,170,0.9)" : "rgba(255,220,170,0.35)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(p.x - 6, p.y + 2);
    ctx.lineTo(p.x + 6, p.y - 12);
    ctx.moveTo(p.x + 1, p.y - 16);
    ctx.lineTo(p.x + 11, p.y - 7);
    ctx.stroke();
    ctx.font = "600 9px Sora";
    ctx.textAlign = "center";
    ctx.fillStyle = afford ? "rgba(255,225,180,0.85)" : "rgba(255,225,180,0.38)";
    ctx.fillText(def.name, p.x, p.y + 28);
  });
}

function drawStockpile(ctx: CanvasRenderingContext2D, s: GameState, t: number, day: number) {
  const x = WORLD.stockX;
  const y = WORLD.stockY;
  const sp = s.stockPulse ?? 0;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 64, 16, 0, 0, 6.28);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  if (sp > 0) {
    const wv = Math.sin(sp * Math.PI * 3) * Math.min(1, sp) * 0.14;
    ctx.scale(1 + wv, 1 - wv * 0.85);
  }
  // stone platform
  ctx.fillStyle = "#7d7466";
  ctx.beginPath();
  ctx.ellipse(0, 8, 58, 15, 0, 0, 6.28);
  ctx.fill();
  ctx.fillStyle = "#8d8474";
  ctx.beginPath();
  ctx.ellipse(0, 5, 54, 13, 0, 0, 6.28);
  ctx.fill();
  // crates scale with stored goods
  const cap = Math.round(300 * Math.pow(2, s.stockLvl - 1));
  const stored = s.res.wood + s.res.stone + s.res.iron + s.res.crystal;
  const fill = clamp(stored / cap, 0, 1);
  const stacks = 2 + Math.round(fill * 6);
  for (let i = 0; i < stacks; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const r = 12 + (i % 3) * 12;
    const cx = Math.cos(a) * r;
    const cy = 2 + Math.sin(a) * r * 0.35 - (i % 2) * 7;
    const cols = ["#a5713c", "#8a94a0", "#c97a45", "#7fd9ff"];
    ctx.fillStyle = cols[i % 4];
    ctx.fillRect(cx - 6, cy - 9, 12, 10);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(cx - 6, cy - 9, 12, 3);
    ctx.strokeStyle = "rgba(40,25,10,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 6, cy - 9, 12, 10);
  }
  // banner pole
  ctx.strokeStyle = "#4a3826";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-40, 6);
  ctx.lineTo(-40, -52);
  ctx.stroke();
  const w = Math.sin(t * 3.4) * 3;
  ctx.fillStyle = "#d9a545";
  ctx.beginPath();
  ctx.moveTo(-40, -52);
  ctx.quadraticCurveTo(-26, -49 + w, -14 + w, -44 + w);
  ctx.lineTo(-40, -38);
  ctx.closePath();
  ctx.fill();
  // brazier
  ctx.fillStyle = "#4c4038";
  ctx.beginPath();
  ctx.ellipse(36, -40, 7, 4, 0, 0, 6.28);
  ctx.fill();
  ctx.strokeStyle = "#4c4038";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(32, -38);
  ctx.lineTo(30, -28);
  ctx.moveTo(40, -38);
  ctx.lineTo(42, -28);
  ctx.stroke();
  const fl = (0.8 + Math.sin(t * 8) * 0.25) * (1 + sp * 0.45);
  ctx.fillStyle = `rgba(255,150,60,${0.3 + 0.15 * Math.sin(t * 5)})`;
  ctx.beginPath();
  ctx.arc(36, -44, 9 * fl, 0, 6.28);
  ctx.fill();
  ctx.fillStyle = "#ffc873";
  ctx.beginPath();
  ctx.arc(36, -44, 3 * fl, 0, 6.28);
  ctx.fill();
  ctx.restore();

  if (day < 0.4) {
    ctx.fillStyle = `rgba(255,170,80,${0.12 * (1 - day)})`;
    ctx.beginPath();
    ctx.arc(x, y - 10, 90, 0, 6.28);
    ctx.fill();
  }
  label(ctx, x, y + 30, "Stockpile");
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.font = "600 10px Sora";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(40,30,18,0.55)";
  ctx.fillText(text, x, y + 1);
  ctx.fillStyle = "rgba(255,238,205,0.75)";
  ctx.fillText(text, x, y);
}

function drawBuilding(ctx: CanvasRenderingContext2D, s: GameState, bEnt: BuildingEnt, idx: number, t: number, day: number) {
  void idx;
  const { key, x, y } = bEnt;
  const night = 1 - day;
  const drop = bEnt.dropAnim ?? 0;
  const pulse = bEnt.pulse ?? 0;

  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 46 * (1 - drop * 0.3), 12 * (1 - drop * 0.3), 0, 0, 6.28);
  ctx.fill();

  ctx.save();
  let dropY = 0;
  let sx = 1;
  let sy = 1;
  if (drop > 0.65) {
    const p = (drop - 0.65) / 0.35;
    dropY = -p * p * 95;
    sx = 0.88;
    sy = 1.16;
  } else if (drop > 0) {
    const p = drop / 0.65;
    const wv = Math.sin(p * Math.PI * 2.5) * p;
    sx = 1 + wv * 0.28;
    sy = 1 - wv * 0.24;
  } else if (pulse > 0) {
    const wv = Math.sin(pulse * Math.PI * 3) * pulse * 0.14;
    sx = 1 + wv;
    sy = 1 - wv * 0.85;
  }
  ctx.translate(x, y + dropY);
  ctx.scale(sx, sy);
  ctx.translate(-x, -y);

  const glowWindow = (wx: number, wy: number, w2 = 6, h2 = 7) => {
    ctx.fillStyle = night > 0.4 ? `rgba(255,190,90,${0.9})` : "rgba(60,45,30,0.8)";
    ctx.fillRect(wx - w2 / 2, wy - h2 / 2, w2, h2);
    if (night > 0.4) {
      ctx.fillStyle = `rgba(255,170,80,${0.2 * night})`;
      ctx.beginPath();
      ctx.arc(wx, wy, 16, 0, 6.28);
      ctx.fill();
    }
  };
  if (key === "bunkhouse") {
    ctx.fillStyle = "#8a6742";
    ctx.fillRect(x - 26, y - 22, 52, 30);
    ctx.fillStyle = "#6e4f30";
    ctx.beginPath();
    ctx.moveTo(x - 32, y - 20);
    ctx.lineTo(x, y - 42);
    ctx.lineTo(x + 32, y - 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(40,25,10,0.5)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 26 + i * 4, y - 22 - i * 6);
      ctx.lineTo(x + 26 - i * 4, y - 22 - i * 6);
      ctx.stroke();
    }
    ctx.fillStyle = "#3a2a18";
    ctx.fillRect(x - 5, y - 8, 10, 16);
    glowWindow(x - 16, y - 10);
    glowWindow(x + 16, y - 10);
    ctx.restore();
    label(ctx, x, y + 26, "Bunkhouse");
    return;
  }
  if (key === "workshop") {
    ctx.fillStyle = "#7a5c46";
    ctx.fillRect(x - 30, y - 26, 60, 34);
    ctx.fillStyle = "#5c4030";
    ctx.beginPath();
    ctx.moveTo(x - 36, y - 24);
    ctx.lineTo(x, y - 48);
    ctx.lineTo(x + 36, y - 24);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(x + 16, y - 10);
    ctx.rotate(t * 0.7);
    ctx.fillStyle = "#b3925a";
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(6.4, -2, 5, 4);
    }
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = "#6e5230";
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, 6.28);
    ctx.fill();
    ctx.restore();
    glowWindow(x - 14, y - 8);
    ctx.restore();
    label(ctx, x, y + 26, "Workshop");
    return;
  }
  if (key === "forge") {
    ctx.fillStyle = "#6a5f58";
    ctx.fillRect(x - 26, y - 24, 52, 32);
    ctx.fillStyle = "#54483f";
    ctx.beginPath();
    ctx.moveTo(x - 32, y - 22);
    ctx.lineTo(x, y - 40);
    ctx.lineTo(x + 32, y - 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#4c4038";
    ctx.fillRect(x + 10, y - 56, 10, 36);
    ctx.fillStyle = "#3c322b";
    ctx.fillRect(x + 8, y - 58, 14, 6);
    const gl = 0.65 + Math.sin(t * 5.2) * 0.3;
    ctx.fillStyle = `rgba(255,130,40,${0.5 * gl + 0.2 * night})`;
    ctx.beginPath();
    ctx.arc(x - 6, y - 2, 13, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = "#ff9448";
    ctx.fillRect(x - 13, y - 8, 14, 10);
    ctx.fillStyle = "#ffd9a0";
    ctx.fillRect(x - 10, y - 5, 8, 4);
    ctx.fillStyle = "#3a3f46";
    ctx.fillRect(x - 22, y + 2, 12, 4);
    ctx.fillRect(x - 19, y + 6, 6, 3);
    ctx.restore();
    label(ctx, x, y + 26, "Forge");
    return;
  }
  // barracks
  ctx.fillStyle = "#75604a";
  ctx.fillRect(x - 40, y - 20, 80, 28);
  ctx.fillStyle = "#5a4632";
  ctx.beginPath();
  ctx.moveTo(x - 46, y - 18);
  ctx.lineTo(x, y - 44);
  ctx.lineTo(x + 46, y - 18);
  ctx.closePath();
  ctx.fill();
  for (const fx of [-30, 30]) {
    ctx.strokeStyle = "#3a2c1c";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + fx, y - 34);
    ctx.lineTo(x + fx, y - 58);
    ctx.stroke();
    const w = Math.sin(t * 4 + fx) * 3;
    ctx.fillStyle = "#c9541e";
    ctx.beginPath();
    ctx.moveTo(x + fx, y - 58);
    ctx.quadraticCurveTo(x + fx + 10, y - 55 + w, x + fx + 18 + w, y - 51 + w);
    ctx.lineTo(x + fx, y - 46);
    ctx.closePath();
    ctx.fill();
  }
  glowWindow(x - 18, y - 6);
  ctx.fillStyle = "#3a2a18";
  ctx.fillRect(x - 6, y - 6, 12, 14);
  ctx.strokeStyle = "#8a6a3e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 52, y + 8);
  ctx.lineTo(x + 52, y - 16);
  ctx.moveTo(x + 44, y - 8);
  ctx.lineTo(x + 60, y - 8);
  ctx.stroke();
  ctx.fillStyle = "#b3925a";
  ctx.beginPath();
  ctx.arc(x + 52, y - 20, 4, 0, 6.28);
  ctx.fill();
  ctx.restore();

  const b = s.barracksEnts.find((bb) => bb.x === x && bb.y === y);
  if (b && b.queue.length > 0) {
    const need = UNITS[b.queue[0]].train;
    const p = b.prog / need;
    ctx.fillStyle = "rgba(20,16,10,0.7)";
    ctx.fillRect(x - 30, y - 68, 60, 6);
    ctx.fillStyle = "#ffb25e";
    ctx.fillRect(x - 29, y - 67, 58 * clamp(p, 0, 1), 4);
    for (let i = 0; i < b.queue.length; i++) {
      ctx.fillStyle = "rgba(255,220,170,0.85)";
      ctx.beginPath();
      ctx.arc(x - 26 + i * 8, y - 74, 2.4, 0, 6.28);
      ctx.fill();
    }
  }
  label(ctx, x, y + 26, "Barracks");
}

// ---------- people (with jump arcs, hop cycle, squash & hit flash) ----------
function drawWorker(ctx: CanvasRenderingContext2D, s: GameState, w: WorkerEnt, t: number) {
  const moving = w.state === "toNode" || w.state === "toHome";
  const hop = moving ? Math.abs(Math.sin(w.phase * 11)) * 3.2 : Math.sin(t * 2 + w.phase) * 0.5;
  const jz = w.jumpZ ?? 0;
  const sq = w.squash ?? 0;
  const shadowScale = clamp(1 - jz / 60, 0.45, 1);

  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(w.x, w.y + 3, 7 * shadowScale, 2.6 * shadowScale, 0, 0, 6.28);
  ctx.fill();

  ctx.save();
  ctx.translate(w.x, w.y - jz - hop);
  if (sq > 0) {
    ctx.scale(1 + sq * 0.45, 1 - sq * 0.35);
  }
  // legs
  ctx.strokeStyle = "#4a3826";
  ctx.lineWidth = 2.2;
  const lp = moving ? Math.sin(w.phase * 11) * 3.4 : 0;
  ctx.beginPath();
  ctx.moveTo(-1, -2);
  ctx.lineTo(-1 - lp * 0.5, 3);
  ctx.moveTo(1, -2);
  ctx.lineTo(1 + lp * 0.5, 3);
  ctx.stroke();
  // body
  ctx.fillStyle = w.tunic;
  roundRect(ctx, -4, -13, 8, 10, 3);
  ctx.fill();
  // head
  ctx.fillStyle = "#e8c39a";
  ctx.beginPath();
  ctx.arc(0, -16, 3.4, 0, 6.28);
  ctx.fill();
  ctx.fillStyle = "#6e5230";
  ctx.beginPath();
  ctx.arc(0, -17.6, 2.6, Math.PI, 0);
  ctx.fill();
  // arm swing while harvesting
  if (w.state === "harvest") {
    const a = Math.sin(w.prog * 16) * 1.1 - 0.4;
    ctx.strokeStyle = "#e8c39a";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(2, -10);
    ctx.lineTo(2 + Math.cos(a) * 9, -10 + Math.sin(a) * 9);
    ctx.stroke();
  }
  // carried stack
  if (w.carryRes && w.carryN > 0) {
    const col = RES_META[w.carryRes].color;
    const n = Math.min(3, Math.ceil(w.carryN / 2));
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = col;
      ctx.fillRect(-4, -24 - i * 5, 8, 4);
      ctx.strokeStyle = "rgba(30,20,10,0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-4, -24 - i * 5, 8, 4);
    }
  }
  ctx.restore();
  void s;
}

const UNIT_SCALE: Record<string, number> = { militia: 1, archer: 0.95, guardian: 1.25, golem: 1.9 };

function drawUnit(ctx: CanvasRenderingContext2D, s: GameState, u: UnitEnt, t: number) {
  void s;
  const k = UNIT_SCALE[u.type];
  const jz = u.jumpZ ?? 0;
  const sq = u.squash ?? 0;
  const fl = u.flash ?? 0;
  const hop = Math.abs(Math.sin(u.bob)) * 2.4;
  const lx = u.face * (u.lunge * 8.5);
  const shadowScale = clamp(1 - jz / 70, 0.45, 1);

  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.beginPath();
  ctx.ellipse(u.x, u.y + 4, 8 * k * shadowScale, 3 * k * shadowScale, 0, 0, 6.28);
  ctx.fill();

  ctx.save();
  ctx.translate(u.x + lx, u.y - jz - hop);
  if (sq > 0) ctx.scale(1 + sq * 0.42, 1 - sq * 0.34);

  if (u.type === "golem") {
    ctx.fillStyle = fl > 0.25 ? "#fff4dc" : "#6f6a60";
    roundRect(ctx, -8 * k, -15 * k, 16 * k, 14 * k, 4);
    ctx.fill();
    ctx.fillStyle = fl > 0.25 ? "#ffffff" : "#5d5850";
    roundRect(ctx, -12 * k, -12 * k, 5 * k, 9 * k, 2);
    ctx.fill();
    roundRect(ctx, 7 * k, -12 * k, 5 * k, 9 * k, 2);
    ctx.fill();
    ctx.fillStyle = fl > 0.25 ? "#fff4dc" : "#7d786c";
    roundRect(ctx, -6 * k, -22 * k, 12 * k, 8 * k, 3);
    ctx.fill();
    const gl = 0.6 + Math.sin(t * 4 + u.bob) * 0.35;
    ctx.fillStyle = `rgba(255,140,50,${gl})`;
    ctx.beginPath();
    ctx.arc(0, -9 * k, 3 * k, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = "#ffd9a0";
    ctx.beginPath();
    ctx.arc(0, -9 * k, 1.4 * k, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = "#ff9448";
    ctx.beginPath();
    ctx.arc(u.face * 3 * k, -19 * k, 1.3 * k, 0, 6.28);
    ctx.fill();
  } else {
    const tunic = fl > 0.25 ? "#ffffff" : u.type === "militia" ? "#54687e" : u.type === "archer" ? "#4f7247" : "#7e8894";
    ctx.strokeStyle = "#3a3230";
    ctx.lineWidth = 2.4 * k;
    ctx.beginPath();
    ctx.moveTo(-1, -2);
    ctx.lineTo(-2, 4);
    ctx.moveTo(1, -2);
    ctx.lineTo(2, 4);
    ctx.stroke();
    ctx.fillStyle = tunic;
    roundRect(ctx, -4.5 * k, -13 * k, 9 * k, 10 * k, 3);
    ctx.fill();
    ctx.fillStyle = fl > 0.25 ? "#ffffff" : "#e8c39a";
    ctx.beginPath();
    ctx.arc(0, -16 * k, 3.4 * k, 0, 6.28);
    ctx.fill();
    if (u.type === "militia") {
      ctx.fillStyle = "#8a94a0";
      ctx.beginPath();
      ctx.arc(0, -17 * k, 3.6 * k, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "#d8dfe8";
      ctx.lineWidth = 2 * k;
      const sa = u.lunge > 0 ? u.face * 11 : u.face * 4;
      ctx.beginPath();
      ctx.moveTo(u.face * 3 * k, -9 * k);
      ctx.lineTo(sa * k, -16 * k);
      ctx.stroke();
    }
    if (u.type === "archer") {
      ctx.fillStyle = "#3f5c39";
      ctx.beginPath();
      ctx.moveTo(-4 * k, -15 * k);
      ctx.lineTo(0, -23 * k);
      ctx.lineTo(4 * k, -15 * k);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#8a6a3e";
      ctx.lineWidth = 1.8 * k;
      ctx.beginPath();
      ctx.arc(u.face * 5 * k, -10 * k, 6 * k, -1.1, 1.1);
      ctx.stroke();
    }
    if (u.type === "guardian") {
      ctx.fillStyle = "#aab4c0";
      ctx.beginPath();
      ctx.arc(0, -17 * k, 4 * k, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#c9541e";
      ctx.fillRect(-1 * k, -23 * k, 2 * k, 4 * k);
      ctx.fillStyle = "#8a94a0";
      roundRect(ctx, u.face * 4 * k - 2 * k, -13 * k, 5 * k, 11 * k, 2);
      ctx.fill();
      ctx.strokeStyle = "#5c6670";
      ctx.lineWidth = 1;
      ctx.strokeRect(u.face * 4 * k - 2 * k, -13 * k, 5 * k, 11 * k);
    }
  }
  ctx.restore();
  drawHpBar(ctx, u.x + lx, u.y - jz - 26 * k - hop, u.hp / u.maxhp, "#6fce62", 26 * k);
}

function drawEnemy(ctx: CanvasRenderingContext2D, s: GameState, e: EnemyEnt, t: number) {
  const def = ENEMIES[e.type];
  const isHovered = s.hoverWorld.enemyId === e.id;
  const k = def.scale * (isHovered ? 1.08 : 1);
  const jz = e.jumpZ ?? 0;
  const sq = e.squash ?? 0;
  const fl = e.flash ?? 0;
  const hop = Math.abs(Math.sin(e.bob)) * 2.2;
  const lx = e.face * (e.lunge * 9);
  const shadowScale = clamp(1 - jz / 70, 0.45, 1);

  ctx.fillStyle = "rgba(0,0,0,0.26)";
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + 4, 8 * k * shadowScale, 3.2 * k * shadowScale, 0, 0, 6.28);
  ctx.fill();

  ctx.save();
  ctx.translate(e.x + lx, e.y - jz - hop);
  if (sq > 0) ctx.scale(1 + sq * 0.45, 1 - sq * 0.36);

  if (e.type === "brute" || e.type === "warlord") {
    ctx.fillStyle = fl > 0.25 ? "#fff4e4" : "#4a3f52";
    roundRect(ctx, -7 * k, -14 * k, 14 * k, 13 * k, 4);
    ctx.fill();
    ctx.fillStyle = fl > 0.25 ? "#ffffff" : "#332b3a";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 4 * k - 3, -14 * k);
      ctx.lineTo(i * 4 * k, -21 * k);
      ctx.lineTo(i * 4 * k + 3, -14 * k);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = fl > 0.25 ? "#ffffff" : "#5c5066";
    ctx.beginPath();
    ctx.arc(0, -16 * k, 4.4 * k, 0, 6.28);
    ctx.fill();
    if (e.type === "warlord") {
      ctx.strokeStyle = "#d8cdb4";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-6 * k, -20 * k);
      ctx.quadraticCurveTo(-9 * k, -26 * k, -5 * k, -28 * k);
      ctx.moveTo(6 * k, -20 * k);
      ctx.quadraticCurveTo(9 * k, -26 * k, 5 * k, -28 * k);
      ctx.stroke();
      const aura = 0.5 + Math.sin(t * 3) * 0.3;
      ctx.fillStyle = `rgba(200,60,50,${0.16 * aura})`;
      ctx.beginPath();
      ctx.arc(0, -12 * k, 22 * k, 0, 6.28);
      ctx.fill();
    }
  } else if (e.type === "shaman") {
    ctx.fillStyle = fl > 0.25 ? "#ffffff" : "#4f3a5e";
    ctx.beginPath();
    ctx.moveTo(-7 * k, 3);
    ctx.lineTo(0, -20 * k);
    ctx.lineTo(7 * k, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = fl > 0.25 ? "#ffffff" : "#c9b6d8";
    ctx.beginPath();
    ctx.arc(0, -17 * k, 3.2 * k, 0, 6.28);
    ctx.fill();
    ctx.strokeStyle = "#6e5230";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(e.face * 5 * k, 2);
    ctx.lineTo(e.face * 7 * k, -24 * k);
    ctx.stroke();
    const gl = 0.6 + Math.sin(t * 5 + e.bob) * 0.35;
    ctx.fillStyle = `rgba(190,120,255,${gl})`;
    ctx.beginPath();
    ctx.arc(e.face * 7 * k, -25 * k, 3.4 * k, 0, 6.28);
    ctx.fill();
  } else {
    ctx.fillStyle = fl > 0.25 ? "#fff4e4" : "#544a5e";
    roundRect(ctx, -4 * k, -11 * k, 9 * k, 9 * k, 3);
    ctx.fill();
    ctx.fillStyle = fl > 0.25 ? "#ffffff" : "#3f3748";
    ctx.beginPath();
    ctx.arc(e.face * 2 * k, -14 * k, 3.6 * k, 0, 6.28);
    ctx.fill();
    ctx.strokeStyle = "#8a6a3e";
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.moveTo(e.face * 2 * k, -8 * k);
    ctx.lineTo(e.face * 12 * k, -14 * k);
    ctx.stroke();
  }
  ctx.fillStyle = e.type === "shaman" ? "#c98aff" : "#ff5a3c";
  ctx.beginPath();
  ctx.arc(e.face * 1.6 * k, -15.5 * k, 0.9 * k, 0, 6.28);
  ctx.arc(e.face * 4 * k, -15.5 * k, 0.9 * k, 0, 6.28);
  ctx.fill();
  ctx.restore();
  drawHpBar(ctx, e.x + lx, e.y - jz - 24 * k - hop, e.hp / e.maxhp, "#e0604e", 24 * k);
}

function drawHpBar(ctx: CanvasRenderingContext2D, x: number, y: number, p: number, color: string, w: number) {
  if (p >= 0.999) return;
  ctx.fillStyle = "rgba(15,10,8,0.75)";
  ctx.fillRect(x - w / 2, y, w, 3.8);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2 + 0.5, y + 0.5, (w - 1) * clamp(p, 0, 1), 2.8);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- shockwave rings, crescent slashes, lightning bolts ----------
function drawRings(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const r of s.rings) {
    const a = clamp(r.life / r.max, 0, 1);
    const t = 1 - a;
    const rad = r.maxR * (0.15 + 0.85 * (1 - Math.pow(1 - t, 3)));
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.scale(1, 0.58);
    ctx.globalAlpha = a * 0.85;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = Math.max(1, r.lineW * a);
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSlashes(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const sl of s.slashes) {
    const a = clamp(sl.life / sl.max, 0, 1);
    const prog = 1 - a;
    ctx.save();
    ctx.translate(sl.x, sl.y);
    ctx.rotate(sl.ang + (prog - 0.5) * 0.6 * sl.dir);
    ctx.globalAlpha = Math.min(1, a * 1.4);
    ctx.strokeStyle = sl.color;
    ctx.lineWidth = 4.5 * a;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, sl.r, -0.85, 0.85);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2 * a;
    ctx.beginPath();
    ctx.arc(0, 0, sl.r * 0.94, -0.6, 0.6);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBolts(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const b of s.bolts) {
    if (b.pts.length < 2) continue;
    const a = clamp(b.life / b.max, 0, 1);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // outer glow
    ctx.globalAlpha = a * 0.55;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = b.width * 3.2 * a;
    ctx.beginPath();
    ctx.moveTo(b.pts[0].x, b.pts[0].y);
    for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i].x, b.pts[i].y);
    ctx.stroke();
    // bright core
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1.2, b.width * a);
    ctx.beginPath();
    ctx.moveTo(b.pts[0].x, b.pts[0].y);
    for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i].x, b.pts[i].y);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------- projectiles / orbs / fx ----------
function drawProjectiles(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const p of s.projs) {
    const t = clamp(p.t, 0, 1);
    const x = lerp(p.x1, p.x2, t);
    const y = lerp(p.y1, p.y2, t) - Math.sin(t * Math.PI) * (p.kind === "arrow" ? 26 : 8);
    if (p.kind === "arrow") {
      const ang = Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
      ctx.strokeStyle = "#c9a86a";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(ang) * 7, y - Math.sin(ang) * 7);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = "#e8e0cf";
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, 6.28);
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(190,120,255,0.35)";
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = "#c98aff";
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, 6.28);
      ctx.fill();
    }
  }
}

function drawOrbs(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  void t;
  for (const o of s.orbs) {
    if (o.t < 0) continue;
    const col = RES_META[o.res].color;
    ctx.fillStyle = `${col}55`;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 10.5, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 5, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.beginPath();
    ctx.arc(o.x - 1.4, o.y - 1.6, 1.8, 0, 6.28);
    ctx.fill();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const p of s.particles) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.kind === "star") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * 6);
      ctx.globalAlpha = Math.min(1, a * 1.4);
      ctx.fillStyle = p.color;
      const sz = p.size * (0.5 + 0.5 * a);
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const ang = (k * Math.PI) / 2;
        ctx.lineTo(Math.cos(ang) * sz * 1.7, Math.sin(ang) * sz * 1.7);
        ctx.lineTo(Math.cos(ang + Math.PI / 4) * sz * 0.45, Math.sin(ang + Math.PI / 4) * sz * 0.45);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (p.kind === "chip" || p.kind === "leaf") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * (p.kind === "leaf" ? 2 : 9));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    } else if (p.kind === "smoke") {
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, 6.28);
      ctx.fill();
    } else if (p.kind === "flame" || p.kind === "ember" || p.kind === "spark" || p.kind === "glow" || p.kind === "zap") {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.kind === "zap" ? a : 1), 0, 6.28);
      ctx.fill();
    } else {
      ctx.globalAlpha = a * 0.8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, 6.28);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawFloats(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.textAlign = "center";
  for (const f of s.floats) {
    const a = clamp(f.life / f.max, 0, 1);
    const age = 1 - a;
    // elastic pop-in scale
    let sc = 1;
    if (age < 0.16) {
      const p = age / 0.16;
      sc = 0.65 + Math.sin(p * Math.PI * 0.75) * (f.crit ? 0.8 : 0.5);
    } else if (age < 0.32) {
      const p = (age - 0.16) / 0.16;
      sc = lerp(f.crit ? 1.4 : 1.15, 1, p);
    }
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(sc, sc);
    ctx.globalAlpha = Math.min(1, a * 1.75);
    ctx.font = `${f.crit ? 900 : 800} ${f.size}px Sora`;
    ctx.strokeStyle = "rgba(18,10,4,0.88)";
    ctx.lineWidth = f.crit ? 4 : 3;
    ctx.strokeText(f.text, 0, 0);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ---------- minimap ----------
export function drawMinimap(ctx: CanvasRenderingContext2D, s: GameState, w: number, h: number, vw: number, vh: number) {
  const kx = w / WORLD.w;
  const ky = h / WORLD.h;
  const k = Math.min(kx, ky);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#151009";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#3f3a28";
  ctx.fillRect(0, (h - WORLD.h * k) / 2, WORLD.w * k, WORLD.h * k);
  const oy = (h - WORLD.h * k) / 2;
  ctx.fillStyle = "#36302e";
  ctx.fillRect(1450 * k, oy, (WORLD.w - 1450) * k, WORLD.h * k);
  ctx.fillStyle = "rgba(255,170,90,0.13)";
  ctx.fillRect(0, oy, s.frontX * k, WORLD.h * k);
  ctx.fillStyle = "rgba(120,150,90,0.6)";
  for (const n of s.nodes) {
    if (n.amount <= 0) continue;
    ctx.fillRect(n.x * k - 0.5, oy + n.y * k - 0.5, 1.4, 1.4);
  }
  ctx.fillStyle = "#ffb25e";
  for (const b of s.buildingEnts) ctx.fillRect(b.x * k - 1.5, oy + b.y * k - 1.5, 3, 3);
  ctx.fillRect(WORLD.stockX * k - 2, oy + WORLD.stockY * k - 2, 4, 4);
  ctx.fillStyle = "#f4e6c8";
  for (const wk of s.workers) ctx.fillRect(wk.x * k - 0.5, oy + wk.y * k - 0.5, 1.2, 1.2);
  ctx.fillStyle = "#7ec3ff";
  for (const u of s.units) ctx.fillRect(u.x * k - 1, oy + u.y * k - 1, 2, 2);
  ctx.fillStyle = "#ff5a48";
  for (const e of s.enemies) ctx.fillRect(e.x * k - 1.2, oy + e.y * k - 1.2, 2.4, 2.4);
  ctx.strokeStyle = "rgba(255,220,170,0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(s.frontX * k, oy);
  ctx.lineTo(s.frontX * k, oy + WORLD.h * k);
  ctx.stroke();
  const cw = vw / s.cam.z;
  const ch = vh / s.cam.z;
  ctx.strokeStyle = "rgba(255,210,140,0.7)";
  ctx.strokeRect((s.cam.x - cw / 2) * k, oy + (s.cam.y - ch / 2) * k, cw * k, ch * k);
}
