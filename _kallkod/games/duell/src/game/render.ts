import {
  ANCHORS,
  FH,
  FLOOR_Y,
  SOLIDS,
  SURFACES,
  WORLD_W,
  bladeDir,
  bladeSegment,
  clamp,
  handOf,
  lerp,
  type Fighter,
  type World,
} from "./types";

export interface Rose {
  x: number;
  y: number;
  dx: number;
  dy: number;
  active: boolean;
  life: number;
}

export interface View {
  cssW: number;
  cssH: number;
  dpr: number;
  camX: number;
  camY: number;
  zoom: number;
  shakeX: number;
  shakeY: number;
  rose: Rose | null;
  showAim: boolean;
  aimX: number;
  aimY: number;
}

export interface Assets {
  bg: HTMLImageElement | null;
  stone: CanvasPattern | null;
}

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function screenTransform(ctx: CanvasRenderingContext2D, v: View) {
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
}

function applyCamera(ctx: CanvasRenderingContext2D, v: View) {
  const z = v.zoom;
  ctx.setTransform(
    v.dpr * z,
    0,
    0,
    v.dpr * z,
    v.dpr * (v.cssW / 2 - v.camX * z + v.shakeX),
    v.dpr * (v.cssH / 2 - v.camY * z + v.shakeY),
  );
}

function toScreen(v: View, x: number, y: number) {
  return {
    x: (x - v.camX) * v.zoom + v.cssW / 2 + v.shakeX,
    y: (y - v.camY) * v.zoom + v.cssH / 2 + v.shakeY,
  };
}

export function render(ctx: CanvasRenderingContext2D, w: World, v: View, assets: Assets) {
  screenTransform(ctx, v);
  ctx.clearRect(0, 0, v.cssW, v.cssH);
  drawSky(ctx, v, assets.bg, w.time);
  applyCamera(ctx, v);
  drawAbyss(ctx);
  drawArch(ctx, w.time);
  drawChains(ctx, w.time);
  drawSolids(ctx, assets.stone);
  drawPlatforms(ctx, assets.stone);
  drawLanternGlow(ctx, w.time);
  drawGhosts(ctx, w);
  drawTethers(ctx, w);
  drawPickups(ctx, w);
  drawKnives(ctx, w);
  drawTrail(ctx, w.rival);
  drawTrail(ctx, w.player);
  drawTelegraph(ctx, w.rival);
  drawTelegraph(ctx, w.player);
  drawRibbon(ctx, w.rival);
  drawRibbon(ctx, w.player);
  drawFighter(ctx, w.rival, w.time);
  drawFighter(ctx, w.player, w.time);
  drawParticles(ctx, w);
  drawShocks(ctx, w);
  drawSlashes(ctx, w);
  if (v.showAim) drawAim(ctx, v.aimX, v.aimY);
  if (w.debug) drawDebug(ctx, w);
  screenTransform(ctx, v);
  drawFloaters(ctx, w, v);
  drawOffscreen(ctx, w, v);
  drawRose(ctx, v);
  drawLetter(ctx, v, w);
  if (w.flash > 0.01) {
    ctx.globalAlpha = w.flash * 0.16;
    ctx.fillStyle = w.flashColor;
    ctx.fillRect(0, 0, v.cssW, v.cssH);
    ctx.globalAlpha = 1;
  }
}

function drawSky(ctx: CanvasRenderingContext2D, v: View, bg: HTMLImageElement | null, time: number) {
  const g = ctx.createLinearGradient(0, 0, 0, v.cssH);
  g.addColorStop(0, "#101628");
  g.addColorStop(0.45, "#1a1430");
  g.addColorStop(1, "#0b0a0e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, v.cssW, v.cssH);

  const moonX = v.cssW * 0.78 - v.camX * 0.02;
  const moonY = v.cssH * 0.16;
  const glow = ctx.createRadialGradient(moonX, moonY, 8, moonX, moonY, 180);
  glow.addColorStop(0, "rgba(244, 232, 206, 0.55)");
  glow.addColorStop(1, "rgba(244, 232, 206, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f3e7cf";
  ctx.beginPath();
  ctx.arc(moonX, moonY, 18 + Math.sin(time * 0.4) * 0.4, 0, Math.PI * 2);
  ctx.fill();

  if (bg && bg.complete && bg.naturalWidth) {
    const scale = Math.max(v.cssW / bg.naturalWidth, (v.cssH * 0.72) / bg.naturalHeight);
    const dw = bg.naturalWidth * scale * 1.08;
    const dh = bg.naturalHeight * scale * 1.08;
    const x = (v.cssW - dw) / 2 - (v.camX - 1050) * 0.06;
    const y = -dh * 0.02;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, v.cssW, v.cssH * 0.72);
    ctx.clip();
    ctx.globalAlpha = 0.72;
    ctx.drawImage(bg, x, y, dw, dh);
    ctx.restore();
  }
  const mist = ctx.createLinearGradient(0, v.cssH * 0.28, 0, v.cssH);
  mist.addColorStop(0, "rgba(7,8,12,0)");
  mist.addColorStop(0.42, "rgba(7,8,12,0.18)");
  mist.addColorStop(0.78, "rgba(7,8,12,0.62)");
  mist.addColorStop(1, "rgba(7,8,12,0.9)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, 0, v.cssW, v.cssH);
}

function drawAbyss(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 820, 0, 1100);
  g.addColorStop(0, "rgba(12,10,14,0)");
  g.addColorStop(1, "#05060a");
  ctx.fillStyle = g;
  ctx.fillRect(-200, 820, WORLD_W + 400, 400);
}

function fillStone(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stone: CanvasPattern | null, shade: string) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (stone) {
    ctx.fillStyle = stone;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, w, h);
  } else {
    ctx.fillStyle = "#2c2822";
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function moss(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.fillStyle = "rgba(78, 98, 62, 0.55)";
  const n = Math.floor(w / 36);
  for (let i = 0; i < n; i++) {
    const h = hash(x * 0.1 + i * 19.2);
    if (h < 0.42) continue;
    ctx.fillRect(x + i * 36 + h * 8, y - 2, 6 + h * 16, 3);
  }
}

function drawPlatforms(ctx: CanvasRenderingContext2D, stone: CanvasPattern | null) {
  for (const s of SURFACES) {
    if (s.id === "floor") continue;
    const lip = 18;
    fillStone(ctx, s.x, s.y, s.w, lip, stone, "rgba(10,8,6,0.48)");
    ctx.fillStyle = "rgba(8,6,5,0.55)";
    ctx.fillRect(s.x + 6, s.y + lip, s.w - 12, 10);
    ctx.fillStyle = "rgba(236, 214, 170, 0.42)";
    ctx.fillRect(s.x, s.y, s.w, 3);
    moss(ctx, s.x, s.y, s.w);
  }
  const floor = SURFACES[0];
  fillStone(ctx, floor.x, floor.y, floor.w, 78, stone, "rgba(8,6,5,0.5)");
  const face = ctx.createLinearGradient(0, floor.y, 0, floor.y + 78);
  face.addColorStop(0, "rgba(0,0,0,0)");
  face.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = face;
  ctx.fillRect(floor.x, floor.y, floor.w, 78);
  ctx.fillStyle = "rgba(240, 220, 180, 0.38)";
  ctx.fillRect(floor.x, floor.y, floor.w, 3);
  moss(ctx, floor.x, floor.y, floor.w);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.moveTo(floor.x, floor.y);
  ctx.lineTo(floor.x - 26, floor.y + 78);
  ctx.lineTo(floor.x, floor.y + 78);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(floor.x + floor.w, floor.y);
  ctx.lineTo(floor.x + floor.w + 26, floor.y + 78);
  ctx.lineTo(floor.x + floor.w, floor.y + 78);
  ctx.fill();
}

function drawSolids(ctx: CanvasRenderingContext2D, stone: CanvasPattern | null) {
  for (const r of SOLIDS) {
    fillStone(ctx, r.x, r.y, r.w, r.h, stone, r.id.startsWith("wall") ? "rgba(6,5,8,0.62)" : "rgba(8,6,5,0.4)");
    ctx.fillStyle = "rgba(236,214,170,0.22)";
    ctx.fillRect(r.x, r.y, r.w, 3);
    if (!r.id.startsWith("wall")) {
      ctx.fillStyle = "rgba(236,214,170,0.18)";
      ctx.fillRect(r.x - 6, r.y, r.w + 12, 8);
    }
  }
}

function drawArch(ctx: CanvasRenderingContext2D, time: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(214, 196, 160, 0.16)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(1050, 430, 250, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(228,177,90,0.18)";
  ctx.beginPath();
  ctx.arc(1050 + Math.sin(time * 0.2) * 2, 430, 236, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();
}

function drawChains(ctx: CanvasRenderingContext2D, time: number) {
  ANCHORS.forEach((a, i) => {
    const swing = Math.sin(time * 0.75 + i * 1.3) * 12;
    ctx.beginPath();
    ctx.moveTo(a.x, 28);
    ctx.quadraticCurveTo(a.x + swing, (a.y + 28) / 2, a.x + swing * 0.35, a.y);
    ctx.strokeStyle = "rgba(186, 176, 158, 0.45)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    const lx = a.x + swing * 0.35;
    const ly = a.y + 16;
    ctx.fillStyle = "#3a2a18";
    ctx.fillRect(lx - 5, ly - 8, 10, 14);
    ctx.fillStyle = "#e4b15a";
    ctx.fillRect(lx - 3, ly - 2, 6, 5);
  });
}

function drawLanternGlow(ctx: CanvasRenderingContext2D, time: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ANCHORS.forEach((a, i) => {
    const swing = Math.sin(time * 0.75 + i * 1.3) * 12;
    const lx = a.x + swing * 0.35;
    const ly = a.y + 18;
    const flick = 0.75 + Math.sin(time * 9 + i * 2) * 0.18;
    const rad = 110 * flick;
    const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, rad);
    g.addColorStop(0, `rgba(255, 186, 92, ${0.28 * flick})`);
    g.addColorStop(1, "rgba(255, 160, 60, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lx, ly, rad, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function groundUnder(f: Fighter) {
  let gy = FLOOR_Y;
  for (const s of SURFACES) {
    if (f.x < s.x || f.x > s.x + s.w) continue;
    if (s.y >= f.y - 2 && s.y < gy) gy = s.y;
  }
  return gy;
}

function drawGhosts(ctx: CanvasRenderingContext2D, w: World) {
  for (const g of w.ghosts) {
    ctx.save();
    ctx.globalAlpha = clamp(g.life * 2.2, 0, 0.35);
    ctx.translate(g.x, g.y);
    ctx.scale(g.facing, 1);
    ctx.fillStyle = g.color;
    ctx.beginPath();
    ctx.ellipse(0, -FH * 0.48, 14, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawTethers(ctx: CanvasRenderingContext2D, w: World) {
  for (const f of [w.player, w.rival]) {
    if (!f.tether) continue;
    const y = f.y - FH * 0.62;
    ctx.beginPath();
    const segs = 10;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = lerp(f.x, f.tether.x, t);
      const yy = lerp(y, f.tether.y, t) + Math.sin(t * Math.PI) * Math.sin(w.time * 16) * 5;
      if (i === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.strokeStyle = f.pal.glow;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(f.tether.x, f.tether.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPickups(ctx: CanvasRenderingContext2D, w: World) {
  for (const p of w.pickups) {
    if (p.respawn > 0) continue;
    ctx.save();
    ctx.translate(p.x, p.y - 6);
    ctx.rotate(-0.6);
    ctx.fillStyle = "#d7d2c8";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(16, -2);
    ctx.lineTo(18, 0);
    ctx.lineTo(0, 3);
    ctx.fill();
    ctx.fillStyle = "#e4b15a";
    ctx.fillRect(-4, -2, 4, 4);
    ctx.restore();
    const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 22);
    g.addColorStop(0, "rgba(228,177,90,0.28)");
    g.addColorStop(1, "rgba(228,177,90,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawKnives(ctx: CanvasRenderingContext2D, w: World) {
  for (const k of w.knives) {
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(k.spin);
    ctx.fillStyle = k.stuck ? "#c8c2b6" : "#f4f0e8";
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-6, -2.4);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-6, 2.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8d2e34";
    ctx.fillRect(-10, -2, 4, 4);
    ctx.restore();
  }
}

function drawTrail(ctx: CanvasRenderingContext2D, f: Fighter) {
  if (f.trail.length < 2) return;
  ctx.beginPath();
  f.trail.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = f.pal.glow;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawTelegraph(ctx: CanvasRenderingContext2D, f: Fighter) {
  if (!f.attack || (f.stage !== "windup" && f.stage !== "active")) return;
  const h = handOf(f);
  const a = f.attack;
  ctx.save();
  ctx.lineCap = "round";
  if (a.extend) {
    const d = bladeDir(f.facing, 0.06);
    ctx.strokeStyle = f.glint ? "#fff" : f.pal.glow;
    ctx.globalAlpha = f.glint ? 0.9 : 0.28;
    ctx.lineWidth = f.glint ? 3 : 1.4;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(h.x + d.x * a.reach, h.y + d.y * a.reach);
    ctx.stroke();
  } else if (f.stage === "windup") {
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const local = lerp(a.a0, a.a1, i / 8);
      const d = bladeDir(f.facing, local);
      const x = h.x + d.x * a.reach * 0.92;
      const y = h.y + d.y * a.reach * 0.92;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = f.glint ? "#fff8ea" : f.pal.glow;
    ctx.globalAlpha = f.glint ? 0.9 : 0.24;
    ctx.lineWidth = f.glint ? 3.4 : 1.5;
    ctx.stroke();
  }
  if (f.glint) {
    const d = bladeDir(f.facing, f.bladeLocal);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(h.x + d.x * f.bladeLen, h.y + d.y * f.bladeLen, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = f.pal.glow;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(f.x, f.y - FH * 0.55, 46, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRibbon(ctx: CanvasRenderingContext2D, f: Fighter) {
  if (f.stage !== "active" || !f.attack || f.attack.extend || f.phase === "bash") return;
  const h = handOf(f);
  const a = f.attack;
  const u = clamp((f.phaseT - a.windup) / Math.max(0.04, a.active), 0, 1);
  const to = lerp(a.a0, a.a1, u);
  ctx.save();
  ctx.lineCap = "round";

  // Glowing energy crescent
  ctx.beginPath();
  ctx.moveTo(h.x, h.y);
  for (let i = 0; i <= 10; i++) {
    const local = lerp(a.a0, to, i / 10);
    const d = bladeDir(f.facing, local);
    ctx.lineTo(h.x + d.x * a.reach, h.y + d.y * a.reach);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(h.x, h.y, a.reach * 0.25, h.x, h.y, a.reach * 1.05);
  g.addColorStop(0, "rgba(255,255,255,0.0)");
  g.addColorStop(0.65, f.pal.glow);
  g.addColorStop(1, "rgba(255,255,255,0.95)");
  ctx.fillStyle = g;
  ctx.globalAlpha = 0.6;
  ctx.fill();

  // Blazing white cutting outer arc line
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const local = lerp(a.a0, to, i / 10);
    const d = bladeDir(f.facing, local);
    const ex = h.x + d.x * a.reach;
    const ey = h.y + d.y * a.reach;
    if (i === 0) ctx.moveTo(ex, ey);
    else ctx.lineTo(ex, ey);
  }
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3.6;
  ctx.globalAlpha = 0.95;
  ctx.stroke();

  ctx.restore();
}

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, time: number) {
  const gy = f.onGround ? f.y : groundUnder(f);
  const lift = clamp((gy - f.y) / 280, 0, 1);
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.32 * (1 - lift * 0.7)})`;
  ctx.beginPath();
  ctx.ellipse(f.x, gy + 2, 22 - lift * 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(f.x, f.y + Math.max(0, f.squash) * 4);
  ctx.scale(f.facing, 1);
  ctx.rotate(-f.vx * f.facing * 0.00028);

  const hip = -FH * 0.46;
  let spin = 0;
  if (f.phase === "roll") spin = (f.phaseT / Math.max(0.05, f.phaseDur)) * Math.PI * 2 * f.rollDir * f.facing;
  else if (f.phase === "vault") spin = Math.min(1, f.phaseT / 0.5) * Math.PI * 1.12;
  else if (f.phase === "flip") spin = -Math.min(1, f.phaseT / 0.52) * Math.PI * 1.2;
  else if (f.phase === "downed") spin = -1.2;
  else if (f.phase === "bow") spin = 0.34;
  else if (f.phase === "slide") spin = 0.55;
  else if (f.phase === "launch") spin = clamp(-f.vx * f.facing * 0.001, -0.7, 0.7);

  if (spin) {
    ctx.translate(0, hip);
    ctx.rotate(spin);
    ctx.translate(0, -hip);
  }

  const breath = Math.sin(time * 2.2 + f.x * 0.01) * 1.1;
  const shoulder = -FH * 0.74 + breath;
  const swing = Math.sin(f.gait) * (f.onGround ? Math.min(1, Math.abs(f.vx) / 200) : 0.35);
  const air = f.onGround ? 0 : clamp(-f.vy / 800, -1, 1);

  drawCape(ctx, shoulder, f, time);
  drawLeg(ctx, -7, hip, swing + air * 0.3, true, f);
  drawLeg(ctx, 5, hip, -swing + air * 0.15, false, f);
  drawTorso(ctx, shoulder, hip, f);
  drawShield(ctx, f, shoulder);
  drawSword(ctx, f);
  drawHead(ctx, shoulder, f, time);

  if (f.hitFlash > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.min(1.0, f.hitFlash * 6);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(2, shoulder + 12, 24, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
}

function drawCape(ctx: CanvasRenderingContext2D, shoulder: number, f: Fighter, time: number) {
  const trail = -26 - Math.min(46, Math.abs(f.vx) * 0.05);
  const wave = Math.sin(time * 5 + f.x * 0.02) * 5;
  ctx.fillStyle = f.pal.cape;
  ctx.beginPath();
  ctx.moveTo(-2, shoulder + 4);
  ctx.quadraticCurveTo(trail * 0.4, shoulder + 18, trail + wave, shoulder + 36);
  ctx.quadraticCurveTo(trail + 8, -FH * 0.28, -4, -FH * 0.36);
  ctx.closePath();
  ctx.globalAlpha = 0.92;
  ctx.fill();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = f.pal.cloth;
  ctx.beginPath();
  ctx.moveTo(-1, shoulder + 8);
  ctx.quadraticCurveTo(trail * 0.55, shoulder + 28 + wave, trail * 0.7, shoulder + 48);
  ctx.lineTo(-2, shoulder + 20);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawLeg(ctx: CanvasRenderingContext2D, hipX: number, hipY: number, swing: number, back: boolean, f: Fighter) {
  const kneeX = hipX + swing * 10;
  const kneeY = hipY * 0.45;
  const footX = hipX + swing * 18;
  ctx.strokeStyle = back ? f.pal.armorB : f.pal.armorA;
  ctx.lineWidth = back ? 7 : 8.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(kneeX, kneeY);
  ctx.lineTo(footX, -1);
  ctx.stroke();
  ctx.fillStyle = f.pal.deep;
  ctx.beginPath();
  ctx.moveTo(footX - 8, -2);
  ctx.lineTo(footX + 9, -2);
  ctx.lineTo(footX + 7, 5);
  ctx.lineTo(footX - 6, 5);
  ctx.fill();
}

function drawTorso(ctx: CanvasRenderingContext2D, shoulder: number, hip: number, f: Fighter) {
  const g = ctx.createLinearGradient(-16, shoulder, 16, hip);
  g.addColorStop(0, f.pal.metal);
  g.addColorStop(0.35, f.pal.armorA);
  g.addColorStop(1, f.pal.armorB);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-13, shoulder + 8);
  ctx.quadraticCurveTo(-18, hip + 4, -8, hip + 6);
  ctx.lineTo(11, hip + 4);
  ctx.quadraticCurveTo(18, shoulder + 16, 13, shoulder);
  ctx.quadraticCurveTo(2, shoulder - 12, -13, shoulder + 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = f.pal.trim;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = f.pal.cape;
  ctx.fillRect(-8, hip + 1, 16, 5);
  ctx.fillStyle = f.pal.trim;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(8, shoulder + 6, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = f.pal.deep;
  ctx.fillRect(-3, shoulder + 10, 7, 16);
}

function drawShield(ctx: CanvasRenderingContext2D, f: Fighter, shoulder: number) {
  const raise = f.shield;
  ctx.save();
  ctx.translate(16 + raise * 8, shoulder + 16 - raise * 18);
  ctx.rotate(-0.25 - raise * 0.55);
  const s = 1 + raise * 0.12;
  ctx.scale(s, s);
  const g = ctx.createLinearGradient(-16, -24, 14, 26);
  g.addColorStop(0, f.pal.metal);
  g.addColorStop(0.55, f.pal.armorB);
  g.addColorStop(1, "#14110e");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(16, -8);
  ctx.lineTo(12, 16);
  ctx.lineTo(0, 30);
  ctx.lineTo(-12, 16);
  ctx.lineTo(-16, -8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = f.pal.trim;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(0, 16);
  ctx.stroke();
  ctx.fillStyle = f.pal.glow;
  ctx.beginPath();
  ctx.arc(0, -2, 3.4, 0, Math.PI * 2);
  ctx.fill();
  if (f.parryWindow > 0) {
    ctx.strokeStyle = "#fff";
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSword(ctx: CanvasRenderingContext2D, f: Fighter) {
  const len = f.bladeLen;
  ctx.save();
  ctx.translate(8, -FH * 0.7);
  ctx.rotate(-f.bladeLocal);
  if (f.stage === "active" || f.glint) {
    ctx.shadowColor = f.pal.glow;
    ctx.shadowBlur = f.glint ? 16 : 10;
  }
  const g = ctx.createLinearGradient(0, 0, len, 0);
  g.addColorStop(0, "#6d645c");
  g.addColorStop(0.12, f.pal.trim);
  g.addColorStop(0.45, "#f7f3ec");
  g.addColorStop(1, "#ffffff");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-2, -3.3);
  ctx.lineTo(len - 12, -2.1);
  ctx.lineTo(len, 0);
  ctx.lineTo(len - 12, 2.1);
  ctx.lineTo(-2, 3.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(4, -1.2);
  ctx.lineTo(len - 8, -0.4);
  ctx.stroke();
  ctx.fillStyle = f.pal.trim;
  ctx.fillRect(-8, -5, 8, 10);
  ctx.fillStyle = f.pal.deep;
  ctx.fillRect(-14, -2.2, 8, 4.4);
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, shoulder: number, f: Fighter, time: number) {
  const y = shoulder - 16;
  const g = ctx.createLinearGradient(-12, y - 14, 12, y + 12);
  g.addColorStop(0, f.pal.metal);
  g.addColorStop(1, f.pal.armorB);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(1, y, 12.5, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = f.pal.trim;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "#0c0d12";
  ctx.fillRect(-6, y - 2, 14, 3.2);
  ctx.fillStyle = f.pal.glow;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(-4, y - 1.2, 10, 1.4);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = f.pal.plume;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-2, y - 12);
  ctx.quadraticCurveTo(-18, y - 26 + Math.sin(time * 3) * 2, -28 - Math.min(10, Math.abs(f.vx) * 0.02), y - 8);
  ctx.stroke();
}

function drawParticles(ctx: CanvasRenderingContext2D, w: World) {
  for (const p of w.particles) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a * (p.kind === "ember" ? 0.7 : 1);
    ctx.fillStyle = p.color;
    if (p.kind === "spark") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillRect(0, -0.6, p.size * 3.2, 1.3);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.4, p.size * a), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawShocks(ctx: CanvasRenderingContext2D, w: World) {
  for (const s of w.shocks) {
    const u = 1 - s.life / s.max;
    // Outer expanding ring
    ctx.beginPath();
    ctx.arc(s.x, s.y, 10 + u * s.power, 0, Math.PI * 2);
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = (1 - u) * 0.8;
    ctx.lineWidth = 3 * (1 - u * 0.6);
    ctx.stroke();

    // Inner bright core ring
    ctx.beginPath();
    ctx.arc(s.x, s.y, 4 + u * s.power * 0.45, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = (1 - u) * 0.9;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSlashes(ctx: CanvasRenderingContext2D, w: World) {
  if (!w.slashes || !w.slashes.length) return;
  ctx.save();
  ctx.lineCap = "round";
  for (const sl of w.slashes) {
    const u = clamp(sl.life / sl.max, 0, 1);
    ctx.beginPath();
    ctx.moveTo(sl.x1, sl.y1);
    ctx.lineTo(sl.x2, sl.y2);

    // Inner bright white laser cut
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = sl.width * u;
    ctx.globalAlpha = u * 0.95;
    ctx.stroke();

    // Outer glow
    ctx.strokeStyle = sl.color;
    ctx.lineWidth = sl.width * 2.5 * u;
    ctx.globalAlpha = u * 0.55;
    ctx.stroke();
  }
  ctx.restore();
}

function drawAim(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(244,239,230,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.lineTo(x + 6, y);
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x, y + 6);
  ctx.stroke();
  ctx.restore();
}

function drawDebug(ctx: CanvasRenderingContext2D, w: World) {
  ctx.save();
  ctx.strokeStyle = "rgba(120,220,255,0.7)";
  ctx.lineWidth = 1;
  for (const f of [w.player, w.rival]) {
    ctx.strokeRect(f.x - 18, f.y - FH, 36, FH);
    ctx.beginPath();
    ctx.arc(f.x, f.y - FH * 0.58, 26, 0, Math.PI * 2);
    ctx.stroke();
    const seg = bladeSegment(f);
    ctx.strokeStyle = f.stage === "active" ? "#ff5a5a" : "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(120,220,255,0.7)";
  }
  ctx.restore();
}

function drawFloaters(ctx: CanvasRenderingContext2D, w: World, v: View) {
  ctx.textAlign = "center";
  for (const f of w.floaters) {
    const p = toScreen(v, f.x, f.y);
    const u = clamp(f.life / f.max, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, u * 1.5);
    ctx.translate(p.x, p.y);

    if (f.isDmg) {
      // Visceral bouncing damage number with heavy shadow
      const scale = f.big ? 1.4 : 1.05;
      ctx.scale(scale, scale);
      ctx.font = f.big ? "900 24px Cinzel, Georgia, serif" : "700 18px Outfit, sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
    } else {
      // Action Callouts: "PARRY!", "GUARD BREAK!", etc.
      ctx.font = f.big ? "900 20px Cinzel, Georgia, serif" : "600 13px Outfit, sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 7;
      if (f.big) {
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.strokeText(f.text, 0, 0);
      }
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
    }
    ctx.restore();
  }
}

function drawOffscreen(ctx: CanvasRenderingContext2D, w: World, v: View) {
  if (w.mode === "intro" || w.mode === "between") return;
  for (const f of [w.player, w.rival]) {
    const p = toScreen(v, f.x, f.y - FH * 0.55);
    const pad = 36;
    if (p.x > pad && p.x < v.cssW - pad && p.y > 70 && p.y < v.cssH - pad) continue;
    const x = clamp(p.x, pad, v.cssW - pad);
    const y = clamp(p.y, 78, v.cssH - pad);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = f.pal.glow;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 8);
    ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.font = "500 10px Outfit, sans-serif";
    ctx.fillStyle = "#f4efe6";
    ctx.textAlign = "center";
    ctx.fillText(f.short, 0, 20);
    ctx.restore();
  }
}

function drawRose(ctx: CanvasRenderingContext2D, v: View) {
  const r = v.rose;
  if (!r || r.life <= 0) return;
  const alpha = r.active ? 0.85 : clamp(r.life * 2, 0, 0.85);
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.scale(v.cssW < 800 ? 1.45 : 1, v.cssW < 800 ? 1.45 : 1);
  ctx.globalAlpha = alpha;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, -1],
    [0, 1],
    [0.75, -0.75],
    [-0.75, -0.75],
    [0.75, 0.75],
    [-0.75, 0.75],
  ];
  const mag = Math.hypot(r.dx, r.dy);
  const nx = mag > 8 ? r.dx / mag : 0;
  const ny = mag > 8 ? r.dy / mag : 0;
  for (const [dx, dy] of dirs) {
    const dot = nx * dx + ny * dy;
    const hot = mag > 12 && dot > 0.82;
    ctx.strokeStyle = hot ? "#f0d7a2" : "rgba(244,239,230,0.35)";
    ctx.lineWidth = hot ? 2.4 : 1;
    ctx.beginPath();
    ctx.moveTo(dx * 18, dy * 18);
    ctx.lineTo(dx * 36, dy * 36);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(244,239,230,0.5)";
  ctx.stroke();
  ctx.restore();
}

function drawLetter(ctx: CanvasRenderingContext2D, v: View, w: World) {
  const bar = w.letter * Math.min(54, v.cssH * 0.08);
  if (bar < 0.4) return;
  ctx.fillStyle = "#05060a";
  ctx.fillRect(0, 0, v.cssW, bar);
  ctx.fillRect(0, v.cssH - bar, v.cssW, bar);
}
