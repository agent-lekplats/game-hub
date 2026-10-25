import { useEffect, useRef } from 'react';
import { game } from './game/sim';
import { Renderer } from './game/render';
import { TILE, type Pt } from './game/data';
import { initAudio, resumeAudio, setMuted } from './game/audio';
import { TopBar, BottomSlot, Help } from './ui/Panels';

const renderer = new Renderer();
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Walk from a to b in 4-neighbour steps (axis-major first). */
function stepLine(a: Pt, b: Pt): Pt[] {
  const out: Pt[] = []; let x = a.x, y = a.y;
  const dx = b.x - a.x, dy = b.y - a.y;
  const sx = Math.sign(dx), sy = Math.sign(dy);
  if (Math.abs(dx) >= Math.abs(dy)) { while (x !== b.x) { x += sx; out.push({ x, y }); } while (y !== b.y) { y += sy; out.push({ x, y }); } }
  else { while (y !== b.y) { y += sy; out.push({ x, y }); } while (x !== b.x) { x += sx; out.push({ x, y }); } }
  return out;
}

type GestureType = 'tap' | 'pan' | 'draw' | 'road' | 'ghost';
interface Gesture { id: number; type: GestureType; x0: number; y0: number; camX: number; camY: number; moved: boolean; button: number }

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current!;
    let raf = 0; let last = performance.now();
    setMuted(game.s.muted);

    // ----- pointer / gesture handling -----
    const ui = game.ui;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { d0: number; z0: number; w0: Pt } | null = null;
    let gesture: Gesture | null = null;
    let dead = false; // after a pinch, ignore the remaining finger until all lift
    const track: { p: { x: number; y: number } | null } = { p: null }; // last pointer position of the active gesture

    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      game.tick(dt);
      // edge auto-pan while dragging a building ghost or drawing a route near the screen edge
      const gs: Gesture | null = gesture; const lp = track.p;
      if (gs && lp && (gs.type === 'ghost' || gs.type === 'draw' || gs.type === 'road') && gs.moved) {
        const m = 40; const w = renderer.cw, h = renderer.ch; let vx = 0, vy = 0;
        if (lp.x < m) vx = -(m - lp.x) / m; else if (lp.x > w - m) vx = (lp.x - (w - m)) / m;
        if (lp.y < m + 40) vy = -(m + 40 - lp.y) / m; else if (lp.y > h - m) vy = (lp.y - (h - m)) / m;
        if (vx || vy) {
          ui.focus = null; ui.cam.x += clamp(vx, -1, 1) * dt * 7; ui.cam.y += clamp(vy, -1, 1) * dt * 7;
          if (gs.type === 'ghost') ghostAt(lp.x, lp.y, true);
          else { const { tx, ty } = tileAt(lp.x, lp.y); if (gs.type === 'draw' && ui.dragPath) extendPath(ui.dragPath, tx, ty, true); if (gs.type === 'road' && ui.dragRoad) extendPath(ui.dragRoad, tx, ty, false); }
        }
      }
      renderer.draw(cv, game);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const local = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const tileAt = (cx: number, cy: number) => { const w = renderer.toWorld(game, cx, cy); return { wx: w.x, wy: w.y, tx: Math.floor(w.x), ty: Math.floor(w.y) }; };
    const clearHover = () => { ui.hover = null; ui.hoverWorld = null; renderer.hoverBuilding = null; renderer.hoverPile = null; renderer.hoverConv = null; };
    const updateHover = (cx: number, cy: number) => { // mouse only
      const { wx, wy, tx, ty } = tileAt(cx, cy);
      ui.hoverWorld = { x: wx, y: wy };
      ui.hover = ui.tool === 'build' ? game.originFor(tx, ty) : { x: tx, y: ty };
      renderer.hoverBuilding = game.buildingAt(tx, ty) || null;
      renderer.hoverPile = ui.tool === 'select' ? game.pileAt(wx, wy) || null : null;
      renderer.hoverConv = game.conveyorAt(tx, ty) || null;
      cv.style.cursor = ui.tool === 'select' ? (renderer.hoverPile ? 'grab' : renderer.hoverBuilding || renderer.hoverConv ? 'pointer' : 'default') : 'crosshair';
    };
    const ghostAt = (cx: number, cy: number, lifted: boolean) => { const k = TILE * ui.cam.zoom; const { tx, ty } = tileAt(cx, cy - (lifted ? 1.3 * k : 0)); ui.ghost = game.originFor(tx, ty); };
    const extendPath = (path: Pt[], tx: number, ty: number, allowBacktrack: boolean) => {
      const last = path[path.length - 1]; if (last.x === tx && last.y === ty) return;
      for (const t of stepLine(last, { x: tx, y: ty })) { const idx = path.findIndex((p) => p.x === t.x && p.y === t.y); if (idx >= 0) { if (allowBacktrack) path.length = idx + 1; } else path.push(t); }
    };

    const onDown = (e: PointerEvent) => {
      initAudio(); resumeAudio();
      cv.setPointerCapture(e.pointerId);
      const p = local(e); pointers.set(e.pointerId, p);
      ui.touch = e.pointerType !== 'mouse';
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]; const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        pinch = { d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: ui.cam.zoom, w0: renderer.toWorld(game, mid.x, mid.y) };
        if (gesture?.type === 'draw') ui.dragPath = null; if (gesture?.type === 'road') ui.dragRoad = null;
        gesture = null; track.p = null; dead = true; return;
      }
      if (pointers.size > 2 || dead) return;
      const { tx, ty } = tileAt(p.x, p.y);
      const base = { id: e.pointerId, x0: p.x, y0: p.y, camX: ui.cam.x, camY: ui.cam.y, moved: false, button: e.button };
      if (e.button !== 0) { gesture = { ...base, type: 'pan' }; return; }
      if (ui.tool === 'conveyor') { gesture = { ...base, type: 'draw' }; ui.dragPath = [{ x: tx, y: ty }]; return; }
      if (ui.tool === 'road') { gesture = { ...base, type: 'road' }; ui.dragRoad = [{ x: tx, y: ty }]; return; }
      if (ui.tool === 'build' && ui.touch) { gesture = { ...base, type: 'ghost' }; ghostAt(p.x, p.y, false); return; }
      gesture = { ...base, type: 'tap' };
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
      if (pinch && pointers.size >= 2) {
        ui.focus = null;
        const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        ui.cam.zoom = clamp((pinch.z0 * d) / pinch.d0, 0.3, 2.6);
        const k = TILE * ui.cam.zoom; ui.cam.x = pinch.w0.x - (mid.x - renderer.cw / 2) / k; ui.cam.y = pinch.w0.y - (mid.y - renderer.ch / 2) / k;
        return;
      }
      if (!gesture) { if (e.pointerType === 'mouse') updateHover(p.x, p.y); return; }
      if (gesture.id !== e.pointerId) return;
      track.p = p;
      const dx = p.x - gesture.x0, dy = p.y - gesture.y0;
      if (!gesture.moved && Math.hypot(dx, dy) > 7) gesture.moved = true;
      if (e.pointerType === 'mouse') updateHover(p.x, p.y);
      const { tx, ty } = tileAt(p.x, p.y);
      if (gesture.type === 'draw') { if (ui.dragPath) extendPath(ui.dragPath, tx, ty, true); }
      else if (gesture.type === 'road') { if (ui.dragRoad) extendPath(ui.dragRoad, tx, ty, false); }
      else if (gesture.type === 'ghost') { if (gesture.moved) ghostAt(p.x, p.y, true); }
      else if (gesture.type === 'pan' || gesture.moved) { ui.focus = null; const k = TILE * ui.cam.zoom; ui.cam.x = gesture.camX - dx / k; ui.cam.y = gesture.camY - dy / k; cv.style.cursor = 'grabbing'; }
    };
    const onUp = (e: PointerEvent) => {
      const p = local(e); pointers.delete(e.pointerId);
      if (pinch) { if (pointers.size < 2) pinch = null; if (pointers.size === 0) dead = false; return; }
      if (dead) { if (pointers.size === 0) dead = false; return; }
      if (!gesture || gesture.id !== e.pointerId) return;
      const gs = gesture; gesture = null; track.p = null;
      const touch = e.pointerType !== 'mouse';
      const { wx, wy, tx, ty } = tileAt(p.x, p.y);
      if (gs.type === 'draw') { const path = ui.dragPath; ui.dragPath = null; if (path) { if (path.length <= 1 && !gs.moved) { const c = game.conveyorAt(tx, ty); if (c) game.select({ type: 'conveyor', id: c.id }); } else game.buildConveyor(path); } }
      else if (gs.type === 'road') { const path = ui.dragRoad; ui.dragRoad = null; if (path) { if (path.length <= 1 && !gs.moved) game.toggleRoad({ x: tx, y: ty }); else game.paintRoad(path); } }
      else if (gs.type === 'tap' && !gs.moved) {
        if (gs.button === 2) game.closeAll();
        else if (ui.tool === 'build') { const o = game.originFor(tx, ty); game.placeAt(o.x, o.y); }
        else game.tapWorld(wx, wy, tx, ty);
      }
      if (touch) clearHover(); else cv.style.cursor = 'default';
      game.emit();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect(); const cx = e.clientX - r.left, cy = e.clientY - r.top;
      const before = renderer.toWorld(game, cx, cy);
      ui.cam.zoom = clamp(ui.cam.zoom * (e.deltaY > 0 ? 0.88 : 1.14), 0.3, 2.6);
      const after = renderer.toWorld(game, cx, cy);
      ui.cam.x += before.x - after.x; ui.cam.y += before.y - after.y;
    };
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName; if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') { ui.helpOpen = false; game.closeAll(); }
      else if (e.key === ' ') { e.preventDefault(); game.s.paused = !game.s.paused; game.emit(); }
      else if (e.key === '1' || e.key === '2' || e.key === '3') { game.s.speed = Number(e.key); game.s.paused = false; game.emit(); }
      else if (e.key === 'b' || e.key === 'B') game.openSheet('build');
      else if (e.key === 'r' || e.key === 'R') game.setTool('road');
      else if ((e.key === 'c' || e.key === 'C') && game.unlocked('conveyor')) game.setTool('conveyor');
      else if (e.key === 'f' || e.key === 'F') game.openSheet('front');
      const pan = 1.2; if (e.key === 'ArrowLeft' || e.key === 'a') ui.cam.x -= pan; if (e.key === 'ArrowRight' || e.key === 'd') ui.cam.x += pan; if (e.key === 'ArrowUp' || e.key === 'w') ui.cam.y -= pan; if (e.key === 'ArrowDown' || e.key === 's') ui.cam.y += pan;
    };
    const onLeave = () => { if (!gesture) clearHover(); };
    const onCtx = (e: MouseEvent) => e.preventDefault();
    const onUnload = () => game.save();
    const onAnyDown = () => { initAudio(); resumeAudio(); };
    const onVis = () => { if (document.hidden) game.save(); };
    window.addEventListener('pointerdown', onAnyDown);
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp); cv.addEventListener('pointerleave', onLeave);
    cv.addEventListener('wheel', onWheel, { passive: false }); cv.addEventListener('contextmenu', onCtx);
    window.addEventListener('keydown', onKey); window.addEventListener('beforeunload', onUnload); document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerdown', onAnyDown);
      cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onUp); cv.removeEventListener('pointerleave', onLeave);
      cv.removeEventListener('wheel', onWheel); cv.removeEventListener('contextmenu', onCtx);
      window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onUnload); document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <div className="relative h-[100dvh] w-screen select-none overflow-hidden bg-slate-950 font-sans">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
      <TopBar />
      <BottomSlot />
      <Help />
    </div>
  );
}
