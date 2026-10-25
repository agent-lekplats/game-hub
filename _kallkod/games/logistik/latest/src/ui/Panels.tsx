// ---------- left (Domain) & right (War) control panels ----------
import { useState } from "react";
import {
  Users, Hammer, Wrench, Warehouse, Plus, Swords, Flame, Target, Sparkles,
  ChevronsLeft, ChevronsRight, MousePointerClick, RotateCcw,
} from "lucide-react";
import { G, canAfford } from "../game/state";
import type { Cost, UnitKind } from "../game/state";
import {
  BUILDINGS, UPGRADES, TECHS, UNITS, UNIT_ORDER, STRIKE_DMG, WORKER,
  workerCost, stockpileCap, stockpileCost, STOCKPILE_MAX, waveComp,
} from "../game/data";
import {
  hireWorker, build, upgradeStockpile, buyUpgrade, buyTech, train, cancelTrain,
  toggleAuto, setFocus, currentArmyCap, totalQueued,
} from "../game/logic";
import { useTicker } from "../hooks";
import { CostChips, Pips, Bar, Section, ResIcon, UnitIcon, EnemyIcon } from "./bits";
import { cn } from "../utils/cn";
import { S } from "../game/audio";

// ---------- shared buy row ----------
function BuyRow({
  title, sub, cost, disabled, onClick, right, dim,
}: {
  title: React.ReactNode;
  sub?: string;
  cost: Cost;
  disabled?: boolean;
  onClick: () => void;
  right?: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <div className={cn("juicy-card rounded-lg border border-amber-100/8 bg-black/25 p-2", dim && "opacity-50")}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-amber-50">{title}</div>
          {sub && <div className="mt-0.5 text-[10px] leading-tight text-amber-100/50">{sub}</div>}
        </div>
        {right}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <CostChips cost={cost} />
        <button
          className="btn-ember rounded-md px-2.5 py-1 text-[11px] font-extrabold"
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          <Plus size={11} className="mr-0.5 inline -mt-px" />Build
        </button>
      </div>
    </div>
  );
}

function SmallBtn({ children, disabled, onClick, className, title }: {
  children: React.ReactNode; disabled?: boolean; onClick: (e: React.MouseEvent) => void; className?: string; title?: string;
}) {
  return (
    <button title={title} disabled={disabled} onClick={onClick} className={cn("btn-ember rounded-md px-2.5 py-1 text-[11px] font-extrabold", className)}>
      {children}
    </button>
  );
}

// ================= DOMAIN =================
export function DomainPanel() {
  useTicker(120);
  const [open, setOpen] = useState(true);
  const s = G.s;
  if (!s) return null;
  const slots = (s.buildings.bunkhouse ?? 0) * WORKER.slotsPerBunk;
  const cap = stockpileCap(s.stockLvl);
  const stored = s.res.wood + s.res.stone + s.res.iron + s.res.crystal;
  const wCost = workerCost(s.workers.length);
  const bunkCnt = s.buildings.bunkhouse ?? 0;

  if (!open)
    return (
      <button
        className="glass pulse-glow absolute left-3 top-[116px] z-20 flex h-10 w-10 items-center justify-center rounded-xl text-amber-100"
        onClick={() => { S.ui(); setOpen(true); }}
        title="Open Domain panel"
      >
        <ChevronsRight size={17} />
      </button>
    );

  return (
    <div className="glass absolute left-0 top-[52px] z-20 flex max-h-[calc(100%-140px)] w-[288px] flex-col border-l-0" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderTopRightRadius: 16, borderBottomRightRadius: 16 }}>
      <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
        <div className="font-display text-[12px] font-bold tracking-[0.3em] text-amber-100/90">DOMAIN</div>
        <button className="btn-ghost rounded-md p-1 text-amber-100/60" onClick={() => { S.ui(); setOpen(false); }} title="Collapse">
          <ChevronsLeft size={14} />
        </button>
      </div>
      <div className="scroll-slim min-h-0 flex-1 divide-y divide-amber-100/6 overflow-y-auto">
        {/* workers */}
        <Section title="CREW" icon={<Users size={12} />} right={<span className="text-[10px] font-bold tabular-nums text-amber-100/60">{s.workers.length}/{Math.min(slots, WORKER.maxWorkers)}</span>}>
          <div className="space-y-2">
            <div className="rounded-lg border border-amber-100/8 bg-black/25 p-2">
              <div className="flex items-center justify-between gap-2">
                <CostChips cost={wCost} />
                <SmallBtn
                  disabled={!canAfford(s, wCost) || s.workers.length >= Math.min(slots, WORKER.maxWorkers)}
                  onClick={() => hireWorker(s)}
                  title={s.workers.length >= slots ? "Build more bunkhouses for beds" : "Hire a worker"}
                >
                  Hire
                </SmallBtn>
              </div>
              {s.workers.length >= slots && (
                <div className="mt-1 text-[9.5px] text-amber-300/60">All beds full — build another bunkhouse</div>
              )}
            </div>
            {bunkCnt < BUILDINGS.bunkhouse.max ? (
              <BuyRow
                title={<><span>Bunkhouse</span><span className="text-[10px] font-semibold text-amber-100/50">{bunkCnt}/{BUILDINGS.bunkhouse.max}</span></>}
                sub="+2 worker beds"
                cost={BUILDINGS.bunkhouse.cost(bunkCnt)}
                disabled={!canAfford(s, BUILDINGS.bunkhouse.cost(bunkCnt))}
                onClick={() => build(s, "bunkhouse")}
              />
            ) : (
              <div className="rounded-lg border border-amber-100/8 bg-black/25 p-2 text-[10px] text-amber-100/50">All bunkhouses raised — the crew is at full strength.</div>
            )}
            {/* focus */}
            <div>
              <div className="mb-1 flex items-center gap-1 text-[9.5px] font-bold tracking-wider text-amber-100/45">
                <Target size={10} /> HARVEST FOCUS
              </div>
              <div className="flex gap-1">
                {(["auto", "wood", "stone", "iron", "crystal"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFocus(s, f)}
                    title={f === "auto" ? "Workers choose freely" : `Prioritize ${f}`}
                    className={cn(
                      "flex h-7 flex-1 items-center justify-center rounded-md border transition-colors",
                      s.focus === f
                        ? "border-amber-400/60 bg-amber-400/15 text-amber-100"
                        : "border-amber-100/10 bg-black/25 text-amber-100/45 hover:bg-amber-100/5"
                    )}
                  >
                    {f === "auto" ? <Sparkles size={12} /> : <ResIcon k={f} size={12} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* stockpile + buildings */}
        <Section title="STRUCTURES" icon={<Hammer size={12} />}>
          <div className="space-y-2">
            <div className="rounded-lg border border-amber-100/8 bg-black/25 p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-amber-50">
                  <Warehouse size={13} className="text-amber-200/80" /> Stockpile
                </div>
                <Pips lvl={s.stockLvl} max={STOCKPILE_MAX} />
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <Bar v={stored} max={cap} className="flex-1" />
                <span className="text-[9.5px] font-semibold tabular-nums text-amber-100/50">{Math.round(stored)}/{cap}</span>
              </div>
              {s.stockLvl < STOCKPILE_MAX && (
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <CostChips cost={stockpileCost(s.stockLvl)} />
                  <SmallBtn disabled={!canAfford(s, stockpileCost(s.stockLvl))} onClick={() => upgradeStockpile(s)} title="Double capacity">
                    Expand
                  </SmallBtn>
                </div>
              )}
            </div>
            {(s.buildings.workshop ?? 0) === 0 && (
              <BuyRow title="Workshop" sub={BUILDINGS.workshop.desc} cost={BUILDINGS.workshop.cost(0)} disabled={!canAfford(s, BUILDINGS.workshop.cost(0))} onClick={() => build(s, "workshop")} />
            )}
            {(s.buildings.forge ?? 0) === 0 && (
              <BuyRow title="Forge" sub={BUILDINGS.forge.desc} cost={BUILDINGS.forge.cost(0)} disabled={!canAfford(s, BUILDINGS.forge.cost(0))} onClick={() => build(s, "forge")} />
            )}
            {(s.buildings.barracks ?? 0) < BUILDINGS.barracks.max && (
              <BuyRow
                title={<><span>Barracks</span><span className="text-[10px] font-semibold text-amber-100/50">{s.buildings.barracks ?? 0}/{BUILDINGS.barracks.max}</span></>}
                sub={BUILDINGS.barracks.desc}
                cost={BUILDINGS.barracks.cost(s.buildings.barracks ?? 0)}
                disabled={!canAfford(s, BUILDINGS.barracks.cost(s.buildings.barracks ?? 0))}
                onClick={() => build(s, "barracks")}
              />
            )}
          </div>
        </Section>

        {/* economy upgrades */}
        {(s.buildings.workshop ?? 0) > 0 && (
          <Section title="WORKSHOP" icon={<Wrench size={12} />}>
            <div className="space-y-2">
              {UPGRADES.filter((u) => u.scope === "econ").map((u) => {
                const lvl = (G.s!.upg[u.id] ?? 0);
                const maxed = lvl >= u.max;
                return (
                  <div key={u.id} className="rounded-lg border border-amber-100/8 bg-black/25 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[12px] font-bold text-amber-50">{u.name}</div>
                      <Pips lvl={lvl} max={u.max} />
                    </div>
                    <div className="mt-0.5 text-[10px] text-amber-100/50">{u.desc}</div>
                    {!maxed && (
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <CostChips cost={u.cost(lvl + 1)} />
                        <SmallBtn disabled={!canAfford(G.s!, u.cost(lvl + 1))} onClick={() => buyUpgrade(G.s!, u.id)}>Upgrade</SmallBtn>
                      </div>
                    )}
                    {maxed && <div className="mt-1 text-[9.5px] font-bold tracking-wider text-emerald-400/80">MASTERED</div>}
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

// ================= WAR =================
export function WarPanel() {
  useTicker(120);
  const [open, setOpen] = useState(true);
  const s = G.s;
  if (!s) return null;
  const armyCapN = currentArmyCap(s);
  const usedCap = s.units.length + totalQueued(s);
  const nextWave = waveComp(s.conquest + 1);
  const forgeBuilt = (s.buildings.forge ?? 0) > 0;
  const barracksBuilt = (s.buildings.barracks ?? 0) > 0;
  const strikeLvl = s.tech.strike ?? 0;

  if (!open)
    return (
      <button
        className="glass pulse-glow absolute right-3 top-[116px] z-20 flex h-10 w-10 items-center justify-center rounded-xl text-amber-100"
        onClick={() => { S.ui(); setOpen(true); }}
        title="Open War panel"
      >
        <ChevronsLeft size={17} />
      </button>
    );

  return (
    <div className="glass absolute right-0 top-[52px] z-20 flex max-h-[calc(100%-140px)] w-[300px] flex-col border-r-0" style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }}>
      <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
        <div className="font-display text-[12px] font-bold tracking-[0.3em] text-amber-100/90">THE FRONT</div>
        <button className="btn-ghost rounded-md p-1 text-amber-100/60" onClick={() => { S.ui(); setOpen(false); }} title="Collapse">
          <ChevronsRight size={14} />
        </button>
      </div>
      <div className="scroll-slim min-h-0 flex-1 divide-y divide-amber-100/6 overflow-y-auto">
        {/* status */}
        <Section title="BATTLE CALL" icon={<Swords size={12} />}>
          {!barracksBuilt ? (
            <div className="rounded-lg border border-red-300/15 bg-red-950/20 p-2.5 text-[10.5px] leading-snug text-red-200/80">
              The Horde gathers in the east. Raise a <b>Barracks</b> to answer — win waves to push the line and claim spoiled land.
            </div>
          ) : (
            <div className="space-y-2">
              <div className={cn("rounded-lg border p-2.5", s.waveActive ? "border-red-400/30 bg-red-950/30" : "border-amber-100/10 bg-black/25")}>
                <div className={cn("text-[12px] font-bold", s.waveActive ? "text-red-300" : "text-amber-50")}>
                  {s.waveActive ? `Wave ${s.conquest + 1} assaults the line!` : `Wave ${s.conquest + 1} musters in ${Math.ceil(s.waveTimer)}s`}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {nextWave.map((c) => (
                    <span key={c.type} className="inline-flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-red-200/85">
                      <EnemyIcon k={c.type} size={11} /> ×{c.count}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-amber-100/55">
                <span>Ground won</span>
                <b className="tabular-nums text-amber-200/90">{s.conquest * 54} paces</b>
              </div>
              <div className="flex items-center gap-1.5 text-[9.5px] text-amber-100/45">
                <MousePointerClick size={10} /> Right-click the map to move the rally flag
              </div>
              <div className="chip rounded-md px-2 py-1 text-[10px] font-semibold text-amber-100/85">
                {strikeLvl > 0 ? "Chain Smite" : "Commander Bolt"}: click any enemy —{" "}
                <b className="text-[#ffd76b]">{STRIKE_DMG[Math.min(STRIKE_DMG.length - 1, strikeLvl)]} dmg</b>
                {strikeLvl > 0 && <span className="text-amber-200/60"> (AoE)</span>}
              </div>
            </div>
          )}
        </Section>

        {/* army */}
        <Section title="ARMY" icon={<Swords size={12} />} right={<span className="text-[10px] font-bold tabular-nums text-amber-100/60">{usedCap}/{armyCapN}</span>}>
          {!barracksBuilt ? (
            <div className="text-[10.5px] text-amber-100/45">Train soldiers here once a Barracks stands.</div>
          ) : (
            <div className="space-y-2">
              <Bar v={usedCap} max={armyCapN} fill="linear-gradient(90deg,#3f6fb8,#7ec3ff)" />
              {UNIT_ORDER.map((key: UnitKind) => {
                const def = UNITS[key];
                const locked = def.tech && !(s.tech[def.tech] ?? 0);
                const alive = s.units.filter((u) => u.type === key).length;
                const queued = s.barracksEnts.reduce((a, b) => a + b.queue.filter((q) => q === key).length, 0);
                const afford = canAfford(s, def.cost) && usedCap < armyCapN;
                if (locked) {
                  const techName = TECHS.find((t) => t.id === def.tech)?.name ?? "";
                  return (
                    <div key={key} className="rounded-lg border border-amber-100/6 bg-black/30 p-2 opacity-55">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-black/40 text-amber-100/50"><UnitIcon k={key} /></div>
                        <div>
                          <div className="text-[12px] font-bold text-amber-50/70">{def.name}</div>
                          <div className="text-[9.5px] text-amber-100/40">Requires {techName} at the Forge</div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={key} className="rounded-lg border border-amber-100/8 bg-black/25 p-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-b from-[#2a2118] to-[#191310] text-[#ffce8a] ring-1 ring-amber-200/20">
                        <UnitIcon k={key} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[12px] font-bold text-amber-50">
                          {def.name}
                          <span className="rounded bg-sky-400/15 px-1 text-[9.5px] font-bold tabular-nums text-sky-300/90">×{alive}</span>
                          {queued > 0 && (
                            <button
                              title="Cancel one queued (full refund)"
                              onClick={() => {
                                for (let bi = s.barracksEnts.length - 1; bi >= 0; bi--) {
                                  const qi = s.barracksEnts[bi].queue.lastIndexOf(key);
                                  if (qi >= 0) { cancelTrain(s, bi, qi); return; }
                                }
                              }}
                              className="inline-flex items-center gap-0.5 rounded bg-amber-400/15 px-1 text-[9.5px] font-bold tabular-nums text-amber-300/90 hover:bg-amber-400/25"
                            >
                              +{queued} <RotateCcw size={8} />
                            </button>
                          )}
                        </div>
                        <div className="text-[9.5px] text-amber-100/45">{def.desc}</div>
                      </div>
                      <button
                        title="Auto-train whenever affordable"
                        onClick={() => toggleAuto(s, key)}
                        className={cn(
                          "rounded px-1.5 py-1 text-[8.5px] font-extrabold tracking-wider transition-colors",
                          s.auto[key] ? "bg-emerald-500/80 text-emerald-950" : "bg-black/40 text-amber-100/40 hover:text-amber-100/70"
                        )}
                      >
                        AUTO
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <CostChips cost={def.cost} />
                      <SmallBtn
                        disabled={!afford}
                        title="Train one (Shift: train 5)"
                        onClick={(e) => train(s, key, e.shiftKey ? 5 : 1)}
                      >
                        Train
                      </SmallBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* forge */}
        {forgeBuilt && (
          <Section title="FORGE" icon={<Flame size={12} />}>
            <div className="space-y-2">
              {UPGRADES.filter((u) => u.scope === "war").map((u) => {
                const lvl = s.upg[u.id] ?? 0;
                const maxed = lvl >= u.max;
                return (
                  <div key={u.id} className="rounded-lg border border-amber-100/8 bg-black/25 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[12px] font-bold text-amber-50">{u.name}</div>
                      <Pips lvl={lvl} max={u.max} color="#ff8a6a" />
                    </div>
                    <div className="mt-0.5 text-[10px] text-amber-100/50">{u.desc}</div>
                    {!maxed ? (
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <CostChips cost={u.cost(lvl + 1)} />
                        <SmallBtn disabled={!canAfford(s, u.cost(lvl + 1))} onClick={() => buyUpgrade(s, u.id)}>Forge</SmallBtn>
                      </div>
                    ) : (
                      <div className="mt-1 text-[9.5px] font-bold tracking-wider text-emerald-400/80">MASTERED</div>
                    )}
                  </div>
                );
              })}
              <div className="pt-1 text-[9.5px] font-bold tracking-[0.2em] text-[#f2c14d]/70">VALOR ARTS</div>
              {TECHS.map((t) => {
                const lvl = s.tech[t.id] ?? 0;
                const maxed = lvl >= t.max;
                return (
                  <div key={t.id} className="rounded-lg border border-[#f2c14d]/15 bg-[#241a08]/40 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[12px] font-bold text-[#f7df9e]">{t.name}</div>
                      {t.max > 1 && <Pips lvl={lvl} max={t.max} color="#f2c14d" />}
                    </div>
                    <div className="mt-0.5 text-[10px] text-amber-100/55">{t.desc(maxed ? t.max - 1 : lvl)}</div>
                    {!maxed ? (
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <CostChips cost={t.cost(lvl + 1)} />
                        <SmallBtn disabled={!canAfford(s, t.cost(lvl + 1))} onClick={() => buyTech(s, t.id)}>Learn</SmallBtn>
                      </div>
                    ) : (
                      <div className="mt-1 text-[9.5px] font-bold tracking-wider text-emerald-400/80">LEARNED</div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
