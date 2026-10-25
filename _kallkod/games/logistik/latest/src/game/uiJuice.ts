// ---------- screen-space UI particle fountain & global button juice ----------
import { S } from "./audio";

interface UiSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vrot: number;
  kind: "spark" | "ring" | "star";
  maxR?: number;
}

const sparks: UiSpark[] = [];
let overlayCanvas: HTMLCanvasElement | null = null;
let rafId = 0;
let lastTime = 0;

function ensureOverlay() {
  if (overlayCanvas && document.body.contains(overlayCanvas)) return;
  overlayCanvas = document.createElement("canvas");
  overlayCanvas.style.position = "fixed";
  overlayCanvas.style.inset = "0";
  overlayCanvas.style.width = "100vw";
  overlayCanvas.style.height = "100vh";
  overlayCanvas.style.pointerEvents = "none";
  overlayCanvas.style.zIndex = "9999";
  document.body.appendChild(overlayCanvas);
  const resize = () => {
    if (!overlayCanvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    overlayCanvas.width = window.innerWidth * dpr;
    overlayCanvas.height = window.innerHeight * dpr;
  };
  resize();
  window.addEventListener("resize", resize);
}

function tickOverlay(now: number) {
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
  lastTime = now;
  if (!overlayCanvas) {
    rafId = 0;
    return;
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const ctx = overlayCanvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i];
    p.life -= dt;
    if (p.life <= 0) {
      sparks.splice(i, 1);
      continue;
    }
    const t = 1 - p.life / p.max;
    const a = Math.max(0, Math.min(1, p.life / p.max));

    if (p.kind === "ring") {
      const r = (p.maxR ?? 42) * (0.15 + 0.85 * (1 - Math.pow(1 - t, 3)));
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5 * a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    p.vy += 540 * dt;
    p.vx *= 1 - 1.8 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vrot * dt;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.min(1, a * 1.35);
    ctx.fillStyle = p.color;

    if (p.kind === "star") {
      const s = p.size * (0.5 + 0.6 * a);
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const ang = (k * Math.PI) / 2;
        ctx.lineTo(Math.cos(ang) * s * 1.8, Math.sin(ang) * s * 1.8);
        ctx.lineTo(Math.cos(ang + Math.PI / 4) * s * 0.45, Math.sin(ang + Math.PI / 4) * s * 0.45);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      const s = p.size * a;
      ctx.fillRect(-s, -s * 0.45, s * 2, s * 0.9);
    }
    ctx.restore();
  }

  if (sparks.length > 0) {
    rafId = requestAnimationFrame(tickOverlay);
  } else {
    rafId = 0;
  }
}

export function uiBurst(x: number, y: number, color = "#ffb25e", count = 16, big = false) {
  ensureOverlay();
  const cols = [color, "#fff3d6", "#ff8a3d", "#ffd86b"];
  sparks.push({
    x,
    y,
    vx: 0,
    vy: 0,
    life: big ? 0.38 : 0.28,
    max: big ? 0.38 : 0.28,
    size: 1,
    color,
    rot: 0,
    vrot: 0,
    kind: "ring",
    maxR: big ? 68 : 38,
  });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const spd = (big ? 110 : 70) + Math.random() * (big ? 210 : 130);
    sparks.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - (big ? 90 : 55),
      life: 0.32 + Math.random() * 0.28,
      max: 0.55,
      size: (big ? 3.8 : 2.8) + Math.random() * 2.4,
      color: cols[i % cols.length],
      rot: Math.random() * 6.28,
      vrot: (Math.random() - 0.5) * 14,
      kind: i % 3 === 0 ? "star" : "spark",
    });
  }
  if (!rafId) {
    lastTime = performance.now();
    rafId = requestAnimationFrame(tickOverlay);
  }
}

/** Global listener that gives every button in the app tactile hover & click juice */
export function attachGlobalUiJuice() {
  let lastHovered: Element | null = null;

  const onOver = (e: PointerEvent) => {
    const btn = (e.target as HTMLElement | null)?.closest?.("button");
    if (!btn || btn === lastHovered) return;
    lastHovered = btn;
    if ((btn as HTMLButtonElement).disabled) return;
    S.uiHover();
  };

  const onOut = (e: PointerEvent) => {
    const btn = (e.target as HTMLElement | null)?.closest?.("button");
    if (btn && btn === lastHovered && !btn.contains(e.relatedTarget as Node | null)) {
      lastHovered = null;
    }
  };

  const onDown = (e: PointerEvent) => {
    const btn = (e.target as HTMLElement | null)?.closest?.("button") as HTMLButtonElement | null;
    if (!btn) return;
    S.ensure();
    const rect = btn.getBoundingClientRect();
    const cx = e.clientX || rect.left + rect.width / 2;
    const cy = e.clientY || rect.top + rect.height / 2;
    if (btn.disabled) {
      uiBurst(cx, cy, "#ff5a48", 7, false);
      return;
    }
    const isEmber = btn.classList.contains("btn-ember");
    uiBurst(cx, cy, isEmber ? "#ffb25e" : "#ffe6bd", isEmber ? 20 : 11, isEmber);
  };

  window.addEventListener("pointerover", onOver, true);
  window.addEventListener("pointerout", onOut, true);
  window.addEventListener("pointerdown", onDown, true);
  return () => {
    window.removeEventListener("pointerover", onOver, true);
    window.removeEventListener("pointerout", onOut, true);
    window.removeEventListener("pointerdown", onDown, true);
  };
}
