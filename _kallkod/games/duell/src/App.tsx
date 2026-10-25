import { useEffect, useRef, useState, type RefObject } from "react";
import { DuelEngine } from "./game/engine";
import type { Intensity, Snapshot } from "./game/types";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DuelEngine | null>(null);
  const onFrameRef = useRef<(s: Snapshot) => void>(() => {});
  const sigRef = useRef("");
  const hpP = useRef<HTMLSpanElement>(null);
  const hpR = useRef<HTMLSpanElement>(null);
  const lagP = useRef<HTMLSpanElement>(null);
  const lagR = useRef<HTMLSpanElement>(null);
  const stP = useRef<HTMLSpanElement>(null);
  const stR = useRef<HTMLSpanElement>(null);
  const announceRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [codex, setCodex] = useState(false);
  const [intensity, setIntensity] = useState<Intensity>("measured");
  const [hint, setHint] = useState(true);

  onFrameRef.current = (s) => {
    const scale = (el: HTMLSpanElement | null, v: number) => {
      if (el) el.style.transform = `scaleX(${Math.max(0, Math.min(1, v))})`;
    };
    scale(hpP.current, s.hpP / 100);
    scale(hpR.current, s.hpR / 100);
    scale(lagP.current, s.hpLagP / 100);
    scale(lagR.current, s.hpLagR / 100);
    scale(stP.current, s.stamP / 100);
    scale(stR.current, s.stamR / 100);
    if (announceRef.current) {
      announceRef.current.style.opacity = String(s.messageA);
      const title = announceRef.current.querySelector("[data-title]");
      const sub = announceRef.current.querySelector("[data-sub]");
      if (title && title.textContent !== s.message) title.textContent = s.message;
      if (sub && sub.textContent !== s.sub) sub.textContent = s.sub;
    }
    const sig = [
      s.mode,
      s.attract,
      s.paused,
      s.coach,
      s.round,
      s.scoreP,
      s.scoreR,
      s.knivesP,
      s.knivesR,
      s.matchWinner,
      s.muted,
      s.low,
      s.intensity,
      s.log.map((l) => l.who + l.text).join("|"),
    ].join("~");
    if (sig !== sigRef.current) {
      sigRef.current = sig;
      setSnap({ ...s, log: s.log.map((l) => ({ ...l })) });
    }
  };

  useEffect(() => {
    const fit = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      const w = window.visualViewport?.width ?? window.innerWidth;
      document.documentElement.style.setProperty("--app-h", `${Math.round(h)}px`);
      document.documentElement.style.width = `${Math.round(w)}px`;
      engineRef.current?.fit();
    };
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
      window.visualViewport?.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("scroll", fit);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new DuelEngine(canvas, { onFrame: (s) => onFrameRef.current(s) });
    engineRef.current = engine;
    engine.fit();
    engine.start();
    return () => {
      engine.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, []);

  const attract = !snap || snap.attract;
  const fighting = !!snap && !snap.attract && snap.mode !== "match";
  const match = snap?.mode === "match";

  const chooseIntensity = (next: Intensity) => {
    setIntensity(next);
    engineRef.current?.setIntensity(next);
  };

  return (
    <div className="stage select-none text-[#f4efe6]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair touch-none" />
      <div className={`vignette ${snap?.low ? "low" : ""}`} />
      <div className="frame-line hidden md:block" />
      <svg className="grain" aria-hidden="true">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>

      <div
        ref={announceRef}
        className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center opacity-0"
      >
        <div className="px-6 text-center">
          <div
            data-title
            className="font-display text-3xl tracking-[0.16em] text-[#f6efe4] drop-shadow-[0_8px_30px_rgba(0,0,0,0.65)] sm:text-5xl md:text-7xl"
          />
          <div data-sub className="mt-3 text-[10px] tracking-[0.46em] text-[#f4efe6]/70 uppercase" />
        </div>
      </div>

      {attract && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-end">
          <div className="title-fade absolute inset-0" />
          <div className="safe-bottom relative w-full px-3 pb-3 md:px-10 md:pb-8">
            <div className="panel pointer-events-auto rise-in max-h-[46vh] w-full max-w-3xl overflow-y-auto px-4 py-3 md:px-8 md:py-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-[10px] tracking-[0.42em] text-[#e4b15a]">THE MERIDIAN SPAN</div>
                  <h1 className="font-display mt-1 text-4xl leading-none text-[#f7f1e6] md:text-7xl">SWAY</h1>
                  <p className="mt-2 max-w-md text-sm text-[#f4efe6]/75">
                    Dra i ringen för att gå. Svep på banan för att slå. Drag to move, swipe to strike.
                  </p>
                </div>
                <div className="pointer-events-auto flex flex-wrap gap-2">
                  <button
                    className="gold-btn min-h-12 px-5 py-3 text-[11px]"
                    onClick={() => {
                      engineRef.current?.startDuel();
                    }}
                  >
                    Enter the span
                  </button>
                  <button
                    className="ghost-btn min-h-12 px-4 py-3 text-[11px]"
                    onClick={() => {
                      setCodex(true);
                    }}
                  >
                    Read the fight
                  </button>
                </div>
              </div>
              <div className="pointer-events-auto mt-3 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.2em] text-[#f4efe6]/60">
                <span>TEMPO</span>
                <button
                  className={`min-h-9 rounded px-3 py-2 transition-transform active:scale-90 ${intensity === "measured" ? "font-bold text-[#e4b15a] shadow-[0_0_10px_rgba(228,177,90,0.3)]" : ""}`}
                  onClick={() => chooseIntensity("measured")}
                >
                  MEASURED
                </button>
                <span className="opacity-40">/</span>
                <button
                  className={`min-h-9 rounded px-3 py-2 transition-transform active:scale-90 ${intensity === "fierce" ? "font-bold text-[#b9a4ff] shadow-[0_0_10px_rgba(185,164,255,0.3)]" : ""}`}
                  onClick={() => chooseIntensity("fierce")}
                >
                  FIERCE
                </button>
                <span className="hidden md:inline">· the duel above is already live</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {fighting && snap && (
        <Hud
          snap={snap}
          hint={hint}
          onHideHint={() => setHint(false)}
          hpP={hpP}
          hpR={hpR}
          lagP={lagP}
          lagR={lagR}
          stP={stP}
          stR={stR}
          onCodex={() => setCodex(true)}
          onPause={() => engineRef.current?.togglePause()}
          onMute={() => {
            engineRef.current?.toggleMute();
            setSnap((s) => (s ? { ...s, muted: !s.muted } : s));
          }}
          onShield={(v) => engineRef.current?.setShield(v)}
          onKnife={() => engineRef.current?.knife()}
          onWeb={() => engineRef.current?.grapple()}
          onMove={(x) => engineRef.current?.setPad(x)}
          onFlick={(dx, dy) => engineRef.current?.flick(dx, dy)}
          onRise={() => engineRef.current?.jump()}
          onAttack={() => engineRef.current?.attack()}
          onDodge={() => engineRef.current?.dodge()}
          onParry={() => engineRef.current?.parry()}
        />
      )}

      {snap?.paused && fighting && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/45 px-6">
          <div className="panel w-full max-w-md px-8 py-8 text-center">
            <div className="text-[10px] tracking-[0.42em] text-[#e4b15a]">HELD</div>
            <h2 className="font-display mt-2 text-4xl">The span waits</h2>
            <p className="mt-3 text-sm text-[#f4efe6]/65">Nothing is memorized here. Only read, then choose.</p>
            <div className="mt-6 flex justify-center gap-3">
              <button className="gold-btn px-5 py-3 text-[11px]" onClick={() => engineRef.current?.togglePause()}>
                Resume
              </button>
              <button
                className="ghost-btn px-5 py-3 text-[11px]"
                onClick={() => {
                  engineRef.current?.leave();
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {match && snap && (
        <div className="absolute inset-0 z-[60] flex items-end">
          <div className="scrim-bottom absolute inset-0" />
          <img
            src="./images/title-duel.jpg"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
          />
          <div className="safe-bottom relative w-full px-4 pt-16 pb-6 md:px-12 md:pb-14">
            <div className="text-[10px] tracking-[0.46em] text-[#e4b15a]">
              {snap.matchWinner === "player" ? "EXCHANGE CLOSED" : "THE SPAN KEEPS ITS OWN"}
            </div>
            <h2 className="font-display mt-2 max-w-3xl text-4xl leading-tight md:text-6xl">
              {snap.matchWinner === "player" ? "The span is yours." : "Vesper keeps the meridian."}
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#f4efe6]/70">
              {snap.matchWinner === "player"
                ? "Not a string of buttons. A series of intentions, timed against a body that would not stay still."
                : "The opening was there. It passed. The stone is still warm."}
            </p>
            <div className="mt-4 font-display text-sm tracking-[0.28em] text-[#f4efe6]/80">
              CAEL {snap.scoreP} — {snap.scoreR} VESPER
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="gold-btn px-6 py-3 text-[11px]" onClick={() => engineRef.current?.startDuel()}>
                Again
              </button>
              <button className="ghost-btn px-5 py-3 text-[11px]" onClick={() => engineRef.current?.leave()}>
                Watch the span
              </button>
            </div>
          </div>
        </div>
      )}

      {codex && <Codex onClose={() => setCodex(false)} />}
    </div>
  );
}

function Pips({ n, gold }: { n: number; gold: boolean }) {
  return (
    <div className={`flex gap-1.5 ${gold ? "" : "flex-row-reverse"}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rotate-45 border ${
            i < n
              ? gold
                ? "border-[#e4b15a] bg-[#e4b15a]"
                : "border-[#b9a4ff] bg-[#b9a4ff]"
              : "border-white/25"
          }`}
        />
      ))}
    </div>
  );
}

function Knives({ n, align }: { n: number; align: "left" | "right" }) {
  return (
    <div className={`mt-2 flex gap-1 ${align === "right" ? "justify-end" : ""}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`h-3 w-[2px] rotate-45 ${i < n ? "bg-[#f4efe6]" : "bg-white/15"}`} />
      ))}
    </div>
  );
}

function Hud({
  snap,
  hint,
  onHideHint,
  hpP,
  hpR,
  lagP,
  lagR,
  stP,
  stR,
  onCodex,
  onPause,
  onMute,
  onShield,
  onKnife,
  onWeb,
  onMove,
  onFlick,
  onRise,
  onAttack,
  onDodge,
  onParry,
}: {
  snap: Snapshot;
  hint: boolean;
  onHideHint: () => void;
  hpP: RefObject<HTMLSpanElement | null>;
  hpR: RefObject<HTMLSpanElement | null>;
  lagP: RefObject<HTMLSpanElement | null>;
  lagR: RefObject<HTMLSpanElement | null>;
  stP: RefObject<HTMLSpanElement | null>;
  stR: RefObject<HTMLSpanElement | null>;
  onCodex: () => void;
  onPause: () => void;
  onMute: () => void;
  onShield: (v: boolean) => void;
  onKnife: () => void;
  onWeb: () => void;
  onMove: (x: number) => void;
  onFlick: (dx: number, dy: number) => void;
  onRise: () => void;
  onAttack: () => void;
  onDodge: () => void;
  onParry: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      <div className="safe-top flex items-start justify-between gap-2 px-3 pt-2 md:px-6">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-end justify-between gap-2">
            <div className="font-display text-xs tracking-[0.16em] sm:text-sm">CAEL</div>
            <Pips n={snap.scoreP} gold />
          </div>
          <div className="hud-bar">
            <span ref={lagP} className="bg-[#f4efe6]/35" />
            <span ref={hpP} className="bg-[#e4b15a]" />
          </div>
          <div className="mt-1 h-[2px] overflow-hidden bg-white/10">
            <span ref={stP} className="block h-full w-full origin-left bg-[#f4efe6]/55" />
          </div>
          <Knives n={snap.knivesP} align="left" />
        </div>

        <div className="shrink-0 px-1 text-center">
          <div className="text-[8px] tracking-[0.28em] text-[#e4b15a]/80">RND</div>
          <div className="font-display text-sm sm:text-lg">{ROMAN[snap.round] ?? snap.round}</div>
          <div className="pointer-events-auto mt-1 flex items-center justify-center gap-1">
            <IconButton label={`Knife (${snap.knivesP})`} onClick={onKnife} />
            <IconButton label={snap.muted ? "Snd" : "Mute"} onClick={onMute} />
            <IconButton label="?" onClick={onCodex} />
            <IconButton label="II" onClick={onPause} />
          </div>
        </div>

        <div className="min-w-0 flex-1 text-right">
          <div className="mb-1 flex items-end justify-between gap-2">
            <Pips n={snap.scoreR} gold={false} />
            <div className="font-display text-xs tracking-[0.16em] sm:text-sm">VESPER</div>
          </div>
          <div className="hud-bar">
            <span ref={lagR} className="origin-right bg-[#f4efe6]/35" style={{ transformOrigin: "right center" }} />
            <span ref={hpR} className="bg-[#b9a4ff]" style={{ transformOrigin: "right center" }} />
          </div>
          <div className="mt-1 h-[2px] overflow-hidden bg-white/10">
            <span
              ref={stR}
              className="block h-full w-full bg-[#f4efe6]/55"
              style={{ transformOrigin: "right center" }}
            />
          </div>
          <Knives n={snap.knivesR} align="right" />
        </div>
      </div>

      <div className="safe-bottom absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent pt-8">
        <p className="line-clamp-2 px-3 pb-1 text-[12px] leading-snug text-[#f4efe6]/90 md:hidden">{snap.coach}</p>
        <div className="flex items-end justify-between gap-2 px-3 pb-2">
          <div>
            <MovePad onMove={onMove} onFlick={onFlick} />
            <div className="mt-1 text-center text-[9px] tracking-[0.14em] text-[#e4b15a]/85">DRA / MOVE</div>
          </div>
          <div className="hidden max-w-sm pb-2 md:block">
            <div className="text-[9px] tracking-[0.28em] text-[#e4b15a]/80">THE READ</div>
            <p className="mt-1 text-sm leading-relaxed text-[#f4efe6]/85">{snap.coach}</p>
            {hint && (
              <button className="pointer-events-auto mt-2 text-[10px] tracking-[0.12em] text-[#f4efe6]/55" onClick={onHideHint}>
                J cut · K thrust · Shift brace · Space rise · hide
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <TapButton label="Strike" onClick={onAttack} primary />
            <TapButton label="Parry" onClick={onParry} highlight />
            <HoldButton label="Brace" onHold={onShield} />
            <TapButton label="Dodge" onClick={onDodge} />
            <TapButton label="Rise" onClick={onRise} />
            <TapButton label="Web" onClick={onWeb} />
          </div>
        </div>
      </div>
    </div>
  );
}

function IconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="pointer-events-auto min-h-8 rounded border border-white/20 bg-black/60 px-2.5 py-1 text-[10px] tracking-[0.14em] text-[#f4efe6]/85 uppercase shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-transform duration-75 active:scale-90 active:border-[#e4b15a] active:bg-[#e4b15a]/25"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function MovePad({ onMove, onFlick }: { onMove: (x: number) => void; onFlick: (dx: number, dy: number) => void }) {
  const pad = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const id = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0, t: 0 });
  const last = useRef({ x: 0, y: 0 });

  const place = (dx: number, dy: number) => {
    if (!knob.current) return;
    const m = Math.hypot(dx, dy) || 1;
    const cap = 30;
    const s = m > cap ? cap / m : 1;
    knob.current.style.transform = `translate(${dx * s}px, ${dy * s}px)`;
  };

  return (
    <div
      ref={pad}
      className="move-pad pointer-events-auto relative"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        id.current = e.pointerId;
        origin.current = { x: e.clientX, y: e.clientY, t: performance.now() };
        last.current = { x: e.clientX, y: e.clientY };
        pad.current?.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (id.current !== e.pointerId) return;
        const dx = e.clientX - origin.current.x;
        const dy = e.clientY - origin.current.y;
        last.current = { x: e.clientX, y: e.clientY };
        place(dx, dy);
        onMove(Math.max(-1, Math.min(1, dx / 40)));
      }}
      onPointerUp={(e) => {
        if (id.current !== e.pointerId) return;
        const dx = last.current.x - origin.current.x;
        const dy = last.current.y - origin.current.y;
        const dt = Math.max(16, performance.now() - origin.current.t);
        const dist = Math.hypot(dx, dy);
        onMove(0);
        place(0, 0);
        id.current = null;
        if (dist > 34 && (dist / dt > 0.38 || dist > 54)) onFlick(dx, dy);
      }}
      onPointerCancel={() => {
        onMove(0);
        place(0, 0);
        id.current = null;
      }}
    >
      <div
        ref={knob}
        className="pointer-events-none absolute top-1/2 left-1/2 h-9 w-9 rounded-full bg-[#f0d7a2] shadow-[0_0_16px_rgba(228,177,90,0.7)]"
        style={{ marginLeft: -18, marginTop: -18 }}
      />
    </div>
  );
}

function TapButton({
  label,
  onClick,
  primary,
  highlight,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      className={`act-btn px-2 ${
        primary
          ? "border-[#f0d7a2] bg-gradient-to-b from-[#e4b15a]/30 to-[#e4b15a]/10 font-semibold text-white shadow-[0_0_12px_rgba(228,177,90,0.35)]"
          : highlight
            ? "border-[#b9a4ff] bg-[#b9a4ff]/20 font-semibold text-[#f0d7a2] shadow-[0_0_12px_rgba(185,164,255,0.3)]"
            : ""
      }`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function HoldButton({ label, onHold }: { label: string; onHold: (v: boolean) => void }) {
  return (
    <button
      className="act-btn px-2"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
    >
      {label}
    </button>
  );
}

function Codex({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-[70] flex items-end justify-center bg-black/55 p-3 md:items-center md:p-8">
      <div className="panel max-h-[88vh] w-full max-w-3xl overflow-y-auto px-5 py-6 md:px-10 md:py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] tracking-[0.42em] text-[#e4b15a]">HOW A FIGHT IS READ</div>
            <h2 className="font-display mt-2 text-3xl md:text-4xl">Intention, then the body</h2>
          </div>
          <button className="ghost-btn px-3 py-2 text-[10px]" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#f4efe6]/72">
          This is not a list of attack buttons. You tell the body where you mean to go. Distance, momentum, steel, and
          stone decide what that becomes. The same flick is a different act if you are airborne, braced, or a step from
          a wall.
        </p>

        <div className="mt-8 grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h3 className="font-display text-lg text-[#f0d7a2]">Three things matter</h3>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-[#f4efe6]/75">
              <li>
                <span className="text-[#e4b15a]">Possibility.</span> Cut, thrust, bash, roll through, leave the ground,
                vault the wall, throw the knife, web the chain. Each one changes distance and who is the attacker.
              </li>
              <li>
                <span className="text-[#e4b15a]">Tempo.</span> A pause is a weapon. If everything is fast, nothing is.
                Spend, then breathe. Stamina is that breath, not a combo meter.
              </li>
              <li>
                <span className="text-[#e4b15a]">Timing.</span> A brace held as the edge flashes is a parry. The same
                brace a heartbeat early is only a wall. A flick away on the flash turns the blade. A flick away before
                the flash simply leaves.
              </li>
            </ul>
            <h3 className="font-display mt-6 text-lg text-[#f0d7a2]">What the body may do</h3>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] text-[#f4efe6]/75">
              <span>Toward them — cut, lunge, or close</span>
              <span>Away — evasion</span>
              <span>Toward and up — leaping cut</span>
              <span>Away and up — backflip</span>
              <span>Toward and down — roll through</span>
              <span>Away and down — low slide</span>
              <span>Into a wall — vault over</span>
              <span>Up, if they are close — over</span>
              <span>Air + toward — aerial cut</span>
              <span>Brace + toward — shield bash</span>
              <span>Tap — cut · double — thrust</span>
              <span>After a parry, tap — riposte</span>
            </div>
          </div>
          <Compass />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="border border-white/10 p-4">
            <div className="text-[10px] tracking-[0.28em] text-[#e4b15a]">HAND</div>
            <p className="mt-2 text-sm leading-relaxed text-[#f4efe6]/72">
              Drag to travel. Flick to commit that direction. Tap to cut. Double-tap to thrust. Hold still and the
              shield rises — its first instant can parry. The three marks are knives. Web seeks chain, ceiling, or
              stone and slings you across the span.
            </p>
          </div>
          <div className="border border-white/10 p-4">
            <div className="text-[10px] tracking-[0.28em] text-[#b9a4ff]">KEYS</div>
            <p className="mt-2 text-sm leading-relaxed text-[#f4efe6]/72">
              Hold A / D to move. Tap a direction to flick. J or Z cut. K or X thrust. Shift braces. Space rises. F
              throws. E webs. A bright edge on their sword is the moment. Esc holds the span.
            </p>
          </div>
        </div>
        <p className="mt-6 text-xs tracking-[0.18em] text-[#f4efe6]/45">
          FIRST TO THREE EXCHANGES · THE FLASH IS THE PARRY WINDOW
        </p>
      </div>
    </div>
  );
}

function Compass() {
  const petals: { x: number; y: number; label: string }[] = [
    { x: 150, y: 28, label: "over / rise" },
    { x: 248, y: 62, label: "leaping cut" },
    { x: 272, y: 150, label: "cut · lunge" },
    { x: 248, y: 238, label: "roll through" },
    { x: 150, y: 272, label: "drop · brace" },
    { x: 52, y: 238, label: "slide" },
    { x: 28, y: 150, label: "evade · vault" },
    { x: 52, y: 62, label: "backflip" },
  ];
  return (
    <div className="relative mx-auto h-[320px] w-[300px]">
      <svg viewBox="0 0 300 300" className="h-full w-full">
        <circle cx="150" cy="150" r="92" fill="none" stroke="rgba(228,177,90,0.35)" />
        <circle cx="150" cy="150" r="4" fill="#e4b15a" />
        {petals.map((p) => (
          <line
            key={p.label}
            x1="150"
            y1="150"
            x2={p.x}
            y2={p.y}
            stroke="rgba(244,239,230,0.25)"
            strokeWidth="1"
          />
        ))}
        {petals.map((p) => (
          <circle key={`${p.label}-d`} cx={p.x} cy={p.y} r="3" fill="#f0d7a2" />
        ))}
      </svg>
      {petals.map((p) => (
        <div
          key={p.label}
          className="absolute text-[9px] tracking-[0.14em] text-[#f4efe6]/70 uppercase"
          style={{
            left: p.x,
            top: p.y,
            transform: "translate(-50%, -140%)",
            width: 88,
            textAlign: "center",
          }}
        >
          {p.label}
        </div>
      ))}
    </div>
  );
}
