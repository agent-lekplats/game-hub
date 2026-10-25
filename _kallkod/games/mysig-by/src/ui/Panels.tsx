import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BUILDINGS, BUILD_ORDER, GOALS, HAULER_INFO, RES, RES_INFO, TECHS, PORTER_COST, levelDef, stageDef, type Building, type Conveyor, type ResId, type Stock } from '../game/data';
import { game, stockTotal } from '../game/sim';
import { drawPerson, toneColors, TAU } from '../game/draw';
import { setMuted } from '../game/audio';

export function useGame() {
  const [, setN] = useState(0);
  useEffect(() => game.subscribe(() => setN((n) => n + 1)), []);
  return game;
}

// ---------- atoms ----------
function Cost({ cost, className = '' }: { cost: Stock; className?: string }) {
  const parts = RES.filter((r) => cost[r]);
  if (!parts.length) return <span className={`text-emerald-200 ${className}`}>free</span>;
  return <span className={`inline-flex gap-1 whitespace-nowrap tabular-nums ${className}`}>{parts.map((r) => <span key={r} className={game.have(r) >= (cost[r] || 0) ? 'text-emerald-200' : 'text-rose-300'}>{cost[r]}{RES_INFO[r].emoji}</span>)}</span>;
}
type Tone = 'neutral' | 'good' | 'bad' | 'primary';
const TONE: Record<Tone, string> = {
  neutral: 'bg-white/10 text-white hover:bg-white/20 active:bg-white/25',
  good: 'bg-emerald-500/80 text-white hover:bg-emerald-400',
  bad: 'bg-rose-600/60 text-white hover:bg-rose-500',
  primary: 'bg-amber-300 text-slate-900 hover:bg-amber-200',
};
function Big({ onClick, children, tone = 'neutral', disabled, className = '', title }: { onClick: () => void; children: ReactNode; tone?: Tone; disabled?: boolean; className?: string; title?: string }) {
  return <button title={title} disabled={disabled} onClick={onClick} className={`flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold leading-tight transition active:scale-95 disabled:opacity-40 disabled:active:scale-100 ${TONE[tone]} ${className}`}>{children}</button>;
}
function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const c = tone === 'bad' ? 'bg-rose-500/30 text-rose-100' : tone === 'warn' ? 'bg-amber-400/25 text-amber-100' : tone === 'good' ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/10 text-slate-200';
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${c}`}>{children}</span>;
}
const Dark = ({ children }: { children: ReactNode }) => <span className="rounded-md bg-slate-900/45 px-1.5 py-0.5 text-[11px]">{children}</span>;

// ---------- top strip ----------
export function TopBar() {
  const g = useGame(); const s = g.s;
  const show = (r: ResId) => r === 'wood' || r === 'stone' || r === 'food' || g.have(r) > 0 || (r === 'iron' && g.unlocked('mine')) || (r === 'weapons' && g.unlocked('smithy'));
  const cap = g.totalCap(), stored = g.totalStored(); const fill = stored / Math.max(1, cap);
  const openStore = () => { const sh = s.buildings.find((b) => b.kind === 'storehouse'); if (sh) g.select({ type: 'building', id: sh.id }); };
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-1.5" style={{ paddingTop: 'max(0.375rem, env(safe-area-inset-top))', paddingLeft: 'max(0.375rem, env(safe-area-inset-left))', paddingRight: 'max(0.375rem, env(safe-area-inset-right))' }}>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <div role="button" onClick={openStore} title="Storage" className="pointer-events-auto relative max-w-[72vw] rounded-full bg-slate-900/70 text-[12px] text-white shadow backdrop-blur active:bg-slate-800/80">
          <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto px-2 py-1">
            {RES.filter(show).map((r) => <span key={r} className="flex shrink-0 items-center gap-0.5 px-1 font-semibold tabular-nums"><span>{RES_INFO[r].emoji}</span>{Math.floor(g.have(r))}</span>)}
            <span className="mx-1 h-3 w-px shrink-0 bg-white/20" />
            <span className="flex shrink-0 items-center gap-0.5 px-1 font-semibold tabular-nums">👥{s.population}<span className="text-slate-400">/{g.popCap()}</span></span>
            {g.unemployed > 0 && <span className="shrink-0 text-[10px] font-semibold text-emerald-300">{g.unemployed} free</span>}
            {s.hunger > 0.05 && <span className="shrink-0 animate-pulse px-1">🍞!</span>}
            {fill > 0.92 && <span className="shrink-0 animate-pulse px-1 font-semibold text-rose-300">📦 full</span>}
          </div>
          <span className="pointer-events-none absolute inset-x-3 bottom-0 h-[2px] rounded bg-white/10"><span className={`block h-full rounded ${fill > 0.9 ? 'bg-rose-400' : 'bg-amber-300/80'}`} style={{ width: `${Math.min(100, fill * 100)}%` }} /></span>
        </div>
        <Goal />
      </div>
      <div className="pointer-events-auto flex items-center gap-1">
        <button onClick={() => { s.paused = !s.paused; g.emit(); }} className={`h-9 min-w-[40px] rounded-full px-2 text-sm text-white shadow backdrop-blur active:scale-95 ${s.paused ? 'bg-amber-400/70' : 'bg-slate-900/70'}`}>{s.paused ? '▶' : '⏸'}</button>
        <button onClick={() => { s.speed = s.speed >= 3 ? 1 : s.speed + 1; s.paused = false; g.emit(); }} className="h-9 min-w-[40px] rounded-full bg-slate-900/70 px-2 text-[13px] font-bold text-white shadow backdrop-blur active:scale-95">{s.speed}×</button>
      </div>
      <Toasts />
    </div>
  );
}

function Goal() {
  const g = useGame(); const s = g.s;
  const [open, setOpen] = useState(s.goalIdx === 0 && s.time < 120);
  const [seen, setSeen] = useState(s.goalIdx);
  useEffect(() => { if (s.goalIdx !== seen) { setSeen(s.goalIdx); setOpen(false); } }, [s.goalIdx, seen]);
  const goal = GOALS[s.goalIdx]; if (!goal) return null;
  const prog = Math.min(goal.target, goal.progress(s));
  return (
    <button onClick={() => setOpen((o) => !o)} className={`pointer-events-auto max-w-[56vw] rounded-2xl px-2.5 py-1 text-left text-[11px] text-white shadow backdrop-blur transition ${s.goalFlash > 0 ? 'bg-amber-500/70' : 'bg-slate-900/60'}`}>
      <div className="flex items-center gap-1.5"><span>🎯</span><span className="truncate font-semibold">{goal.text}</span><span className="shrink-0 tabular-nums text-slate-300">{prog}/{goal.target}</span></div>
      <div className="mt-0.5 h-1 overflow-hidden rounded bg-white/10"><div className="h-full bg-amber-300 transition-all" style={{ width: `${(100 * prog) / goal.target}%` }} /></div>
      {open && <div className="mt-1 whitespace-normal text-slate-200">{goal.hint}</div>}
    </button>
  );
}

function Toasts() {
  const g = useGame(); const now = g.s.time;
  const msgs = g.s.messages.filter((m) => now - m.t < 5).slice(-2);
  return (
    <div className="pointer-events-none absolute right-2 top-12 flex max-w-[46vw] flex-col items-end gap-1">
      {msgs.map((m) => <div key={m.t + m.text} className={`rounded-xl px-2.5 py-1 text-[11px] font-semibold text-white shadow backdrop-blur ${m.kind === 'error' ? 'bg-rose-700/85' : m.kind === 'good' ? 'bg-emerald-700/85' : 'bg-slate-800/85'}`}>{m.text}</div>)}
    </div>
  );
}

// ---------- bottom slot: exactly one layer at a time ----------
export function BottomSlot() {
  const g = useGame(); const ui = g.ui;
  let content: ReactNode;
  if (ui.selected?.type === 'building') { const b = g.building(ui.selected.id); content = b ? <BuildingSheet b={b} /> : <Dock />; }
  else if (ui.selected?.type === 'conveyor') { const c = g.conveyor(ui.selected.id); content = c ? <ConveyorSheet c={c} /> : <Dock />; }
  else if (ui.sheet === 'front') content = <FrontSheet />;
  else if (ui.sheet === 'menu') content = <MenuSheet />;
  else if (ui.sheet === 'expand' && ui.expandTarget) content = <ExpandSheet />;
  else if (ui.sheet === 'build') content = <BuildTray />;
  else if (ui.tool !== 'select') content = <ToolBar />;
  else content = <Dock />;
  return <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-end p-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))', paddingRight: 'max(0.5rem, env(safe-area-inset-right))', paddingLeft: 'max(0.5rem, env(safe-area-inset-left))' }}>{content}</div>;
}

function Dock() {
  const g = useGame(); const f = g.s.frontline; const garrison = g.garrisonTotal(); const conv = g.unlocked('conveyor');
  return (
    <div className="pointer-events-auto flex items-end gap-0.5 rounded-2xl bg-slate-900/70 p-1 shadow-2xl backdrop-blur">
      <DockBtn icon="🏗️" label="Build" onClick={() => g.openSheet('build')} />
      <DockBtn icon={conv ? '🧍' : '🔒'} label="Conveyor" dim={!conv} onClick={() => (conv ? g.setTool('conveyor') : g.msg(unlockHint('conveyor'), 'info'))} />
      <DockBtn icon="🛣️" label="Road" onClick={() => g.setTool('road')} />
      <DockBtn icon="⚔️" label="Front" onClick={() => g.openSheet('front')} dot={f.state === 'fighting' ? 'bg-rose-400' : garrison > 0 ? 'bg-emerald-400' : null} />
      <DockBtn icon="☰" label="Menu" onClick={() => g.openSheet('menu')} />
    </div>
  );
}
function DockBtn({ icon, label, onClick, dim, dot }: { icon: string; label: string; onClick: () => void; dim?: boolean; dot?: string | null }) {
  return (
    <button onClick={onClick} className={`relative flex h-14 w-14 flex-col items-center justify-center rounded-xl text-white transition hover:bg-white/10 active:scale-95 active:bg-white/15 ${dim ? 'opacity-50' : ''}`}>
      <span className="text-[22px] leading-none">{icon}</span><span className="mt-1 text-[10px] font-semibold">{label}</span>
      {dot && <span className={`absolute right-2.5 top-2 h-2 w-2 rounded-full ${dot}`} />}
    </button>
  );
}

function Sheet({ children }: { children: ReactNode }) {
  return <div className="pointer-events-auto flex max-h-[min(62vh,330px)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 text-white shadow-2xl backdrop-blur">{children}</div>;
}
function Head({ icon, title, chips, onClose, onBack }: { icon: string; title: string; chips?: ReactNode; onClose: () => void; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-2 px-2.5 pt-2">
      {onBack && <button onClick={onBack} className="h-11 w-11 shrink-0 rounded-xl bg-white/10 text-xl active:scale-95">‹</button>}
      <span className="text-2xl leading-none">{icon}</span>
      <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-bold leading-tight">{title}</div>{chips && <div className="mt-0.5 flex flex-wrap gap-1">{chips}</div>}</div>
      <button onClick={onClose} className="h-11 w-11 shrink-0 rounded-xl bg-white/10 text-lg active:scale-95">✕</button>
    </div>
  );
}
const Actions = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap gap-1.5 overflow-y-auto px-2.5 pb-2.5 pt-2">{children}</div>;
function unlockHint(k: string): string { const gi = GOALS.findIndex((gl) => gl.unlock.includes(k)); return gi >= 0 ? `🔒 Unlocks at goal ${gi + 1}` : '🔒 Locked'; }

// ---------- tool bar (a tool is active) ----------
function ToolBar() {
  const g = useGame(); const ui = g.ui;
  let icon = '', title = '', hint = ''; let extra: ReactNode = null;
  if (ui.tool === 'build') {
    const mv = ui.moveId !== null ? g.building(ui.moveId) : null; const kind = g.activeKind(); const def = BUILDINGS[kind];
    icon = def.emoji; title = mv ? `Move ${levelDef(mv).name}` : def.name; hint = ui.touch ? 'Drag it into place, then ✓' : 'Click to place · drag to pan';
    const gpos = ui.ghost ?? (!ui.touch ? ui.hover : null); const chk = gpos ? g.ghostCheck(gpos) : { ok: false, reason: '' };
    extra = <>{!mv && <Cost cost={def.variants.base[0].cost} className="text-[12px]" />}{gpos && !chk.ok && chk.reason && <Chip tone="bad">{chk.reason}</Chip>}{ui.touch && <Big tone="good" disabled={!chk.ok} onClick={() => g.placeGhost()}>✓ Place</Big>}</>;
  } else if (ui.tool === 'conveyor') { icon = '🧍'; title = ui.extendId !== null ? 'Extend conveyor' : 'Human conveyor'; hint = ui.extendId !== null ? 'Drag onward from the glowing tile' : 'Drag: yard → storage · 2🪵 + 1 worker per post'; }
  else if (ui.tool === 'road') { icon = '🛣️'; title = 'Road'; hint = 'Drag to pave · tap a road to remove · 1🪨'; }
  return (
    <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl bg-slate-900/75 px-2.5 py-1.5 text-white shadow-2xl backdrop-blur">
      <span className="text-2xl leading-none">{icon}</span>
      <div className="min-w-0"><div className="truncate text-[13px] font-bold leading-tight">{title}</div><div className="truncate text-[11px] text-slate-300">{hint}</div></div>
      {extra}
      <Big onClick={() => g.closeAll()}>✕</Big>
    </div>
  );
}

// ---------- build tray ----------
function BuildTray() {
  const g = useGame();
  return (
    <Sheet>
      <Head icon="🏗️" title="Build" onClose={() => g.closeAll()} />
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-2.5 pb-2.5 pt-1.5">
        {BUILD_ORDER.map((k) => {
          const def = BUILDINGS[k]; const un = g.unlocked(k); const cost = def.variants.base[0].cost;
          return (
            <button key={k} title={def.hint} onClick={() => (un ? g.setTool('build', k) : g.msg(unlockHint(k), 'info'))} className={`flex h-[76px] w-[78px] shrink-0 flex-col items-center justify-center rounded-xl text-white transition active:scale-95 ${un ? 'bg-white/10 hover:bg-white/20' : 'bg-white/5 opacity-60'}`}>
              <span className="text-[24px] leading-none">{un ? def.emoji : '🔒'}</span>
              <span className="mt-1 text-[10px] font-semibold">{def.name}</span>
              {un ? <Cost cost={cost} className="text-[10px]" /> : <span className="text-[10px] text-slate-400">locked</span>}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

// ---------- building sheet ----------
function BuildingSheet({ b }: { b: Building }) {
  const g = useGame(); const ui = g.ui; const d = levelDef(b); const def = BUILDINGS[b.kind]; const opts = g.upgradeOptions(b);
  const out = stockTotal(b.output); const view = ui.subview; const setView = (v: string) => { ui.subview = v; g.emit(); };
  const close = () => g.closeAll();
  const chips: ReactNode[] = [];
  if (d.workers > 0) chips.push(<Chip key="w" tone={b.workers < d.workers ? 'warn' : 'neutral'}>👤 {b.workers}/{d.workers}</Chip>);
  if (d.produces) {
    if (d.workers > 0 && b.workers === 0) chips.push(<Chip key="s" tone="warn">No workers</Chip>);
    else if (b.blocked) chips.push(<Chip key="s" tone="bad">Yard full</Chip>);
    else if (b.starved) chips.push(<Chip key="s" tone="warn">Needs {RES.filter((r) => d.consumes?.[r] && (b.input[r] || 0) < d.consumes![r]!).map((r) => RES_INFO[r].emoji).join('')}</Chip>);
    else chips.push(<Chip key="s" tone="good">Working</Chip>);
    if (out > 0) chips.push(<Chip key="o">{out}/{d.outCap} in yard</Chip>);
  }
  if (d.storeCap) chips.push(<Chip key="st" tone={stockTotal(b.store) / d.storeCap > 0.9 ? 'bad' : 'neutral'}>📦 {stockTotal(b.store)}/{d.storeCap}</Chip>);
  if (d.popCap) chips.push(<Chip key="p">🏠 {d.popCap}</Chip>);
  if (d.goldPerMin) chips.push(<Chip key="g" tone="good">+{d.goldPerMin}🪙/min</Chip>);
  if (d.garrison !== undefined) chips.push(<Chip key="ga">🛡️ {b.garrison}/{d.garrison}</Chip>);
  if (d.haulers) chips.push(<Chip key="h">{HAULER_INFO[d.haulers.kind].emoji}×{d.haulers.count} · {d.haulers.capacity}📦</Chip>);

  if (view === 'upgrade') return (
    <Sheet>
      <Head icon="⬆️" title={opts.length > 1 ? 'Choose a path' : 'Upgrade'} onBack={() => setView('')} onClose={close} />
      <Actions>
        {opts.map((o) => (
          <button key={o.variant + o.level} disabled={!g.canAfford(o.def.cost)} onClick={() => { g.upgrade(b, o.variant, o.level); setView(''); }} className="flex min-h-[58px] min-w-[220px] flex-1 flex-col items-start justify-center rounded-xl bg-white/10 px-3 py-2 text-left transition hover:bg-white/20 active:scale-[0.98] disabled:opacity-50">
            <div className="flex w-full items-center justify-between gap-2"><span className="text-[14px] font-bold">{o.def.name}</span><Cost cost={o.def.cost} className="text-[12px]" /></div>
            <div className="text-[11px] text-slate-300">{o.def.desc}</div>
          </button>
        ))}
      </Actions>
    </Sheet>
  );
  if (view === 'tech') return (
    <Sheet>
      <Head icon="📜" title="Techniques" onBack={() => setView('')} onClose={close} />
      <div className="flex flex-col gap-1.5 overflow-y-auto px-2.5 pb-2.5 pt-2">
        {TECHS.map((t) => { const n = g.s.tech[t.id] || 0; const done = n >= t.max; return (
          <button key={t.id} disabled={done || !g.canAfford(t.cost(n))} onClick={() => g.buyTech(t.id)} className="flex min-h-[52px] items-center gap-3 rounded-xl bg-white/10 px-3 text-left transition hover:bg-white/20 active:scale-[0.98] disabled:opacity-50">
            <span className="text-2xl">{t.emoji}</span>
            <div className="min-w-0 flex-1"><div className="text-[13px] font-bold">{t.name} <span className="text-slate-400">{n}/{t.max}</span></div><div className="truncate text-[11px] text-slate-300">{t.desc}</div></div>
            {done ? <span className="text-[12px] font-bold text-emerald-300">max</span> : <Cost cost={t.cost(n)} className="text-[12px]" />}
          </button>
        ); })}
      </div>
    </Sheet>
  );
  if (view === 'info') {
    const lines: ReactNode[] = [];
    lines.push(<div key="hint" className="text-slate-300">{def.hint}</div>);
    if (d.produces) lines.push(<div key="pr">Makes {d.produces.amt}{RES_INFO[d.produces.res].emoji} every {d.cycle}s per worker · yard holds {d.outCap}</div>);
    if (d.consumes) lines.push(<div key="in">Input: {RES.filter((r) => d.consumes![r]).map((r) => `${RES_INFO[r].emoji} ${b.input[r] || 0}/${d.inputCap}${b.inbound[r] ? ` (+${b.inbound[r]} coming)` : ''}`).join(' · ')}</div>);
    if (out > 0) lines.push(<div key="out">Yard: {RES.filter((r) => b.output[r]).map((r) => `${b.output[r]}${RES_INFO[r].emoji}`).join(' ')}{b.reserved > 0 ? ` · ${b.reserved} reserved` : ''}</div>);
    if (d.storeCap) lines.push(<div key="sto">Stored: {RES.filter((r) => b.store[r]).map((r) => `${b.store[r]}${RES_INFO[r].emoji}`).join(' ') || 'nothing'}</div>);
    if (b.kind === 'storehouse') lines.push(<div key="por">Porters: {g.s.haulers.filter((h) => h.kind === 'porter').length} · you carry {g.founderCapacity()} boxes</div>);
    if (d.garrison !== undefined) lines.push(<div key="gar">1 soldier = 1 person + 1⚔️ + 5🌾 · {d.trainTime}s · weapon tier {g.weaponTier()}</div>);
    if (d.haulers) g.s.haulers.filter((h) => h.homeId === b.id).forEach((h, i) => lines.push(<div key={'h' + i}>{HAULER_INFO[h.kind].emoji} {h.state === 'idle' || h.state === 'wander' ? 'waiting for a big pile' : h.state === 'toPickup' ? 'going to pick up' : h.state === 'loading' ? `loading ${h.load}` : h.state === 'toDrop' ? `carrying ${h.load}` : `unloading ${h.load}`}</div>));
    lines.push(<div key="tier" className="text-slate-400">Tier {b.tier}{d.storeCap ? '' : ` · refund on demolish: ${Math.floor((d.cost.wood || 0) * 0.5)}🪵`}</div>);
    return (
      <Sheet>
        <Head icon={def.emoji} title={d.name} chips={chips} onBack={() => setView('')} onClose={close} />
        <div className="flex flex-col gap-1 overflow-y-auto px-3 pb-3 pt-1.5 text-[12px]">{lines}</div>
      </Sheet>
    );
  }
  const porterOk = g.unlocked('porter');
  return (
    <Sheet>
      <Head icon={def.emoji} title={d.name} chips={chips} onClose={close} />
      <Actions>
        {opts.length > 0 && <Big tone="primary" onClick={() => setView('upgrade')}>⬆ Upgrade{opts.length === 1 && <Dark><Cost cost={opts[0].def.cost} /></Dark>}</Big>}
        {out > 0 && <Big onClick={() => g.haulByHand(b)}>🧑‍🌾 Carry {Math.min(out, g.founderCapacity())}</Big>}
        {b.kind === 'storehouse' && <Big tone="good" disabled={!porterOk} title={porterOk ? '' : unlockHint('porter')} onClick={() => (porterOk ? g.hirePorter() : g.msg(unlockHint('porter'), 'info'))}>🧍 Hire porter <Dark><Cost cost={PORTER_COST} /></Dark></Big>}
        {b.kind === 'storehouse' && <Big onClick={() => setView('tech')}>📜 Techniques</Big>}
        {d.garrison !== undefined && <Big tone="good" disabled={g.garrisonTotal() === 0} onClick={() => { g.dispatch(); g.openSheet('front'); }}>🥁 Dispatch {g.garrisonTotal()}</Big>}
        {d.garrison !== undefined && <Big onClick={() => { b.autoTrain = !b.autoTrain; g.emit(); }}>{b.autoTrain ? '⚙️ Training' : '⏹ Paused'}</Big>}
        <Big onClick={() => setView('info')}>ℹ️</Big>
        {b.kind !== 'storehouse' && <Big onClick={() => g.startMove(b)}>↔️</Big>}
        {b.kind !== 'storehouse' && <Big tone="bad" onClick={() => g.demolish(b)}>🗑️</Big>}
      </Actions>
    </Sheet>
  );
}

// ---------- conveyor sheet ----------
function ConveyorSheet({ c }: { c: Conveyor }) {
  const g = useGame(); const ui = g.ui; const view = ui.subview; const setView = (v: string) => { ui.subview = v; g.emit(); };
  const close = () => g.closeAll();
  const sinkB = c.sink && c.sink.type === 'building' ? g.building(c.sink.id) : null;
  const chips: ReactNode[] = [
    <Chip key="st" tone={c.staffed < c.tiles.length ? 'warn' : 'neutral'}>👤 {c.staffed}/{c.tiles.length}</Chip>,
    c.srcIds.length ? null : <Chip key="src" tone="bad">No source</Chip>,
    c.sink ? <Chip key="snk" tone="good">→ {sinkB ? `${BUILDINGS[sinkB.kind].emoji} ${levelDef(sinkB).name}` : 'conveyor'}</Chip> : <Chip key="snk" tone="bad">No destination</Chip>,
    <Chip key="ln">{c.laneRes.map((r) => (r ? RES_INFO[r].emoji : '·')).join(' | ')}</Chip>,
    <Chip key="mv">{c.moved} moved</Chip>,
  ];
  if (view === 'lanes') return (
    <Sheet>
      <Head icon="🎨" title="Lanes" chips={[<Chip key="i">Left hand | right hand · lanes lock to their first good</Chip>]} onBack={() => setView('')} onClose={close} />
      <div className="flex flex-col gap-1.5 px-2.5 pb-2.5 pt-2">
        {[0, 1].map((ln) => (
          <div key={ln} className="flex items-center gap-1.5">
            <span className="w-11 text-[12px] font-bold">{ln === 0 ? 'Left' : 'Right'}</span>
            {[null, ...RES.filter((r) => r !== 'gold')].map((r) => <button key={r || 'auto'} onClick={() => { g.setLane(c, ln, r as ResId | null); g.emit(); }} className={`h-11 min-w-[46px] flex-1 rounded-xl text-lg transition active:scale-95 ${c.laneRes[ln] === r ? 'bg-amber-300 text-slate-900' : 'bg-white/10 hover:bg-white/20'}`}>{r ? RES_INFO[r].emoji : <span className="text-[11px] font-bold">auto</span>}</button>)}
          </div>
        ))}
      </div>
    </Sheet>
  );
  return (
    <Sheet>
      <Head icon="🧍" title={`Human conveyor · ${c.tiles.length} posts`} chips={chips} onClose={close} />
      <Actions>
        <Big tone="primary" onClick={() => g.startExtend(c)}>➕ Extend</Big>
        <Big onClick={() => g.reverseConveyor(c)}>🔁 Reverse</Big>
        <Big onClick={() => setView('lanes')}>🎨 Lanes</Big>
        <Big tone="bad" onClick={() => g.removeConveyor(c)}>🗑️</Big>
      </Actions>
    </Sheet>
  );
}

// ---------- expand sheet ----------
function ExpandSheet() {
  const g = useGame(); const cost = g.chunkCost();
  return (
    <Sheet>
      <Head icon="🔓" title="Expand territory" chips={[<Chip key="c">Claim the highlighted land</Chip>]} onClose={() => g.closeAll()} />
      <Actions><Big tone="good" disabled={!g.canAfford(cost)} onClick={() => { const t = g.ui.expandTarget!; g.expand(t.cx, t.cy); g.closeAll(); }}>🔓 Expand <Dark><Cost cost={cost} /></Dark></Big></Actions>
    </Sheet>
  );
}

// ---------- menu sheet ----------
function MenuSheet() {
  const g = useGame(); const s = g.s; const ui = g.ui;
  return (
    <Sheet>
      <Head icon="🏘️" title="Tiny Logistics" chips={[<Chip key="r">🚚 {g.deliveryRate()}/min</Chip>, <Chip key="d">📦 {s.stats.delivered.toLocaleString()} moved</Chip>, <Chip key="w">🏆 {s.frontline.wins}</Chip>, <Chip key="p">👥 {s.population}</Chip>]} onClose={() => g.closeAll()} />
      <Actions>
        <Big onClick={() => { ui.helpOpen = true; ui.sheet = 'none'; g.emit(); }}>❓ How to play</Big>
        <Big onClick={() => { s.muted = !s.muted; setMuted(s.muted); g.emit(); }}>{s.muted ? '🔇 Sound off' : '🔊 Sound on'}</Big>
        {ui.subview === 'reset' ? <Big tone="bad" onClick={() => { g.reset(); g.closeAll(); }}>⚠️ Tap again: erase world</Big> : <Big onClick={() => { ui.subview = 'reset'; g.emit(); }}>🆕 New world</Big>}
      </Actions>
    </Sheet>
  );
}

// ---------- frontline sheet ----------
function Bar({ label, frac, color }: { label: string; frac: number; color: string }) {
  return <div><div className="flex justify-between text-[11px] font-semibold"><span>{label}</span></div><div className="h-2 w-full overflow-hidden rounded bg-white/10"><div className={`h-full ${color} transition-all`} style={{ width: `${Math.max(0, Math.min(100, frac * 100))}%` }} /></div></div>;
}
function FrontSheet() {
  const g = useGame(); const f = g.s.frontline; const st = stageDef(f.stage);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0; const start = performance.now();
    const loop = () => { const cv = canvasRef.current; if (cv) drawBattle(cv, (performance.now() - start) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  const garrison = g.garrisonTotal();
  const status = f.state === 'idle' ? (f.army > 0 ? 'Camped' : 'No army') : f.state === 'marching' ? `Marching ${Math.ceil(f.timer)}s` : f.state === 'fighting' ? 'Fighting!' : f.state === 'resting' ? `Victory · ${Math.ceil(f.timer)}s` : 'Returning';
  return (
    <Sheet>
      <Head icon={st.emoji} title={st.name} chips={[<Chip key="s">Stage {f.stage + 1}</Chip>, <Chip key="st" tone={f.state === 'fighting' ? 'bad' : f.state === 'resting' ? 'good' : 'neutral'}>{status}</Chip>, !f.fed && f.army > 0 ? <Chip key="fd" tone="bad">🍞 starving</Chip> : null, <Chip key="w">🏆 {f.wins}</Chip>]} onClose={() => g.closeAll()} />
      <div className="flex gap-2.5 px-2.5 pb-2.5 pt-1.5">
        <canvas ref={canvasRef} className="h-[96px] w-[190px] shrink-0 rounded-xl bg-gradient-to-b from-sky-900/60 to-emerald-900/50" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Bar label={`🛡️ ${f.army} soldiers`} frac={f.maxHp ? f.hp / f.maxHp : 0} color="bg-emerald-400" />
          <Bar label={`💀 ${st.name} · ${Math.ceil(f.enemyHp)}`} frac={f.enemyMax ? f.enemyHp / f.enemyMax : 1} color="bg-rose-400" />
          <div className="flex flex-wrap gap-1.5">
            <Big tone="good" className="min-h-[42px]" disabled={garrison === 0} onClick={() => g.dispatch()}>🥁 Dispatch {garrison}</Big>
            {f.state === 'idle' && f.army > 0 && <Big tone="primary" className="min-h-[42px]" onClick={() => { f.state = 'marching'; f.timer = 4; g.emit(); }}>⚔️ Attack</Big>}
            <Big className="min-h-[42px]" disabled={f.army === 0 || f.state === 'returning'} onClick={() => g.retreat()}>↩</Big>
            <Big className="min-h-[42px]" onClick={() => { f.auto = !f.auto; g.emit(); }}>{f.auto ? '🔁 Auto' : '⏹ Hold'}</Big>
          </div>
          <div className="truncate text-[11px] text-slate-300">Loot <Cost cost={st.loot} /> · {f.log[0]}</div>
        </div>
      </div>
    </Sheet>
  );
}

function drawBattle(cv: HTMLCanvasElement, t: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1); const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const ctx = cv.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const f = game.s.frontline; const st = stageDef(f.stage);
  ctx.fillStyle = '#5e8f48'; ctx.fillRect(0, h * 0.45, w, h * 0.55);
  ctx.fillStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < 6; i++) ctx.fillRect(0, h * 0.5 + i * 9, w, 3);
  const ex = w * 0.8; ctx.fillStyle = '#6b4a3a'; ctx.beginPath(); ctx.moveTo(ex - 22, h * 0.62); ctx.lineTo(ex, h * 0.28); ctx.lineTo(ex + 22, h * 0.62); ctx.closePath(); ctx.fill(); ctx.font = '16px system-ui'; ctx.textAlign = 'center'; ctx.fillText(st.emoji, ex, h * 0.55);
  const fighting = f.state === 'fighting'; const marching = f.state === 'marching';
  const k = 30;
  const ours = Math.min(12, f.army), theirs = Math.min(12, Math.ceil((f.enemyMax ? f.enemyHp / f.enemyMax : 1) * Math.min(12, Math.max(3, st.str / 6))));
  const shakeX = f.hitFlash > 0 ? Math.sin(t * 80) * 2 : 0;
  for (let i = 0; i < theirs; i++) {
    const col = i % 4, row = Math.floor(i / 4); const x = ex - 30 - row * 14 - (fighting ? Math.sin(t * 6 + i) * 3 : 0), y = h * 0.62 + col * 7 - 10 + shakeX * 0.5;
    drawPerson(ctx, x, y, k, Math.PI, { phase: t * 8 + i, moving: fighting, time: t, shirt: '#3b3b48', hat: 'helmet', tool: 'spear', swing: fighting ? (Math.sin(t * 5 + i * 1.3) + 1) / 2 : 0, skin: toneColors(i).skin });
  }
  const ax = f.state === 'idle' && f.army === 0 ? -100 : marching ? w * 0.15 + (1 - f.timer / 7) * w * 0.3 : f.state === 'returning' ? w * 0.4 - (1 - f.timer / 6) * w * 0.5 : fighting || f.state === 'resting' ? w * 0.5 : w * 0.3;
  for (let i = 0; i < ours; i++) {
    const col = i % 4, row = Math.floor(i / 4); const x = ax - row * 14 + (fighting ? Math.sin(t * 6 + i) * 3 : 0) - shakeX, y = h * 0.62 + col * 7 - 10;
    drawPerson(ctx, x, y, k, f.state === 'returning' ? Math.PI : 0, { phase: t * 9 + i, moving: marching || f.state === 'returning' || fighting, time: t, shirt: '#8a3b2e', hat: 'helmet', tool: 'spear', shield: true, swing: fighting ? (Math.sin(t * 6 + i * 1.7) + 1) / 2 : 0, skin: toneColors(i + 2).skin });
  }
  if (fighting) { for (let i = 0; i < 5; i++) { const px = w * 0.62 + Math.sin(t * 13 + i * 2) * 12, py = h * 0.5 + Math.cos(t * 11 + i) * 10; ctx.fillStyle = `rgba(255,${200 - i * 30},80,${0.5 + 0.5 * Math.sin(t * 20 + i)})`; ctx.beginPath(); ctx.arc(px, py, 2, 0, TAU); ctx.fill(); } }
  if (f.state === 'resting') { ctx.font = 'bold 14px system-ui'; ctx.fillStyle = '#ffe58a'; ctx.fillText('🏆 Victory!', w / 2, h * 0.2); }
  if (f.army === 0 && f.state === 'idle') { ctx.font = '11px system-ui'; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText('no army in the field', w * 0.32, h * 0.3); }
}

// ---------- help ----------
export function Help() {
  const g = useGame(); if (!g.ui.helpOpen) return null;
  const close = () => { g.ui.helpOpen = false; g.emit(); };
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-3" onClick={close}>
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 p-4 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-xl font-black">🏘️ Tiny Logistics</div>
        <div className="mt-0.5 text-[12px] text-slate-300">Grow a few box-carrying villagers into a living machine of conveyors, donkeys, wagons and elephants.</div>
        <div className="mt-3 grid gap-2 text-[13px]">
          <div className="flex gap-2"><span className="text-xl">📦</span><span>Goods pile up in yards. Only goods carried to the <b>Storehouse</b> can be spent.</span></div>
          <div className="flex gap-2"><span className="text-xl">👆</span><span><b>Tap a pile</b> — you walk over and carry it yourself.</span></div>
          <div className="flex gap-2"><span className="text-xl">🧍</span><span><b>Conveyor:</b> drag a line from a yard to storage. Workers pass goods hand to hand.</span></div>
          <div className="flex gap-2"><span className="text-xl">🐘</span><span>Donkeys carry 10, wagons 100, elephants 1000. Roads speed everyone up.</span></div>
          <div className="flex gap-2"><span className="text-xl">⚔️</span><span>Forge weapons, train soldiers, dispatch them. Loot rolls back into your Storehouse.</span></div>
        </div>
        <div className="mt-3 text-[11px] text-slate-400">Drag to pan · pinch or scroll to zoom · tap empty ground to close panels</div>
        <button className="mt-3 h-12 w-full rounded-xl bg-emerald-500 text-[15px] font-bold active:scale-[0.98]" onClick={close}>Let's build</button>
      </div>
    </div>
  );
}
