// ---------- EMBERHOLD — app shell & game loop ----------
import { useEffect, useRef, useState } from "react";
import { G, readSave, clearSave, writeSave } from "./game/state";
import { newGame, resumeGame, update, FLAGS } from "./game/logic";
import { drawScene } from "./game/render";
import { attachInput, jumpCamera } from "./game/input";
import { S } from "./game/audio";
import TopBar from "./ui/TopBar";
import { DomainPanel, WarPanel } from "./ui/Panels";
import { QuestTracker, Toasts, Minimap, PauseChip, ControlHint, OfflineModal, IntroOverlay } from "./ui/Hud";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [booted, setBooted] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [intro, setIntro] = useState(true);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  // boot: load realm or forge a new one
  useEffect(() => {
    const save = readSave();
    if (save) {
      G.s = resumeGame(save);
      setHasSave(true);
      const m = !!save.muted;
      setMuted(m);
      mutedRef.current = m;
      FLAGS.muted = m;
      S.muted = m;
    } else {
      G.s = newGame((Math.random() * 2 ** 31) | 0);
    }
    setBooted(true);
  }, []);

  const togglePause = () => {
    const s = G.s;
    if (!s) return;
    s.paused = !s.paused;
    setPaused(s.paused);
  };

  const toggleMute = () => {
    S.ensure();
    setMuted((m) => {
      const nm = !m;
      mutedRef.current = nm;
      FLAGS.muted = nm;
      S.setMuted(nm);
      return nm;
    });
  };

  // game loop
  useEffect(() => {
    if (!booted) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    const dprRef = { d: Math.min(2, window.devicePixelRatio || 1) };

    const resize = () => {
      dprRef.d = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, canvas.clientWidth * dprRef.d);
      canvas.height = Math.max(1, canvas.clientHeight * dprRef.d);
    };
    resize();
    window.addEventListener("resize", resize);

    const detach = attachInput(canvas, () => G.s, {
      jumpTo: (t) => jumpCamera(G.s, t),
      togglePause,
      toggleMute,
    });

    const saveNow = () => {
      if (G.s && G.s.started) writeSave(G.s, mutedRef.current);
    };
    const vis = () => {
      if (document.hidden) saveNow();
    };
    window.addEventListener("beforeunload", saveNow);
    document.addEventListener("visibilitychange", vis);

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = G.s;
      if (s) {
        update(s, dt);
        ctx.setTransform(dprRef.d, 0, 0, dprRef.d, 0, 0);
        drawScene(ctx, s, canvas.clientWidth, canvas.clientHeight);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      detach();
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", saveNow);
      document.removeEventListener("visibilitychange", vis);
      saveNow();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted]);

  const begin = (fresh: boolean) => {
    S.ensure();
    S.ui();
    if (fresh) {
      clearSave();
      G.s = newGame((Math.random() * 2 ** 31) | 0);
      mutedRef.current = muted;
      FLAGS.muted = muted;
    }
    const s = G.s;
    s.started = true;
    s.paused = false;
    setPaused(false);
    jumpCamera(s, "base");
    s.cam.x = s.cam.tx;
    s.cam.y = s.cam.ty;
    s.cam.z = s.cam.tz;
    setIntro(false);
  };

  return (
    <div className="vignette relative h-screen w-screen select-none overflow-hidden bg-[#171208]">
      <canvas ref={canvasRef} className="game-canvas absolute inset-0 block h-full w-full" />
      {booted && G.s && !intro && (
        <>
          <TopBar paused={paused} muted={muted} onJump={(t) => jumpCamera(G.s, t)} onPause={togglePause} onMute={toggleMute} />
          <DomainPanel />
          <WarPanel />
          <QuestTracker />
          <Toasts />
          <Minimap />
          <PauseChip />
          <ControlHint />
          <OfflineModal />
        </>
      )}
      {intro && booted && <IntroOverlay hasSave={hasSave} onBegin={begin} />}
    </div>
  );
}
