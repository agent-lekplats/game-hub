// ---------- top bar: brand, popping resource chips, combo streak, war status, controls ----------
import { useState } from "react";
import { Flame, Home, Swords, Pause, Play, Volume2, VolumeX, Settings, Hourglass, RotateCcw, Skull, Flag, Coins, Timer, Zap } from "lucide-react";
import { G, clearSave } from "../game/state";
import { STORABLE, WAVE_INTERVAL, stockpileCap, RES_META } from "../game/data";
import { ResIcon } from "./bits";
import { fmt, fmtRate, fmtTime, clamp } from "../game/util";
import { cn } from "../utils/cn";
import { S } from "../game/audio";
import { useTicker } from "../hooks";

interface Props {
  paused: boolean;
  muted: boolean;
  onJump: (t: "base" | "front") => void;
  onPause: () => void;
  onMute: () => void;
}

export default function TopBar({ paused, muted, onJump, onPause, onMute }: Props) {
  useTicker(60);
  const s = G.s;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  if (!s) return null;
  const cap = stockpileCap(s.stockLvl);
  const warAwake = (s.buildings.barracks ?? 0) > 0 || s.conquest > 0 || s.enemies.length > 0;
  const vFlash = s.resFlash?.valor ?? 0;

  const btn = "btn-ghost flex h-8 w-8 items-center justify-center rounded-lg text-amber-100/80 hover:text-amber-100";

  return (
    <div className="pointer-events-auto absolute left-0 right-0 top-0 z-20">
      <div className="glass flex items-center gap-3 border-x-0 border-t-0 px-3 py-2">
        {/* brand */}
        <div className="flex items-center gap-2 pr-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-b from-[#e0641a] to-[#8c3a10] shadow-[0_0_18px_rgba(224,100,26,0.5)]">
            <Flame size={17} className="text-[#ffe6c4]" />
          </div>
          <div className="leading-none">
            <div className="font-display text-[15px] font-bold tracking-[0.24em] text-[#f4e2bd]">EMBERHOLD</div>
            <div className="text-[8.5px] font-semibold tracking-[0.32em] text-amber-200/50">A LIVING FRONTIER</div>
          </div>
        </div>

        <div className="h-7 w-px bg-amber-100/10" />

        {/* resources with live pop & glow */}
        <div className="flex items-center gap-1.5">
          {STORABLE.map((r) => {
            const rate = s.rates[r];
            const full = s.res[r] >= cap;
            const fl = s.resFlash?.[r] ?? 0;
            const col = RES_META[r].color;
            return (
              <div
                key={r}
                className={cn("chip flex items-center gap-1.5 rounded-lg px-2 py-[5px] transition-transform duration-75", full && "border-amber-400/40")}
                style={{
                  transform: fl > 0.02 ? `scale(${1 + fl * 0.13})` : undefined,
                  borderColor: fl > 0.1 ? col : undefined,
                  boxShadow: fl > 0.1 ? `0 0 ${Math.round(fl * 16)}px ${col}66` : undefined,
                }}
                title={`${RES_META[r].label}${full ? " — storage full" : ""}`}
              >
                <ResIcon k={r} size={14} />
                <span className="text-[13px] font-bold tabular-nums text-amber-50">{fmt(s.res[r])}</span>
                <span className="text-[9px] font-medium tabular-nums text-amber-100/40">/{fmt(cap)}</span>
                {rate > 0.02 && <span className="text-[9.5px] font-bold tabular-nums text-emerald-400/90">{fmtRate(rate)}</span>}
              </div>
            );
          })}
          <div
            className="chip flex items-center gap-1.5 rounded-lg px-2 py-[5px] transition-transform duration-75"
            style={{
              transform: vFlash > 0.02 ? `scale(${1 + vFlash * 0.15})` : undefined,
              borderColor: vFlash > 0.1 ? "#f2c14d" : undefined,
              boxShadow: vFlash > 0.1 ? `0 0 ${Math.round(vFlash * 18)}px rgba(242,193,77,0.5)` : undefined,
            }}
            title="Valor — earned in battle, spent at the Forge"
          >
            <ResIcon k="valor" size={14} />
            <span className="text-[13px] font-bold tabular-nums text-amber-50">{fmt(s.res.valor)}</span>
          </div>

          {/* live combo streak badge */}
          {s.combo >= 2 && (
            <div
              className="flex items-center gap-1.5 rounded-lg border border-amber-300/50 bg-gradient-to-r from-[#ff7a29]/30 to-[#ffd86b]/25 px-2.5 py-[4px] shadow-[0_0_18px_rgba(255,140,40,0.4)]"
              style={{ transform: `scale(${1 + Math.min(0.14, s.combo * 0.01)})` }}
              title="Active harvest/smite combo — boosts crit chance & pitch!"
            >
              <Zap size={13} className="text-[#ffd86b]" />
              <span className="text-[11.5px] font-black tracking-wider tabular-nums text-[#ffe89e]">
                COMBO ×{s.combo}
              </span>
              <div className="h-[4px] w-10 overflow-hidden rounded-full bg-black/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#ff7a29] to-[#ffd86b]"
                  style={{ width: `${clamp(s.comboTimer / 2.5, 0, 1) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* conquest + wave */}
          <div className="chip flex items-center gap-1.5 rounded-lg px-2.5 py-[5px]" title="Territory wrested from the Horde">
            <Flag size={13} className="text-[#ff8a4a]" />
            <span className="text-[11px] font-bold text-amber-100/90">Conquest {s.conquest}</span>
          </div>
          {warAwake && (
            <div className="chip flex items-center gap-2 rounded-lg px-2.5 py-[5px]" title="Next horde wave">
              {s.waveActive ? (
                <Swords size={13} className="text-red-400" />
              ) : (
                <Hourglass size={13} className="text-amber-200/70" />
              )}
              <span className={cn("text-[11px] font-bold tabular-nums", s.waveActive ? "text-red-300" : "text-amber-100/90")}>
                {s.waveActive
                  ? s.enemies.length + s.pendingSpawns.length > 0
                    ? `Wave ${s.conquest + 1} — ${s.enemies.length + s.pendingSpawns.length} left`
                    : `Wave ${s.conquest + 1}`
                  : `Wave ${s.conquest + 1} in ${Math.ceil(s.waveTimer)}s`}
              </span>
              {!s.waveActive && (
                <div className="h-[4px] w-14 overflow-hidden rounded-full bg-black/50">
                  <div className="h-full rounded-full bg-red-400/80 transition-[width] duration-200" style={{ width: `${clamp(1 - s.waveTimer / WAVE_INTERVAL, 0, 1) * 100}%` }} />
                </div>
              )}
            </div>
          )}

          <div className="mx-1 h-7 w-px bg-amber-100/10" />

          <button className={btn} onClick={() => onJump("base")} title="View base (B)"><Home size={15} /></button>
          <button className={btn} onClick={() => onJump("front")} title="View the front (F)"><Swords size={15} /></button>
          <button className={btn} onClick={() => { S.ui(); onPause(); }} title={paused ? "Resume (P)" : "Pause (P)"}>
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button className={btn} onClick={() => onMute()} title={muted ? "Unmute (M)" : "Mute (M)"}>
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <div className="relative">
            <button className={btn} onClick={() => { S.ui(); setSettingsOpen((o) => !o); setConfirmWipe(false); }} title="Realm">
              <Settings size={15} />
            </button>
            {settingsOpen && (
              <div className="glass appear absolute right-0 top-10 z-30 w-64 rounded-xl p-3">
                <div className="mb-2 text-[10px] font-bold tracking-[0.25em] text-amber-200/60 font-display">RECORD OF THE REALM</div>
                <div className="space-y-1.5 text-[11px] text-amber-100/80">
                  <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><Skull size={12} className="text-red-300/80" /> Horde slain</span><b className="tabular-nums">{fmt(s.stats.kills)}</b></div>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><Flag size={12} className="text-amber-300/80" /> Waves repelled</span><b className="tabular-nums">{fmt(s.stats.wavesWon)}</b></div>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><Coins size={12} className="text-yellow-300/80" /> Total gathered</span><b className="tabular-nums">{fmt(s.stats.totalEarned)}</b></div>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><Zap size={12} className="text-amber-300/80" /> Best combo</span><b className="tabular-nums">×{s.maxCombo ?? 0}</b></div>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><Timer size={12} className="text-sky-300/80" /> Reign</span><b className="tabular-nums">{fmtTime(s.time)}</b></div>
                </div>
                <div className="my-2.5 h-px bg-amber-100/10" />
                {!confirmWipe ? (
                  <button className="btn-ghost w-full rounded-lg px-2 py-1.5 text-[11px] font-semibold text-red-300/90" onClick={() => setConfirmWipe(true)}>
                    <span className="inline-flex items-center gap-1.5"><RotateCcw size={12} /> Abandon realm</span>
                  </button>
                ) : (
                  <button
                    className="w-full rounded-lg bg-red-500/80 px-2 py-1.5 text-[11px] font-bold text-white"
                    onClick={() => { clearSave(); location.reload(); }}
                  >
                    Burn it all — are you sure?
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
