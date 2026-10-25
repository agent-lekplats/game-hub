// ---------- canvas renderer: a living miniature world ----------
import { WORLD, RES_META, UNITS, ENEMIES, PLOTS, BUILDINGS } from "./data";
import { NODE_DEF } from "./world";
import { canAfford } from "./state";
import type { GameState, NodeEnt, WorkerEnt, UnitEnt, EnemyEnt } from "./state";
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
  const z = s.cam.z;
  const shx = (Math.random() - 0.5) * s.cam.shake;
  const shy = (Math.random() - 0.5) * s.cam.shake;
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

  // depth-sorted entities
  type D = { y: number; f: () => void };
  const list: D[] = [];
  for (const n of s.nodes) list.push({ y: n.y + 8, f: () => drawNode(ctx, n, t) });
  let bi = 0;
  for (const b of s.buildingEnts) {
    const idx = bi++;
    list.push({ y: b.y + 30, f: () => drawBuilding(ctx, s, b.key, b.x, b.y, idx, t, day) });
  }
  list.push({ y: WORLD.stockY + 40, f: () => drawStockpile(ctx, s, t, day) });
  for (const w of s.workers) list.push({ y: w.y + 6, f: () => drawWorker(ctx, s, w, t) });
  for (const u of s.units) list.push({ y: u.y + 8, f: () => drawUnit(ctx, s, u, t) });
  for (const e of s.enemies) list.push({ y: e.y + 8, f: () => drawEnemy(ctx, s, e, t) });
  list.sort((a, b2) => a.y - b2.y);
  for (const d of list) d.f();

  drawPlots(ctx, s, t);
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
    // trailing companion
    ctx.beginPath();
    ctx.moveTo(b.x - 15, b.y - 6 - w * 0.7);
    ctx.quadraticCurveTo(b.x - 10, b.y - 4, b.x - 5, b.y - 6 - w * 0.7);
    ctx.stroke();
  }
}

// ---------- the front ----------
function drawFront(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  const x = s.frontX;
  // boundary line
  ctx.strokeStyle = `rgba(255,190,120,${0.2 + (s.frontAnim > 0 ? 0.4 * s.frontAnim : 0)})`;
  ctx.lineWidth = 2;
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
  // label
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
  ctx.strokeStyle = "rgba(140,190,255,0.4)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.arc(x, y, 24 + Math.sin(t * 2) * 2, 0, 6.28);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "#3a4a5c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 44);
  ctx.stroke();
  ctx.fillStyle = "#5e8fbf";
  const w = Math.sin(t * 4) * 3;
  ctx.beginPath();
  ctx.moveTo(x, y - 44);
  ctx.quadraticCurveTo(x + 14, y - 41 + w, x + 26 + w, y - 36 + w);
  ctx.lineTo(x, y - 30);
  ctx.closePath();
  ctx.fill();
}

// ---------- nodes ----------
function drawNode(ctx: CanvasRenderingContext2D, n: NodeEnt, t: number) {
  const alive = n.amount > 0;
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  if (n.type === "tree") {
    const sway = Math.sin(t * 0.9 + n.seed) * 2;
    if (!alive) {
      if (n.regrow > 0) drawRegrowRing(ctx, n, 1 - n.regrow / NODE_DEF.tree.regrow);
      // sapling
      ctx.beginPath();
      ctx.ellipse(n.x, n.y + 3, 6, 2.5, 0, 0, 6.28);
      ctx.fill();
      ctx.strokeStyle = "#6b4a2c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.lineTo(n.x + sway * 0.3, n.y - 8);
      ctx.stroke();
      ctx.fillStyle = "#5c8a44";
      ctx.beginPath();
      ctx.arc(n.x + sway * 0.3, n.y - 10, 4, 0, 6.28);
      ctx.fill();
      return;
    }
    const k = 0.65 + 0.35 * (n.amount / n.max);
    ctx.beginPath();
    ctx.ellipse(n.x, n.y + 4, 16 * k, 5, 0, 0, 6.28);
    ctx.fill();
    ctx.strokeStyle = "#6b4a2c";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(n.x, n.y);
    ctx.lineTo(n.x + sway * 0.4, n.y - 26 * k);
    ctx.stroke();
    const cx = n.x + sway;
    const cy = n.y - 30 * k;
    const cols = ["#4e7a3a", "#5d8a45", "#6b9a4f"];
    ctx.fillStyle = cols[Math.floor(n.seed) % 3];
    ctx.beginPath();
    ctx.arc(cx - 8 * k, cy + 4, 12 * k, 0, 6.28);
    ctx.arc(cx + 8 * k, cy + 4, 11 * k, 0, 6.28);
    ctx.arc(cx, cy - 7 * k, 13 * k, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,220,0.12)";
    ctx.beginPath();
    ctx.arc(cx - 4 * k, cy - 10 * k, 7 * k, 0, 6.28);
    ctx.fill();
    return;
  }
  if (n.type === "rock" || n.type === "iron") {
    if (!alive) {
      if (n.regrow > 0) drawRegrowRing(ctx, n, 1 - n.regrow / NODE_DEF[n.type].regrow);
      ctx.beginPath();
      ctx.ellipse(n.x, n.y + 2, 10, 3.4, 0, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = "#7c8592";
      ctx.beginPath();
      ctx.ellipse(n.x, n.y - 2, 6, 4, 0, 0, 6.28);
      ctx.fill();
      return;
    }
    const k = 0.7 + 0.3 * (n.amount / n.max);
    ctx.beginPath();
    ctx.ellipse(n.x, n.y + 4, 15 * k, 5, 0, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = n.type === "rock" ? "#8a94a0" : "#84756e";
    ctx.beginPath();
    const pts = 6;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2 - Math.PI / 2;
      const rr = (13 + Math.sin(n.seed + i * 2.4) * 3) * k;
      const px = n.x + Math.cos(a) * rr;
      const py = n.y - 6 * k + Math.sin(a) * rr * 0.8;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.ellipse(n.x - 4 * k, n.y - 12 * k, 5 * k, 3 * k, -0.4, 0, 6.28);
    ctx.fill();
    if (n.type === "iron") {
      const gl = 0.5 + Math.sin(t * 2 + n.seed) * 0.3;
      ctx.strokeStyle = `rgba(255,150,60,${gl})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(n.x - 7 * k, n.y - 8 * k);
      ctx.lineTo(n.x - 1, n.y - 4 * k);
      ctx.lineTo(n.x + 5 * k, n.y - 10 * k);
      ctx.moveTo(n.x - 2, n.y - 12 * k);
      ctx.lineTo(n.x + 3, n.y - 6 * k);
      ctx.stroke();
    }
    return;
  }
  if (n.type === "crystal") {
    if (!alive) return;
    const gl = 0.6 + Math.sin(t * 2.4 + n.seed) * 0.35;
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(n.x, n.y + 3, 14, 4.5, 0, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = `rgba(127,217,255,${0.16 * gl})`;
    ctx.beginPath();
    ctx.arc(n.x, n.y - 12, 26 * gl, 0, 6.28);
    ctx.fill();
    const shards = 3;
    for (let i = 0; i < shards; i++) {
      const a = (i - 1) * 0.5 + Math.sin(n.seed) * 0.2;
      const h = (16 + i * 6) * (0.6 + 0.4 * (n.amount / n.max));
      ctx.save();
      ctx.translate(n.x + (i - 1) * 9, n.y);
      ctx.rotate(a * 0.4);
      ctx.fillStyle = i === 1 ? "#aee9ff" : "#7fd9ff";
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(5, -h * 0.35);
      ctx.lineTo(3, 0);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-5, -h * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(2.4, -h * 0.4);
      ctx.lineTo(0, -h * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    return;
  }
  // ruin
  if (!alive) {
    ctx.fillStyle = "rgba(90,84,76,0.5)";
    ctx.fillRect(n.x - 12, n.y - 8, 7, 10);
    return;
  }
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(n.x, n.y + 3, 18, 5, 0, 0, 6.28);
  ctx.fill();
  ctx.fillStyle = "#9a917e";
  ctx.fillRect(n.x - 14, n.y - 22, 8, 24);
  ctx.fillRect(n.x + 6, n.y - 16, 8, 18);
  ctx.save();
  ctx.translate(n.x + 7, n.y - 24);
  ctx.rotate(0.5);
  ctx.fillRect(-2, -4, 18, 6);
  ctx.restore();
  const gl = 0.5 + Math.sin(t * 3 + n.seed) * 0.4;
  ctx.fillStyle = `rgba(242,193,77,${0.3 * gl})`;
  ctx.beginPath();
  ctx.arc(n.x - 2, n.y - 8, 10 * gl, 0, 6.28);
  ctx.fill();
  ctx.fillStyle = "#f2c14d";
  ctx.beginPath();
  ctx.arc(n.x - 2, n.y - 8, 2.6, 0, 6.28);
  ctx.fill();
}

function drawRegrowRing(ctx: CanvasRenderingContext2D, n: NodeEnt, p: number) {
  ctx.strokeStyle = "rgba(158,208,122,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(n.x, n.y - 6, 12, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
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
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 64, 16, 0, 0, 6.28);
  ctx.fill();
  // stone platform
  ctx.fillStyle = "#7d7466";
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 58, 15, 0, 0, 6.28);
  ctx.fill();
  ctx.fillStyle = "#8d8474";
  ctx.beginPath();
  ctx.ellipse(x, y + 5, 54, 13, 0, 0, 6.28);
  ctx.fill();
  // crates scale with stored goods
  const cap = Math.round(300 * Math.pow(2, s.stockLvl - 1));
  const stored = s.res.wood + s.res.stone + s.res.iron + s.res.crystal;
  const fill = clamp(stored / cap, 0, 1);
  const stacks = 2 + Math.round(fill * 6);
  for (let i = 0; i < stacks; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const r = 12 + (i % 3) * 12;
    const cx = x + Math.cos(a) * r;
    const cy = y + 2 + Math.sin(a) * r * 0.35 - (i % 2) * 7;
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
  ctx.moveTo(x - 40, y + 6);
  ctx.lineTo(x - 40, y - 52);
  ctx.stroke();
  const w = Math.sin(t * 3.4) * 3;
  ctx.fillStyle = "#d9a545";
  ctx.beginPath();
  ctx.moveTo(x - 40, y - 52);
  ctx.quadraticCurveTo(x - 26, y - 49 + w, x - 14 + w, y - 44 + w);
  ctx.lineTo(x - 40, y - 38);
  ctx.closePath();
  ctx.fill();
  // brazier
  ctx.fillStyle = "#4c4038";
  ctx.beginPath();
  ctx.ellipse(x + 36, y - 40, 7, 4, 0, 0, 6.28);
  ctx.fill();
  ctx.strokeStyle = "#4c4038";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 32, y - 38);
  ctx.lineTo(x + 30, y - 28);
  ctx.moveTo(x + 40, y - 38);
  ctx.lineTo(x + 42, y - 28);
  ctx.stroke();
  const fl = 0.8 + Math.sin(t * 8) * 0.25;
  ctx.fillStyle = `rgba(255,150,60,${0.3 + 0.15 * Math.sin(t * 5)})`;
  ctx.beginPath();
  ctx.arc(x + 36, y - 44, 9 * fl, 0, 6.28);
  ctx.fill();
  ctx.fillStyle = "#ffc873";
  ctx.beginPath();
  ctx.arc(x + 36, y - 44, 3 * fl, 0, 6.28);
  ctx.fill();
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

function drawBuilding(ctx: CanvasRenderingContext2D, s: GameState, key: string, x: number, y: number, idx: number, t: number, day: number) {
  void idx;
  const night = 1 - day;
  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 46, 12, 0, 0, 6.28);
  ctx.fill();
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
    // rotating gear on the wall
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
    // big chimney
    ctx.fillStyle = "#4c4038";
    ctx.fillRect(x + 10, y - 56, 10, 36);
    ctx.fillStyle = "#3c322b";
    ctx.fillRect(x + 8, y - 58, 14, 6);
    // forge mouth glow
    const gl = 0.65 + Math.sin(t * 5.2) * 0.3;
    ctx.fillStyle = `rgba(255,130,40,${0.5 * gl + 0.2 * night})`;
    ctx.beginPath();
    ctx.arc(x - 6, y - 2, 13, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = "#ff9448";
    ctx.fillRect(x - 13, y - 8, 14, 10);
    ctx.fillStyle = "#ffd9a0";
    ctx.fillRect(x - 10, y - 5, 8, 4);
    // anvil
    ctx.fillStyle = "#3a3f46";
    ctx.fillRect(x - 22, y + 2, 12, 4);
    ctx.fillRect(x - 19, y + 6, 6, 3);
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
  // twin flags
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
  // training dummy
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
  // queue pips
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

// unbuilt plot markers
// (drawn separately so they sit under everything interactive)

// ---------- people ----------
function drawWorker(ctx: CanvasRenderingContext2D, s: GameState, w: WorkerEnt, t: number) {
  const moving = w.state === "toNode" || w.state === "toHome";
  const bob = moving ? Math.sin(w.phase * 11) * 1.6 : Math.sin(t * 2 + w.phase) * 0.5;
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(w.x, w.y + 3, 7, 2.6, 0, 0, 6.28);
  ctx.fill();
  // legs
  ctx.strokeStyle = "#4a3826";
  ctx.lineWidth = 2.2;
  const lp = moving ? Math.sin(w.phase * 11) * 3 : 0;
  ctx.beginPath();
  ctx.moveTo(w.x - 1, w.y - 2);
  ctx.lineTo(w.x - 1 - lp * 0.5, w.y + 3);
  ctx.moveTo(w.x + 1, w.y - 2);
  ctx.lineTo(w.x + 1 + lp * 0.5, w.y + 3);
  ctx.stroke();
  // body
  ctx.fillStyle = w.tunic;
  roundRect(ctx, w.x - 4, w.y - 13 + bob, 8, 10, 3);
  ctx.fill();
  // head
  ctx.fillStyle = "#e8c39a";
  ctx.beginPath();
  ctx.arc(w.x, w.y - 16 + bob, 3.4, 0, 6.28);
  ctx.fill();
  ctx.fillStyle = "#6e5230";
  ctx.beginPath();
  ctx.arc(w.x, w.y - 17.6 + bob, 2.6, Math.PI, 0);
  ctx.fill();
  // arm swing while harvesting
  if (w.state === "harvest") {
    const a = Math.sin(w.prog * 14) * 0.9 - 0.4;
    ctx.strokeStyle = "#e8c39a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w.x + 2, w.y - 10 + bob);
    ctx.lineTo(w.x + 2 + Math.cos(a) * 8, w.y - 10 + bob + Math.sin(a) * 8);
    ctx.stroke();
  }
  // carried stack
  if (w.carryRes && w.carryN > 0) {
    const col = RES_META[w.carryRes].color;
    const n = Math.min(3, Math.ceil(w.carryN / 2));
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = col;
      ctx.fillRect(w.x - 4, w.y - 24 - i * 5 + bob, 8, 4);
      ctx.strokeStyle = "rgba(30,20,10,0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(w.x - 4, w.y - 24 - i * 5 + bob, 8, 4);
    }
  }
  void s;
}

const UNIT_SCALE: Record<string, number> = { militia: 1, archer: 0.95, guardian: 1.25, golem: 1.9 };

function drawUnit(ctx: CanvasRenderingContext2D, s: GameState, u: UnitEnt, t: number) {
  void s;
  const k = UNIT_SCALE[u.type];
  const bob = Math.sin(u.bob) * 1.4;
  const lx = u.face * (u.lunge * 7);
  const x = u.x + lx;
  const y = u.y;
  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.beginPath();
  ctx.ellipse(u.x, y + 4, 8 * k, 3 * k, 0, 0, 6.28);
  ctx.fill();
  if (u.type === "golem") {
    ctx.fillStyle = "#6f6a60";
    roundRect(ctx, x - 8 * k, y - 15 * k + bob, 16 * k, 14 * k, 4);
    ctx.fill();
    ctx.fillStyle = "#5d5850";
    roundRect(ctx, x - 12 * k, y - 12 * k + bob, 5 * k, 9 * k, 2);
    ctx.fill();
    roundRect(ctx, x + 7 * k, y - 12 * k + bob, 5 * k, 9 * k, 2);
    ctx.fill();
    ctx.fillStyle = "#7d786c";
    roundRect(ctx, x - 6 * k, y - 22 * k + bob, 12 * k, 8 * k, 3);
    ctx.fill();
    const gl = 0.6 + Math.sin(t * 4 + u.bob) * 0.35;
    ctx.fillStyle = `rgba(255,140,50,${gl})`;
    ctx.beginPath();
    ctx.arc(x, y - 9 * k + bob, 3 * k, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = "#ffd9a0";
    ctx.beginPath();
    ctx.arc(x, y - 9 * k + bob, 1.4 * k, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = "#ff9448";
    ctx.beginPath();
    ctx.arc(x + u.face * 3 * k, y - 19 * k + bob, 1.3 * k, 0, 6.28);
    ctx.fill();
  } else {
    // humanoid base
    const tunic = u.type === "militia" ? "#54687e" : u.type === "archer" ? "#4f7247" : "#7e8894";
    ctx.strokeStyle = "#3a3230";
    ctx.lineWidth = 2.4 * k;
    ctx.beginPath();
    ctx.moveTo(x - 1, y - 2);
    ctx.lineTo(x - 2, y + 4);
    ctx.moveTo(x + 1, y - 2);
    ctx.lineTo(x + 2, y + 4);
    ctx.stroke();
    ctx.fillStyle = tunic;
    roundRect(ctx, x - 4.5 * k, y - 13 * k + bob, 9 * k, 10 * k, 3);
    ctx.fill();
    ctx.fillStyle = "#e8c39a";
    ctx.beginPath();
    ctx.arc(x, y - 16 * k + bob, 3.4 * k, 0, 6.28);
    ctx.fill();
    if (u.type === "militia") {
      ctx.fillStyle = "#8a94a0";
      ctx.beginPath();
      ctx.arc(x, y - 17 * k + bob, 3.6 * k, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "#d8dfe8";
      ctx.lineWidth = 2 * k;
      const sa = u.lunge > 0 ? u.face * 10 : u.face * 4;
      ctx.beginPath();
      ctx.moveTo(x + u.face * 3 * k, y - 9 * k + bob);
      ctx.lineTo(x + sa * k, y - 16 * k + bob);
      ctx.stroke();
    }
    if (u.type === "archer") {
      ctx.fillStyle = "#3f5c39";
      ctx.beginPath();
      ctx.moveTo(x - 4 * k, y - 15 * k + bob);
      ctx.lineTo(x, y - 23 * k + bob);
      ctx.lineTo(x + 4 * k, y - 15 * k + bob);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#8a6a3e";
      ctx.lineWidth = 1.8 * k;
      ctx.beginPath();
      ctx.arc(x + u.face * 5 * k, y - 10 * k + bob, 6 * k, -1.1, 1.1);
      ctx.stroke();
    }
    if (u.type === "guardian") {
      ctx.fillStyle = "#aab4c0";
      ctx.beginPath();
      ctx.arc(x, y - 17 * k + bob, 4 * k, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#c9541e";
      ctx.fillRect(x - 1 * k, y - 23 * k + bob, 2 * k, 4 * k);
      ctx.fillStyle = "#8a94a0";
      roundRect(ctx, x + u.face * 4 * k - 2 * k, y - 13 * k + bob, 5 * k, 11 * k, 2);
      ctx.fill();
      ctx.strokeStyle = "#5c6670";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + u.face * 4 * k - 2 * k, y - 13 * k + bob, 5 * k, 11 * k);
    }
  }
  drawHpBar(ctx, x, y - 26 * k + bob, u.hp / u.maxhp, "#6fce62", 26 * k);
}

function drawEnemy(ctx: CanvasRenderingContext2D, s: GameState, e: EnemyEnt, t: number) {
  void s;
  const def = ENEMIES[e.type];
  const k = def.scale;
  const bob = Math.sin(e.bob) * 1.4;
  const lx = e.face * (e.lunge * 8);
  const x = e.x + lx;
  const y = e.y;
  ctx.fillStyle = "rgba(0,0,0,0.26)";
  ctx.beginPath();
  ctx.ellipse(e.x, y + 4, 8 * k, 3.2 * k, 0, 0, 6.28);
  ctx.fill();
  if (e.type === "brute" || e.type === "warlord") {
    ctx.fillStyle = "#4a3f52";
    roundRect(ctx, x - 7 * k, y - 14 * k + bob, 14 * k, 13 * k, 4);
    ctx.fill();
    // back spikes
    ctx.fillStyle = "#332b3a";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 4 * k - 3, y - 14 * k + bob);
      ctx.lineTo(x + i * 4 * k, y - 21 * k + bob);
      ctx.lineTo(x + i * 4 * k + 3, y - 14 * k + bob);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#5c5066";
    ctx.beginPath();
    ctx.arc(x, y - 16 * k + bob, 4.4 * k, 0, 6.28);
    ctx.fill();
    if (e.type === "warlord") {
      // horns
      ctx.strokeStyle = "#d8cdb4";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x - 6 * k, y - 20 * k + bob);
      ctx.quadraticCurveTo(x - 9 * k, y - 26 * k + bob, x - 5 * k, y - 28 * k + bob);
      ctx.moveTo(x + 6 * k, y - 20 * k + bob);
      ctx.quadraticCurveTo(x + 9 * k, y - 26 * k + bob, x + 5 * k, y - 28 * k + bob);
      ctx.stroke();
      const aura = 0.5 + Math.sin(t * 3) * 0.3;
      ctx.fillStyle = `rgba(200,60,50,${0.16 * aura})`;
      ctx.beginPath();
      ctx.arc(x, y - 12 * k, 22 * k, 0, 6.28);
      ctx.fill();
    }
  } else if (e.type === "shaman") {
    ctx.fillStyle = "#4f3a5e";
    ctx.beginPath();
    ctx.moveTo(x - 7 * k, y + 3);
    ctx.lineTo(x, y - 20 * k + bob);
    ctx.lineTo(x + 7 * k, y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c9b6d8";
    ctx.beginPath();
    ctx.arc(x, y - 17 * k + bob, 3.2 * k, 0, 6.28);
    ctx.fill();
    // staff
    ctx.strokeStyle = "#6e5230";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + e.face * 5 * k, y + 2);
    ctx.lineTo(x + e.face * 7 * k, y - 24 * k + bob);
    ctx.stroke();
    const gl = 0.6 + Math.sin(t * 5 + e.bob) * 0.35;
    ctx.fillStyle = `rgba(190,120,255,${gl})`;
    ctx.beginPath();
    ctx.arc(x + e.face * 7 * k, y - 25 * k + bob, 3.4 * k, 0, 6.28);
    ctx.fill();
  } else {
    // raider, hunched
    ctx.fillStyle = "#544a5e";
    roundRect(ctx, x - 4 * k, y - 11 * k + bob, 9 * k, 9 * k, 3);
    ctx.fill();
    ctx.fillStyle = "#3f3748";
    ctx.beginPath();
    ctx.arc(x + e.face * 2 * k, y - 14 * k + bob, 3.6 * k, 0, 6.28);
    ctx.fill();
    ctx.strokeStyle = "#8a6a3e";
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.moveTo(x + e.face * 2 * k, y - 8 * k + bob);
    ctx.lineTo(x + e.face * 12 * k, y - 14 * k + bob);
    ctx.stroke();
  }
  // glowing eyes
  ctx.fillStyle = e.type === "shaman" ? "#c98aff" : "#ff5a3c";
  ctx.beginPath();
  ctx.arc(x + e.face * 1.6 * k, y - 15.5 * k + bob, 0.9 * k, 0, 6.28);
  ctx.arc(x + e.face * 4 * k, y - 15.5 * k + bob, 0.9 * k, 0, 6.28);
  ctx.fill();
  drawHpBar(ctx, x, y - 24 * k + bob, e.hp / e.maxhp, "#e0604e", 24 * k);
}

function drawHpBar(ctx: CanvasRenderingContext2D, x: number, y: number, p: number, color: string, w: number) {
  if (p >= 0.999) return;
  ctx.fillStyle = "rgba(15,10,8,0.7)";
  ctx.fillRect(x - w / 2, y, w, 3.4);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2 + 0.5, y + 0.5, (w - 1) * clamp(p, 0, 1), 2.4);
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
    ctx.fillStyle = `${col}44`;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 9, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 4.4, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(o.x - 1.2, o.y - 1.4, 1.5, 0, 6.28);
    ctx.fill();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const p of s.particles) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.kind === "chip" || p.kind === "leaf") {
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
    ctx.globalAlpha = Math.min(1, a * 1.6);
    ctx.font = `800 ${f.size}px Sora`;
    ctx.strokeStyle = "rgba(20,12,6,0.8)";
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
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
  // land
  ctx.fillStyle = "#3f3a28";
  ctx.fillRect(0, (h - WORLD.h * k) / 2, WORLD.w * k, WORLD.h * k);
  const oy = (h - WORLD.h * k) / 2;
  // ashen
  ctx.fillStyle = "#36302e";
  ctx.fillRect(1450 * k, oy, (WORLD.w - 1450) * k, WORLD.h * k);
  // claimed glow
  ctx.fillStyle = "rgba(255,170,90,0.13)";
  ctx.fillRect(0, oy, s.frontX * k, WORLD.h * k);
  // nodes
  ctx.fillStyle = "rgba(120,150,90,0.6)";
  for (const n of s.nodes) {
    if (n.amount <= 0) continue;
    ctx.fillRect(n.x * k - 0.5, oy + n.y * k - 0.5, 1.4, 1.4);
  }
  // buildings
  ctx.fillStyle = "#ffb25e";
  for (const b of s.buildingEnts) ctx.fillRect(b.x * k - 1.5, oy + b.y * k - 1.5, 3, 3);
  ctx.fillRect(WORLD.stockX * k - 2, oy + WORLD.stockY * k - 2, 4, 4);
  // workers
  ctx.fillStyle = "#f4e6c8";
  for (const wk of s.workers) ctx.fillRect(wk.x * k - 0.5, oy + wk.y * k - 0.5, 1.2, 1.2);
  // units
  ctx.fillStyle = "#7ec3ff";
  for (const u of s.units) ctx.fillRect(u.x * k - 1, oy + u.y * k - 1, 2, 2);
  // enemies
  ctx.fillStyle = "#ff5a48";
  for (const e of s.enemies) ctx.fillRect(e.x * k - 1.2, oy + e.y * k - 1.2, 2.4, 2.4);
  // front line
  ctx.strokeStyle = "rgba(255,220,170,0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(s.frontX * k, oy);
  ctx.lineTo(s.frontX * k, oy + WORLD.h * k);
  ctx.stroke();
  // camera viewport
  const cw = vw / s.cam.z;
  const ch = vh / s.cam.z;
  ctx.strokeStyle = "rgba(255,210,140,0.7)";
  ctx.strokeRect((s.cam.x - cw / 2) * k, oy + (s.cam.y - ch / 2) * k, cw * k, ch * k);
}
