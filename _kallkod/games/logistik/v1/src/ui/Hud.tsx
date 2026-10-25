// ---------- HUD: quests, toasts, minimap, hints, overlays ----------
import { useEffect, useRef } from "react";
import { Sparkles, AlertTriangle, Check, Swords, Flame, Hourglass, Play, Gift, MousePointer2, Move, ZoomIn, Swords as SwordsIco } from "lucide-react";
import { G } from "../game/state";
import { QUESTS, WORLD } from "../game/data";
import { drawMinimap } from "../game/render";
import { useTicker } from "../hooks";
import { Bar, ResIcon } from "./bits";
import { clamp, fmtTime } from "../game/util";
import { cn } from "../utils/cn";
import { S } from "../game/audio";
import type { ResKey } from "../game/state";
import emblem from "../assets/emblem.jpg";

// ---------------- quest tracker ----------------
export function QuestTracker() {
  useTicker(150);
  const s = G.s;
  if (!s) return null;
  const open = QUESTS.filter((q) => !s.questsDone.includes(q.id)).slice(0, 3);
  if (open.length === 0) return null;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-20 w-[258px] space-y-1.5">
      {open.map((q) => {
        const p = clamp(q.prog(s) / q.target, 0, 1);
        const flash = s.questFlash === q.id;
        return (
          <div key={q.id} className={cn("glass rounded-xl p-2.5", flash && "quest-done")}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-50">
                <Sparkles size={11} className="text-[#f2c14d]" />
                {q.name}
              </div>
              <span className="text-[9.5px] font-bold tabular-nums text-amber-100/50">
                {Math.min(Math.floor(q.prog(s)), q.target)}/{q.target}
              </span>
            </div>
            <div className="mt-0.5 text-[9.5px] leading-tight text-amber-100/55">{q.desc}</div>
            <Bar v={p} max={1} className="mt-1.5" fill="linear-gradient(90deg,#b8860b,#f2c14d)" />
          </div>
        );
      })}
    </div>
  );
}

// ---------------- toasts ----------------
const TOAST_STYLE: Record<string, { icon: any; ring: string; text: string }> = {
  war: { icon: Swords, ring: "border-red-400/40", text: "text-red-200" },
  quest: { icon: Sparkles, ring: "border-[#f2c14d]/40", text: "text-[#f7df9e]" },
  warn: { icon: AlertTriangle, ring: "border-orange-400/40", text: "text-orange-200" },
  good: { icon: Check, ring: "border-emerald-400/40", text: "text-emerald-200" },
  info: { icon: Flame, ring: "border-amber-300/30", text: "text-amber-100" },
};

export function Toasts() {
  useTicker(120);
  const s = G.s;
  if (!s) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-[54px] z-30 flex -translate-x-1/2 flex-col items-center gap-1.5">
      {s.toasts.map((t) => {
        const st = TOAST_STYLE[t.kind] ?? TOAST_STYLE.info;
        const Ico = st.icon;
        return (
          <div
            key={t.id}
            className={cn("glass toast-in flex items-center gap-2 rounded-xl border px-3.5 py-2", st.ring)}
            style={{ opacity: t.t < 0.6 ? t.t / 0.6 : 1, transition: "opacity 0.2s linear" }}
          >
            <Ico size={13} className={st.text} />
            <div>
              <div className={cn("text-[11.5px] font-extrabold leading-tight", st.text)}>{t.title}</div>
              {t.sub && <div className="text-[9.5px] font-medium leading-tight text-amber-100/55">{t.sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- minimap ----------------
export function Minimap() {
  useTicker(400);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      const c = ref.current;
      if (!c || !G.s) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      drawMinimap(ctx, G.s, c.width, c.height, window.innerWidth, window.innerHeight);
    }, 180);
    return () => window.clearInterval(id);
  }, []);
  const jump = (e: React.PointerEvent) => {
    const s = G.s;
    const c = ref.current;
    if (!s || !c) return;
    S.ui();
    const r = c.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const k = Math.min(c.width / WORLD.w, c.height / WORLD.h);
    const oy = (c.height - WORLD.h * k) / 2;
    s.cam.tx = clamp(px / k, 240, WORLD.w - 240);
    s.cam.ty = clamp((py - oy) / k, 220, WORLD.h - 200);
  };
  return (
    <div className="glass absolute bottom-3 right-3 z-20 rounded-xl p-1.5">
      <canvas ref={ref} width={186} height={102} className="block cursor-pointer rounded-lg" onPointerDown={jump} title="Click to travel" />
    </div>
  );
}

// ---------------- pause chip & hints ----------------
export function PauseChip() {
  useTicker(300);
  const s = G.s;
  if (!s || !s.paused) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
      <div className="glass pulse-glow flex items-center gap-2 rounded-2xl px-5 py-3">
        <Play size={16} className="text-amber-200" />
        <div>
          <div className="font-display text-[13px] font-bold tracking-[0.3em] text-amber-100">PAUSED</div>
          <div className="text-[9.5px] text-amber-100/50">Press P to resume</div>
        </div>
      </div>
    </div>
  );
}

export function ControlHint() {
  useTicker(500);
  const s = G.s;
  if (!s || s.time > 45) return null;
  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
      <div className="glass-soft flex items-center gap-3 rounded-full px-4 py-1.5 text-[9.5px] font-semibold text-amber-100/60">
        <span className="inline-flex items-center gap-1"><MousePointer2 size={10} /> Click trees & rocks to gather</span>
        <span className="inline-flex items-center gap-1"><Move size={10} /> Drag to pan</span>
        <span className="inline-flex items-center gap-1"><ZoomIn size={10} /> Scroll to zoom</span>
        <span className="inline-flex items-center gap-1"><SwordsIco size={10} /> Right-click: rally</span>
        <span className="inline-flex items-center gap-1"><Hourglass size={10} /> B / F: views</span>
      </div>
    </div>
  );
}

// ---------------- offline modal ----------------
export function OfflineModal() {
  useTicker(300);
  const s = G.s;
  if (!s || !s.offline) return null;
  const o = s.offline;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[3px]">
      <div className="glass rise-in w-[340px] rounded-2xl p-5 text-center">
        <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-[#e0641a] to-[#8c3a10]">
          <Gift size={20} className="text-[#ffe6c4]" />
        </div>
        <div className="font-display text-[17px] font-bold tracking-wider text-amber-50">WHILE YOU WERE AWAY</div>
        <div className="mt-1 text-[11px] text-amber-100/55">
          Emberhold's crew kept working for <b className="text-amber-200">{fmtTime(o.dur)}</b> — at a skeleton pace.
        </div>
        <div className="mt-3 space-y-1 rounded-xl bg-black/30 p-2.5">
          {(Object.entries(o.gains) as [ResKey, number][]).map(([r, a]) => (
            <div key={r} className="flex items-center justify-between text-[12px] font-bold">
              <span className="inline-flex items-center gap-1.5 text-amber-100/80"><ResIcon k={r} size={13} /> {r}</span>
              <span className="tabular-nums text-emerald-300">+{Math.floor(a)}</span>
            </div>
          ))}
        </div>
        <button
          className="btn-ember mt-4 w-full rounded-xl px-4 py-2.5 text-[13px] font-extrabold"
          onClick={() => { S.coin(); s.offline = null; }}
        >
          Collect
        </button>
      </div>
    </div>
  );
}

// ---------------- intro overlay ----------------
export function IntroOverlay({ hasSave, onBegin }: { hasSave: boolean; onBegin: (fresh: boolean) => void }) {
  return (
    <div className="absolute inset-0 z-50 overflow-hidden bg-[#0d0b08]">
      <img src={emblem} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d0b08] via-[#0d0b08aa] to-[#0d0b0888]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(8,6,3,0.85)_100%)]" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="rise-in text-[10px] font-bold tracking-[0.5em] text-[#ff9a4d]">FROM A SPARK, A REALM</div>
        <h1
          className="rise-in mt-3 font-display text-[64px] font-black leading-none tracking-[0.12em] sm:text-[84px]"
          style={{
            background: "linear-gradient(180deg,#fff3d8 15%,#ffc06a 55%,#d9541a 95%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 0 60px rgba(224,100,26,0.35)",
            animationDelay: "0.08s",
          }}
        >
          EMBERHOLD
        </h1>
        <p className="rise-in mt-3 max-w-[520px] text-[13px] leading-relaxed text-amber-100/70" style={{ animationDelay: "0.16s" }}>
          Begin with two empty hands and a cold stockpile. Click the world to work it, hire hands to
          work for you, forge an army — and push the burning line until the horizon is yours.
        </p>
        <div className="rise-in mt-6 grid w-full max-w-[560px] grid-cols-3 gap-2" style={{ animationDelay: "0.24s" }}>
          {[
            { t: "A LIVING BASE", d: "Workers, smoke, cranes of crates — growth you can see" },
            { t: "AUTOMATION", d: "From your own two hands to a self-running machine" },
            { t: "THE FRONT", d: "An autobattler war that feeds — and is fed by — your economy" },
          ].map((f) => (
            <div key={f.t} className="glass rounded-xl p-3 text-left">
              <div className="font-display text-[10px] font-bold tracking-[0.25em] text-amber-200">{f.t}</div>
              <div className="mt-1 text-[10px] leading-snug text-amber-100/55">{f.d}</div>
            </div>
          ))}
        </div>
        <div className="rise-in mt-7 flex items-center gap-3" style={{ animationDelay: "0.32s" }}>
          {hasSave && (
            <button className="btn-ember rounded-xl px-7 py-3 text-[14px] font-extrabold tracking-wide" onClick={() => onBegin(false)}>
              CONTINUE THE REIGN
            </button>
          )}
          <button
            className={cn(hasSave ? "btn-ghost text-amber-100/85" : "btn-ember", "rounded-xl px-7 py-3 text-[14px] font-extrabold tracking-wide")}
            onClick={() => onBegin(true)}
          >
            {hasSave ? "FORGE ANEW" : "FOUND THE EMBERHOLD"}
          </button>
        </div>
        <div className="rise-in mt-5 text-[9.5px] font-semibold tracking-wider text-amber-100/35" style={{ animationDelay: "0.4s" }}>
          THE WORLD SAVES ITSELF EVERY FEW SECONDS
        </div>
      </div>
    </div>
  );
}
