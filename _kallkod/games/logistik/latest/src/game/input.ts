// ---------- pointer / keyboard input: camera, harvest, strikes, rally, hover ----------
import { WORLD } from "./data";
import { GameState } from "./state";
import { clamp } from "./util";
import { screenToWorld } from "./render";
import { clickNodeAt, strikeAt, moveRally, updateHoverAt, tapGroundAt } from "./logic";
import { S } from "./audio";

export interface InputApi {
  jumpTo: (target: "base" | "front") => void;
  togglePause: () => void;
  toggleMute: () => void;
}

export function attachInput(canvas: HTMLCanvasElement, getS: () => GameState, api: InputApi) {
  let down = false;
  let dragging = false;
  let sx = 0;
  let sy = 0;
  let camX = 0;
  let camY = 0;

  const clampCam = (s: GameState) => {
    s.cam.tx = clamp(s.cam.tx, 240, WORLD.w - 240);
    s.cam.ty = clamp(s.cam.ty, 220, WORLD.h - 200);
  };

  const onDown = (ev: PointerEvent) => {
    const s = getS();
    if (!s) return;
    S.ensure();
    down = true;
    dragging = false;
    sx = ev.clientX;
    sy = ev.clientY;
    camX = s.cam.tx;
    camY = s.cam.ty;
    canvas.setPointerCapture(ev.pointerId);
  };

  const onMove = (ev: PointerEvent) => {
    const s = getS();
    if (!s) return;
    const rect = canvas.getBoundingClientRect();
    const w = screenToWorld(s, ev.clientX - rect.left, ev.clientY - rect.top, rect.width, rect.height);
    updateHoverAt(s, w.x, w.y);
    if (!down) {
      const hasTarget = s.hoverWorld.enemyId !== null || s.hoverWorld.nodeId !== null;
      canvas.style.cursor = hasTarget ? "pointer" : "crosshair";
      return;
    }
    const dx = ev.clientX - sx;
    const dy = ev.clientY - sy;
    if (!dragging && Math.hypot(dx, dy) > 6) {
      dragging = true;
      canvas.classList.add("dragging");
      canvas.style.cursor = "grabbing";
    }
    if (dragging) {
      s.cam.tx = camX - dx / s.cam.tz;
      s.cam.ty = camY - dy / s.cam.tz;
      clampCam(s);
    }
  };

  const onUp = (ev: PointerEvent) => {
    const s = getS();
    canvas.classList.remove("dragging");
    if (!s) return;
    down = false;
    if (!dragging && ev.button === 0) {
      const rect = canvas.getBoundingClientRect();
      const w = screenToWorld(s, ev.clientX - rect.left, ev.clientY - rect.top, rect.width, rect.height);
      if (strikeAt(s, w.x, w.y)) return;
      if (clickNodeAt(s, w.x, w.y)) return;
      tapGroundAt(s, w.x, w.y);
    }
    dragging = false;
  };

  const onWheel = (ev: WheelEvent) => {
    const s = getS();
    if (!s) return;
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const before = screenToWorld(s, mx, my, rect.width, rect.height);
    const nz = clamp(s.cam.tz * Math.exp(-ev.deltaY * 0.0011), 0.5, 2.1);
    s.cam.tz = nz;
    s.cam.tx = before.x - (mx - rect.width / 2) / nz;
    s.cam.ty = before.y - (my - rect.height / 2) / nz;
    clampCam(s);
  };

  const onCtx = (ev: MouseEvent) => {
    ev.preventDefault();
    const s = getS();
    if (!s) return;
    const rect = canvas.getBoundingClientRect();
    const w = screenToWorld(s, ev.clientX - rect.left, ev.clientY - rect.top, rect.width, rect.height);
    if ((s.buildings.barracks ?? 0) > 0) moveRally(s, w.x, w.y);
    else tapGroundAt(s, w.x, w.y);
  };

  const onKey = (ev: KeyboardEvent) => {
    const s = getS();
    if (!s) return;
    const k = ev.key.toLowerCase();
    if (k === "b") api.jumpTo("base");
    else if (k === "f") api.jumpTo("front");
    else if (k === "p") api.togglePause();
    else if (k === "m") api.toggleMute();
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", onCtx);
  window.addEventListener("keydown", onKey);

  return () => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("contextmenu", onCtx);
    window.removeEventListener("keydown", onKey);
  };
}

export function jumpCamera(s: GameState, target: "base" | "front") {
  S.jump();
  s.cam.zoomPunch = 0.032;
  if (target === "base") {
    s.cam.tx = 580;
    s.cam.ty = WORLD.stockY - 10;
    s.cam.tz = 1.05;
  } else {
    s.cam.tx = clamp(s.frontX + 60, 800, WORLD.w - 420);
    s.cam.ty = WORLD.h / 2;
    s.cam.tz = 0.9;
  }
}
