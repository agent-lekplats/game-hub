import { GameState, BASE_W, LANE_X, LANE_W, WORLD_W, WORLD_H, BUILDING_INFO, RES_COLORS, Building, Worker, Unit, ResNode } from './types';
import { canPlaceAt, inTerritory } from './engine';

let grass: HTMLCanvasElement | null = null;
function grassTex() {
  if (grass) return grass;
  const c = document.createElement('canvas'); c.width = BASE_W; c.height = WORLD_H;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, BASE_W, WORLD_H); grad.addColorStop(0, '#5f8f3e'); grad.addColorStop(1, '#4f7d36');
  g.fillStyle = grad; g.fillRect(0, 0, BASE_W, WORLD_H);
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * BASE_W, y = Math.random() * WORLD_H;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,200,0.07)' : 'rgba(0,30,0,0.09)';
    g.fillRect(x, y, 2, Math.random() * 5 + 1);
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * BASE_W, y = Math.random() * WORLD_H, r = 30 + Math.random() * 80;
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(120,160,70,0.25)'); rg.addColorStop(1, 'rgba(120,160,70,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  grass = c; return c;
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function shadow(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
}

export function render(g: CanvasRenderingContext2D, s: GameState) {
  g.clearRect(0, 0, WORLD_W, WORLD_H);
  drawBase(g, s);
  drawFront(g, s);
  // particles
  for (const p of s.particles) {
    g.globalAlpha = Math.max(0, p.life / p.maxLife); g.fillStyle = p.color;
    g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  g.globalAlpha = 1;
  // drops (gold coins)
  for (const d of s.drops) {
    const y = d.y - d.z;
    g.fillStyle = '#ffd54a'; g.beginPath(); g.arc(d.x, y, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff2a8'; g.beginPath(); g.arc(d.x - 1, y - 1, 1.5, 0, Math.PI * 2); g.fill();
  }
  // floaters
  g.font = 'bold 12px system-ui, sans-serif'; g.textAlign = 'center';
  for (const f of s.floaters) {
    g.globalAlpha = Math.min(1, f.life); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(f.text, f.x + 1, f.y + 1);
    g.fillStyle = f.color; g.fillText(f.text, f.x, f.y);
  }
  g.globalAlpha = 1;
  // day tint
  const day = (Math.sin(s.t / 60) + 1) / 2;
  g.fillStyle = `rgba(20,20,70,${(1 - day) * 0.18})`; g.fillRect(0, 0, WORLD_W, WORLD_H);
}

function drawBase(g: CanvasRenderingContext2D, s: GameState) {
  g.drawImage(grassTex(), 0, 0);
  // dirt paths from depot to buildings
  g.strokeStyle = 'rgba(120,90,50,0.35)'; g.lineWidth = 8; g.lineCap = 'round';
  for (const b of s.buildings) {
    if (b.type === 'depot') continue;
    g.beginPath(); g.moveTo(s.center.x, s.center.y + 20); g.lineTo(b.x, b.y + 10); g.stroke();
  }
  // territory ring
  g.save();
  g.setLineDash([6, 6]); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(s.center.x, s.center.y, s.territory, 0, Math.PI * 2); g.stroke();
  for (const b of s.buildings) if (b.type === 'tower' && b.progress >= 1) { g.beginPath(); g.arc(b.x, b.y, 140, 0, Math.PI * 2); g.stroke(); }
  g.restore();

  type Ent = { y: number; draw: () => void };
  const ents: Ent[] = [];
  for (const n of s.nodes) ents.push({ y: n.y, draw: () => drawNode(g, n, inTerritory(s, n.x, n.y)) });
  for (const b of s.buildings) ents.push({ y: b.y + BUILDING_INFO[b.type].size * 0.4, draw: () => drawBuilding(g, b, s) });
  for (const w of s.workers) ents.push({ y: w.y, draw: () => drawWorker(g, w) });
  for (const u of s.units) if (u.x < LANE_X) ents.push({ y: u.y, draw: () => drawUnit(g, u) });
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) e.draw();

  // fog beyond territory
  g.save();
  g.beginPath(); g.rect(0, 0, BASE_W, WORLD_H);
  g.arc(s.center.x, s.center.y, s.territory, 0, Math.PI * 2, true);
  for (const b of s.buildings) if (b.type === 'tower' && b.progress >= 1) { g.moveTo(b.x + 140, b.y); g.arc(b.x, b.y, 140, 0, Math.PI * 2, true); }
  g.fillStyle = 'rgba(10,20,30,0.5)'; g.fill('evenodd');
  g.restore();

  // placement ghost
  if (s.placing && s.hoverX >= 0 && s.hoverX < BASE_W) {
    const ok = canPlaceAt(s, s.placing, s.hoverX, s.hoverY);
    const info = BUILDING_INFO[s.placing];
    g.globalAlpha = 0.55;
    g.fillStyle = ok ? '#7CFC9A' : '#ff6b6b';
    g.beginPath(); g.arc(s.hoverX, s.hoverY, info.size * 0.75 + 6, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 0.9;
    drawBuilding(g, { id: -1, type: s.placing, x: s.hoverX, y: s.hoverY, progress: 1, timer: 0, output: 0, outputType: null, anim: 0, reserved: 0 }, s, true);
    g.globalAlpha = 1;
  }
  // divider
  const dg = g.createLinearGradient(BASE_W, 0, LANE_X, 0); dg.addColorStop(0, '#3b2f22'); dg.addColorStop(1, '#2a2119');
  g.fillStyle = dg; g.fillRect(BASE_W, 0, LANE_X - BASE_W, WORLD_H);
  // gate on the divider
  g.fillStyle = '#6b4a2b'; g.fillRect(BASE_W - 6, 610, LANE_X - BASE_W + 12, 60);
  g.fillStyle = '#3a2814'; g.fillRect(BASE_W + 8, 622, 24, 40);
  g.fillStyle = '#e8d8b0'; g.font = 'bold 10px system-ui'; g.textAlign = 'center'; g.fillText('GATE', (BASE_W + LANE_X) / 2, 604);
}

function drawNode(g: CanvasRenderingContext2D, n: ResNode, inside: boolean) {
  const x = n.x, y = n.y, sc = n.scale;
  const frac = n.amount / n.max;
  g.globalAlpha = inside ? 1 : 0.8;
  if (n.type === 'tree') {
    if (n.amount <= 0) {
      const gr = Math.min(1, n.regrow / 35);
      shadow(g, x, y + 2, 6, 3);
      g.fillStyle = '#6b4a2b'; g.fillRect(x - 3, y - 4, 6, 6);
      if (gr > 0.2) { g.fillStyle = '#4f8a3a'; g.beginPath(); g.arc(x, y - 6 - gr * 8, 3 + gr * 8, 0, Math.PI * 2); g.fill(); }
    } else {
      const sway = Math.sin(n.wobble * 1.3) * 1.5;
      const r = (9 + 6 * frac) * sc;
      shadow(g, x + 3, y + 3, r * 0.9, r * 0.4);
      g.fillStyle = '#5a3d22'; g.fillRect(x - 2.5, y - 8, 5, 10);
      g.fillStyle = '#2f6b2a'; g.beginPath(); g.arc(x + sway, y - 12 * sc, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3f8a35'; g.beginPath(); g.arc(x + sway - r * 0.25, y - 14 * sc - r * 0.2, r * 0.65, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(180,255,150,0.35)'; g.beginPath(); g.arc(x + sway - r * 0.4, y - 16 * sc - r * 0.3, r * 0.3, 0, Math.PI * 2); g.fill();
    }
  } else if (n.type === 'rock' || n.type === 'ore') {
    const r = (6 + 7 * Math.max(0.15, frac)) * sc;
    shadow(g, x + 2, y + 3, r, r * 0.45);
    g.fillStyle = n.type === 'rock' ? '#8e949a' : '#5d6b85';
    g.beginPath(); g.moveTo(x - r, y + 2); g.lineTo(x - r * 0.6, y - r * 0.9); g.lineTo(x + r * 0.2, y - r * 1.1); g.lineTo(x + r, y - r * 0.3); g.lineTo(x + r * 0.8, y + 3); g.closePath(); g.fill();
    g.fillStyle = n.type === 'rock' ? '#b9bfc4' : '#8aa0c4';
    g.beginPath(); g.moveTo(x - r * 0.6, y - r * 0.9); g.lineTo(x + r * 0.2, y - r * 1.1); g.lineTo(x + r * 0.1, y - r * 0.3); g.closePath(); g.fill();
    if (n.type === 'ore') { g.fillStyle = '#d9c26a'; g.fillRect(x - 2, y - r * 0.4, 3, 3); g.fillRect(x + r * 0.3, y - r * 0.7, 2.5, 2.5); }
    if (n.amount <= 0) { g.globalAlpha *= 0.4; }
  } else {
    // wheat
    const h = n.amount <= 0 ? 3 + Math.min(1, n.regrow / 8) * 9 : 12;
    g.fillStyle = n.amount <= 0 ? '#8fbf4a' : '#e2c04e';
    for (let i = -1; i <= 1; i++) {
      const sw = Math.sin(n.wobble * 2 + i) * 1.5;
      g.fillRect(x + i * 4 + sw - 1, y - h, 2, h);
      if (n.amount > 0) { g.fillStyle = '#f2d76a'; g.beginPath(); g.ellipse(x + i * 4 + sw, y - h - 2, 2.2, 4, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e2c04e'; }
    }
  }
  g.globalAlpha = 1;
}

function drawBuilding(g: CanvasRenderingContext2D, b: Building, s: GameState, ghost = false) {
  const info = BUILDING_INFO[b.type]; const sz = info.size; const x = b.x, y = b.y;
  const built = b.progress >= 1;
  shadow(g, x + 3, y + sz * 0.45, sz * 0.7, sz * 0.25);
  if (!built && !ghost) {
    // scaffolding
    g.strokeStyle = '#c9a56a'; g.lineWidth = 2;
    g.strokeRect(x - sz / 2, y - sz / 2, sz, sz * 0.9);
    g.fillStyle = 'rgba(200,160,100,0.5)'; g.fillRect(x - sz / 2, y + sz * 0.4 - sz * 0.9 * b.progress, sz, sz * 0.9 * b.progress);
    g.fillStyle = '#222'; g.fillRect(x - 16, y - sz / 2 - 10, 32, 5);
    g.fillStyle = '#7CFC9A'; g.fillRect(x - 16, y - sz / 2 - 10, 32 * b.progress, 5);
    return;
  }
  const col = info.color;
  const wall = (w: number, h: number, roofCol: string) => {
    g.fillStyle = col; rr(g, x - w / 2, y - h * 0.3, w, h * 0.7, 3); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x - w / 2, y + h * 0.25, w, h * 0.15);
    g.fillStyle = roofCol; g.beginPath(); g.moveTo(x - w / 2 - 4, y - h * 0.3); g.lineTo(x, y - h * 0.85); g.lineTo(x + w / 2 + 4, y - h * 0.3); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.moveTo(x - w / 2 - 4, y - h * 0.3); g.lineTo(x, y - h * 0.85); g.lineTo(x, y - h * 0.3); g.closePath(); g.fill();
  };
  switch (b.type) {
    case 'depot': {
      wall(sz, sz, '#8b3a2a');
      g.fillStyle = '#4a2a14'; g.fillRect(x - 7, y + 4, 14, 14);
      g.fillStyle = '#ffe9a8'; g.fillRect(x - 16, y - 8, 6, 6); g.fillRect(x + 10, y - 8, 6, 6);
      // flag
      g.fillStyle = '#fff'; g.fillRect(x - 1, y - sz * 0.85 - 14, 2, 16);
      g.fillStyle = '#e04c3a'; g.beginPath(); g.moveTo(x + 1, y - sz * 0.85 - 14); g.lineTo(x + 12 + Math.sin(b.anim * 6) * 2, y - sz * 0.85 - 10); g.lineTo(x + 1, y - sz * 0.85 - 6); g.fill();
      break;
    }
    case 'house': wall(sz, sz, '#a24a3a'); g.fillStyle = '#ffe9a8'; g.fillRect(x - 4, y - 4, 8, 8); break;
    case 'storehouse': wall(sz, sz * 0.9, '#6f5a3a'); g.fillStyle = '#5a3d22'; g.fillRect(x - 10, y + 2, 20, 12); g.fillStyle = '#c8a365'; g.fillRect(x - 14, y - 6, 8, 8); g.fillRect(x + 6, y - 6, 8, 8); break;
    case 'farm': {
      wall(sz * 0.8, sz * 0.8, '#b45a3a');
      g.fillStyle = '#7a5230'; for (let i = -1; i <= 1; i++) g.fillRect(x + i * 12 - 1, y + 12, 2, 8);
      g.fillRect(x - 14, y + 14, 28, 2);
      break;
    }
    case 'mine': {
      g.fillStyle = '#5a5a66'; g.beginPath(); g.arc(x, y, sz * 0.55, Math.PI, 0); g.fill();
      g.fillStyle = '#1a1a22'; g.beginPath(); g.arc(x, y + 2, sz * 0.3, Math.PI, 0); g.fill();
      g.fillStyle = '#7a5230'; g.fillRect(x - sz * 0.32, y - sz * 0.3, 4, sz * 0.3); g.fillRect(x + sz * 0.32 - 4, y - sz * 0.3, 4, sz * 0.3); g.fillRect(x - sz * 0.32, y - sz * 0.32, sz * 0.64, 4);
      g.fillStyle = '#6a7a5a'; g.fillRect(x - sz * 0.55, y - 2, sz * 1.1, 6);
      break;
    }
    case 'forge': {
      wall(sz, sz, '#4a3a3a');
      g.fillStyle = '#333'; g.fillRect(x + 6, y - sz * 0.9, 8, 16);
      const glow = 0.5 + Math.sin(b.anim * 8) * 0.3;
      g.fillStyle = `rgba(255,${120 + glow * 80},40,${glow})`; g.fillRect(x - 8, y - 2, 12, 10);
      // smoke
      for (let i = 0; i < 3; i++) { const t = (b.anim * 0.5 + i / 3) % 1; g.fillStyle = `rgba(90,90,90,${(1 - t) * 0.5})`; g.beginPath(); g.arc(x + 10 + Math.sin(t * 6) * 3, y - sz * 0.9 - t * 26, 3 + t * 6, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'barracks': {
      wall(sz, sz * 0.9, '#5a2a2a');
      g.fillStyle = '#3a1a1a'; g.fillRect(x - 6, y + 2, 12, 14);
      g.fillStyle = '#ddd'; g.fillRect(x - 12, y - 8, 3, 12); g.fillRect(x + 9, y - 8, 3, 12);
      g.fillStyle = '#e04c3a'; g.beginPath(); g.moveTo(x - sz / 2 - 4, y - sz * 0.27); g.lineTo(x - sz / 2 + 6, y - sz * 0.27); g.lineTo(x - sz / 2 + 1, y - sz * 0.1); g.fill();
      break;
    }
    case 'cartyard': {
      wall(sz, sz * 0.7, '#7a5a3a');
      g.fillStyle = '#5a3d22'; g.fillRect(x - 14, y + 6, 28, 3);
      g.fillStyle = '#333'; g.beginPath(); g.arc(x - 9, y + 12, 4, 0, Math.PI * 2); g.arc(x + 9, y + 12, 4, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'tower': {
      g.fillStyle = '#7a8388'; g.fillRect(x - 8, y - 34, 16, 44);
      g.fillStyle = '#5a6368'; g.fillRect(x - 11, y - 38, 22, 8);
      g.fillStyle = '#ffe9a8'; g.fillRect(x - 3, y - 30, 6, 6);
      g.fillStyle = '#4c9be8'; g.beginPath(); g.moveTo(x, y - 50); g.lineTo(x + 10 + Math.sin(b.anim * 5) * 2, y - 46); g.lineTo(x, y - 42); g.fill();
      g.fillStyle = '#ddd'; g.fillRect(x - 1, y - 52, 2, 16);
      break;
    }
  }
  // output pile
  if (b.output > 0 && b.outputType) {
    const c = RES_COLORS[b.outputType];
    for (let i = 0; i < Math.min(b.output, 12); i++) {
      const px = x + 16 + (i % 4) * 6, py = y + 14 - Math.floor(i / 4) * 5;
      g.fillStyle = c; g.fillRect(px, py, 5, 5); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(px, py, 5, 1.5);
    }
    if (b.output >= (b.type === 'mine' ? 12 : 8)) { g.fillStyle = '#ff8080'; g.font = 'bold 10px system-ui'; g.textAlign = 'center'; g.fillText('FULL', x + 26, y - 4); }
  }
  // production bar
  if (built && !ghost && (b.type === 'barracks' || b.type === 'forge' || b.type === 'mine')) {
    const max = b.type === 'barracks' ? 6 : b.type === 'forge' ? 5 : 4;
    const stalled = (b.type === 'barracks' && (s.res.food < 5 || s.res.weapons < 1)) || (b.type === 'forge' && (s.res.iron < 2 || s.res.wood < 1));
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x - 14, y + sz * 0.45, 28, 3);
    g.fillStyle = stalled ? '#ff7070' : '#7CFC9A'; g.fillRect(x - 14, y + sz * 0.45, 28 * Math.min(1, b.timer / max), 3);
  }
}

function drawWorker(g: CanvasRenderingContext2D, w: Worker) {
  const x = w.x, y = w.y; const moving = w.state !== 'idle' && w.state !== 'gather' && w.state !== 'build';
  const bob = moving ? Math.abs(Math.sin(w.bob)) * 2 : 0;
  if (w.isCart) {
    shadow(g, x, y + 4, 12, 4);
    g.fillStyle = '#8a6238'; rr(g, x - 11, y - 8 - bob, 22, 10, 2); g.fill();
    g.fillStyle = '#333'; g.beginPath(); g.arc(x - 7, y + 3, 4, 0, Math.PI * 2); g.arc(x + 7, y + 3, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ddd'; g.beginPath(); g.arc(x - 7, y + 3, 1.5, 0, Math.PI * 2); g.arc(x + 7, y + 3, 1.5, 0, Math.PI * 2); g.fill();
    // donkey
    g.fillStyle = '#7d6a58'; rr(g, x + w.facing * 14 - 6, y - 8 - bob, 12, 8, 3); g.fill(); g.fillRect(x + w.facing * 18 - 2, y - 13 - bob, 4, 6);
    if (w.carry) { g.fillStyle = RES_COLORS[w.carry]; for (let i = 0; i < w.carryAmt; i++) g.fillRect(x - 9 + (i % 3) * 6, y - 13 - bob - Math.floor(i / 3) * 5, 5, 5); }
    return;
  }
  shadow(g, x, y + 3, 6, 2.5);
  // legs
  g.fillStyle = '#3a2a1e';
  const lp = moving ? Math.sin(w.bob) * 3 : 0;
  g.fillRect(x - 3 + lp * 0.3, y - 4, 2.5, 6); g.fillRect(x + 0.5 - lp * 0.3, y - 4, 2.5, 6);
  // body
  g.fillStyle = `hsl(${w.hue}, 45%, 45%)`; rr(g, x - 4.5, y - 13 - bob, 9, 10, 2.5); g.fill();
  // head
  g.fillStyle = '#f1c9a5'; g.beginPath(); g.arc(x, y - 17 - bob, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#5a3a20'; g.beginPath(); g.arc(x, y - 18.5 - bob, 4, Math.PI, 0); g.fill();
  // tool swing
  if (w.state === 'gather' || w.state === 'build') {
    const a = Math.sin(w.bob * 1.5) * 0.9 - 0.6;
    g.save(); g.translate(x + w.facing * 4, y - 11 - bob); g.rotate(a * w.facing);
    g.fillStyle = '#7a5230'; g.fillRect(0, -1, 10, 2);
    g.fillStyle = w.state === 'build' ? '#ccc' : '#aaa'; g.fillRect(9, -4, 4, 6);
    g.restore();
  }
  // carried resource
  if (w.carry) {
    g.fillStyle = RES_COLORS[w.carry];
    for (let i = 0; i < w.carryAmt; i++) { g.fillRect(x - 3, y - 26 - bob - i * 5, 7, 5); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 3, y - 26 - bob - i * 5, 7, 1.5); g.fillStyle = RES_COLORS[w.carry]; }
  }
}

function drawUnit(g: CanvasRenderingContext2D, u: Unit) {
  const x = u.x, y = u.y; const bob = Math.abs(Math.sin(u.anim)) * 1.5;
  shadow(g, x, y + 3, 6, 2.5);
  const ally = u.side === 'ally';
  const ly = ally ? -u.lunge * 5 : u.lunge * 5;
  g.fillStyle = '#2a2a2a'; const lp = Math.sin(u.anim) * 3;
  g.fillRect(x - 3 + lp * 0.3, y - 4, 2.5, 6); g.fillRect(x + 0.5 - lp * 0.3, y - 4, 2.5, 6);
  g.fillStyle = ally ? '#b8342a' : u.kind === 1 ? '#3a1f4a' : '#5a3a6a'; rr(g, x - 5, y - 14 - bob + ly, 10, 11, 2.5); g.fill();
  g.fillStyle = ally ? '#c8c8d0' : '#7a7a7a'; g.beginPath(); g.arc(x, y - 18 - bob + ly, 4.2, 0, Math.PI * 2); g.fill();
  if (!ally) { g.fillStyle = '#ff5050'; g.fillRect(x - 2.5, y - 19 - bob + ly, 2, 2); g.fillRect(x + 0.5, y - 19 - bob + ly, 2, 2); }
  if (u.kind === 1) { g.fillStyle = '#d9a640'; g.fillRect(x - 5, y - 24 - bob + ly, 10, 3); }
  // weapon / shield
  g.fillStyle = ally ? '#ddd' : '#a08a5a'; g.fillRect(x + 6, y - 22 - bob + ly, 2, 14);
  if (ally) { g.fillStyle = '#3a5ea8'; g.beginPath(); g.arc(x - 6, y - 10 - bob, 4, 0, Math.PI * 2); g.fill(); }
  // hp bar
  if (u.hp < u.maxHp) {
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 8, y - 28, 16, 3);
    g.fillStyle = ally ? '#7CFC9A' : '#ff6b6b'; g.fillRect(x - 8, y - 28, 16 * u.hp / u.maxHp, 3);
  }
}

function drawFront(g: CanvasRenderingContext2D, s: GameState) {
  const f = s.front;
  const sh = f.shake > 0 ? (Math.random() - 0.5) * f.shake * 6 : 0;
  g.save(); g.translate(sh, 0);
  // ground
  const gr = g.createLinearGradient(0, 0, 0, WORLD_H); gr.addColorStop(0, '#3a2430'); gr.addColorStop(0.5, '#5a4630'); gr.addColorStop(1, '#4e6a34');
  g.fillStyle = gr; g.fillRect(LANE_X, 0, LANE_W + 20, WORLD_H);
  // lane texture
  for (let i = 0; i < 60; i++) { const yy = (i * 97) % WORLD_H, xx = LANE_X + ((i * 53) % LANE_W); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(xx, yy, 6 + (i % 5) * 3, 2); }
  // sector markers
  for (let i = 1; i < 6; i++) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(LANE_X + 10, 110 + i * 100, LANE_W - 20, 1); }
  // fortress
  const fx = LANE_X + LANE_W / 2, fy = 110;
  g.fillStyle = '#2a1f2a'; g.fillRect(LANE_X + 30, fy - 80, LANE_W - 60, 100);
  g.fillStyle = '#3d2d3d'; g.fillRect(LANE_X + 30, fy - 80, LANE_W - 60, 12);
  for (let i = 0; i < 8; i++) g.fillRect(LANE_X + 30 + i * (LANE_W - 60) / 8 + 4, fy - 92, (LANE_W - 60) / 16, 12);
  g.fillStyle = '#1a121a'; g.beginPath(); g.arc(fx, fy + 20, 26, Math.PI, 0); g.fill(); g.fillRect(fx - 26, fy + 20, 52, 20);
  g.fillStyle = '#4a3a4a'; g.fillRect(LANE_X + 40, fy - 110, 24, 40); g.fillRect(LANE_X + LANE_W - 64, fy - 110, 24, 40);
  const torch = 0.6 + Math.sin(s.t * 9) * 0.25;
  g.fillStyle = `rgba(255,140,40,${torch})`; g.fillRect(LANE_X + 49, fy - 100, 6, 6); g.fillRect(LANE_X + LANE_W - 55, fy - 100, 6, 6);
  g.fillStyle = '#6b1f3a'; g.beginPath(); g.moveTo(fx, fy - 128); g.lineTo(fx + 22, fy - 122); g.lineTo(fx, fy - 114); g.fill(); g.fillStyle = '#ccc'; g.fillRect(fx - 1, fy - 130, 2, 40);
  // fortress hp
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(LANE_X + 40, fy + 46, LANE_W - 80, 8);
  g.fillStyle = '#c93a5a'; g.fillRect(LANE_X + 40, fy + 46, (LANE_W - 80) * Math.max(0, f.fortressHp / f.fortressMax), 8);
  g.fillStyle = '#f5e6c8'; g.font = 'bold 12px system-ui'; g.textAlign = 'center';
  g.fillText(`ENEMY FORTRESS · SECTOR ${f.sector}`, fx, fy - 138);
  g.font = '10px system-ui'; g.fillText(`${Math.max(0, Math.ceil(f.fortressHp))} / ${f.fortressMax}`, fx, fy + 66);
  // gate/base end
  const gy = WORLD_H - 60;
  g.fillStyle = '#6b4a2b'; g.fillRect(LANE_X, gy + 20, LANE_W + 20, 40);
  g.fillStyle = '#8a6238'; for (let i = 0; i < 12; i++) g.fillRect(LANE_X + i * 30, gy + 12, 18, 12);
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(LANE_X + 40, gy + 34, LANE_W - 80, 8);
  g.fillStyle = '#4c9be8'; g.fillRect(LANE_X + 40, gy + 34, (LANE_W - 80) * Math.max(0, f.gateHp / f.gateMax), 8);
  g.fillStyle = '#f5e6c8'; g.font = 'bold 11px system-ui'; g.fillText('YOUR GATE', fx, gy + 30);
  // units
  const us = s.units.filter(u => u.x >= LANE_X).sort((a, b) => a.y - b.y);
  for (const u of us) drawUnit(g, u);
  // gold target indicator
  g.fillStyle = '#ffd54a'; g.beginPath(); g.arc(1100, 40, 7, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#7a5a10'; g.font = 'bold 9px system-ui'; g.fillText('G', 1100, 43);
  // banner
  if (f.banner > 0) {
    const a = Math.min(1, f.banner);
    g.globalAlpha = a; g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(LANE_X, 320, LANE_W + 20, 60);
    g.fillStyle = f.bannerText.includes('BREACH') ? '#ff7070' : '#ffd54a'; g.font = 'bold 20px system-ui'; g.fillText(f.bannerText, fx, 356);
    g.globalAlpha = 1;
  }
  g.restore();
}
