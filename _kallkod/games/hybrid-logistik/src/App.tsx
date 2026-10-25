import { useEffect, useRef, useState } from 'react';
import { createGame, update, tryPlace, canAfford, buyResearch, expandTerritory, expandCost } from './game/engine';
import { render } from './game/render';
import { BUILDING_INFO, BuildingType, GameState, ResType, WORLD_W, WORLD_H, RES_COLORS, Resources } from './game/types';
import { setMuted, sfx } from './game/audio';

const BUILD_ORDER: BuildingType[] = ['house', 'storehouse', 'farm', 'mine', 'forge', 'barracks', 'cartyard', 'tower'];
const RES_ICON: Record<keyof Resources, string> = { wood: '🪵', stone: '🪨', food: '🌾', iron: '⛓️', weapons: '🗡️', gold: '🪙' };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(createGame());
  const [, setTick] = useState(0);
  const [tab, setTab] = useState<'build' | 'research'>('build');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!; const g = canvas.getContext('2d')!;
    let raf = 0, last = performance.now(), acc = 0, uiAcc = 0;
    const loop = (now: number) => {
      const s = gameRef.current;
      let dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (started) {
        dt *= s.speed; acc += dt;
        const step = 1 / 60;
        while (acc >= step) { update(s, step); acc -= step; }
      }
      render(g, s);
      uiAcc += dt; if (uiAcc > 0.2) { uiAcc = 0; setTick(t => t + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started]);

  const toWorld = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * WORLD_W, y: (e.clientY - r.top) / r.height * WORLD_H };
  };

  const s = gameRef.current;
  const total = s.res.wood + s.res.stone + s.res.food + s.res.iron + s.res.weapons;
  const soldiers = s.units.filter(u => u.side === 'ally').length;
  const enemies = s.units.filter(u => u.side === 'enemy').length;

  return (
    <div className="min-h-screen bg-[#120f0d] text-[#f1e6d0] font-sans select-none" style={{ backgroundImage: 'radial-gradient(ellipse at top, #2a2118 0%, #120f0d 60%)' }}>
      <div className="max-w-[1500px] mx-auto p-3 flex flex-col gap-3">
        {/* Top bar */}
        <header className="flex flex-wrap items-center gap-3 bg-[#1e1813]/90 border border-[#4a3a28] rounded-xl px-4 py-2 shadow-lg">
          <h1 className="text-xl font-black tracking-widest text-[#ffd27a] drop-shadow">EMBERHOLD</h1>
          <span className="text-xs text-[#b8a888] hidden md:inline">a living miniature world</span>
          <div className="flex flex-wrap gap-2 ml-auto">
            {(Object.keys(RES_ICON) as (keyof Resources)[]).map(k => (
              <div key={k} className="flex items-center gap-1 bg-[#2a2119] border border-[#4a3a28] rounded-lg px-2 py-1 text-sm min-w-[74px]" title={k}>
                <span>{RES_ICON[k]}</span>
                <span className="font-bold tabular-nums" style={{ color: RES_COLORS[k] }}>{Math.floor(s.res[k])}</span>
              </div>
            ))}
            <div className="flex items-center gap-1 bg-[#2a2119] border border-[#4a3a28] rounded-lg px-2 py-1 text-sm" title="Storage">
              📦 <span className={`font-bold tabular-nums ${total >= s.cap ? 'text-red-400' : ''}`}>{total}/{s.cap}</span>
            </div>
            <div className="flex items-center gap-1 bg-[#2a2119] border border-[#4a3a28] rounded-lg px-2 py-1 text-sm" title="Workers">
              👷 <span className="font-bold tabular-nums">{s.workers.filter(w => !w.isCart).length}</span> · 🛒 {s.workers.filter(w => w.isCart).length}
            </div>
            <div className="flex items-center gap-1 bg-[#2a2119] border border-[#4a3a28] rounded-lg px-2 py-1 text-sm" title="Army">
              ⚔️ <span className="font-bold tabular-nums text-red-300">{soldiers}</span> vs <span className="text-purple-300">{enemies}</span>
            </div>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3].map(sp => (
              <button key={sp} onClick={() => { s.speed = sp; }} className={`px-2 py-1 rounded text-xs font-bold border ${s.speed === sp ? 'bg-[#ffd27a] text-black border-[#ffd27a]' : 'border-[#4a3a28] hover:bg-[#2a2119]'}`}>{sp}x</button>
            ))}
            <button onClick={() => { s.muted = !s.muted; setMuted(s.muted); }} className="px-2 py-1 rounded text-xs border border-[#4a3a28] hover:bg-[#2a2119]">{s.muted ? '🔇' : '🔊'}</button>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-3">
          {/* World */}
          <div className="relative flex-1 rounded-xl overflow-hidden border border-[#4a3a28] shadow-2xl bg-black" style={{ aspectRatio: `${WORLD_W}/${WORLD_H}` }}>
            <canvas
              ref={canvasRef} width={WORLD_W} height={WORLD_H}
              className={`w-full h-full block ${s.placing ? 'cursor-crosshair' : 'cursor-default'}`}
              onMouseMove={e => { const p = toWorld(e); s.hoverX = p.x; s.hoverY = p.y; }}
              onMouseLeave={() => { s.hoverX = -1; }}
              onClick={e => { const p = toWorld(e); if (s.placing) { tryPlace(s, p.x, p.y); } }}
              onContextMenu={e => { e.preventDefault(); s.placing = null; }}
            />
            {s.placing && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-xs px-3 py-1 rounded-full border border-[#ffd27a]/50">
                Placing <b>{BUILDING_INFO[s.placing].name}</b> — click inside your border · right-click to cancel
              </div>
            )}
            {!started && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
                <div className="max-w-lg text-center space-y-4">
                  <h2 className="text-4xl font-black text-[#ffd27a] tracking-widest">EMBERHOLD</h2>
                  <p className="text-[#e8dcc0]">Three settlers. A depot. A dark fortress across the gate.</p>
                  <p className="text-sm text-[#b8a888]">Every log is carried by hand. Every soldier is fed and armed by your economy. Build cottages, farms, mines and forges; let carts take over your hauling; watch your tiny world grow into a machine of conquest — and let conquest push your borders outward.</p>
                  <div className="grid grid-cols-3 gap-2 text-xs text-left">
                    <div className="bg-white/5 rounded p-2">🌲 <b>Gather</b><br />Workers physically walk, chop and haul to the depot.</div>
                    <div className="bg-white/5 rounded p-2">🏗️ <b>Build</b><br />Place buildings; builders raise them plank by plank.</div>
                    <div className="bg-white/5 rounded p-2">⚔️ <b>Conquer</b><br />Barracks send soldiers to the front. Gold flows back.</div>
                  </div>
                  <button onClick={() => { setStarted(true); sfx('conquer'); }} className="px-8 py-3 bg-[#ffd27a] hover:bg-[#ffe1a0] text-black font-black rounded-lg text-lg shadow-lg">Found the Settlement</button>
                </div>
              </div>
            )}
          </div>

          {/* Side panel */}
          <aside className="w-full lg:w-[300px] flex flex-col gap-3">
            <div className="bg-[#1e1813]/90 border border-[#4a3a28] rounded-xl p-2 flex gap-1">
              <button onClick={() => setTab('build')} className={`flex-1 py-1.5 rounded-lg text-sm font-bold ${tab === 'build' ? 'bg-[#ffd27a] text-black' : 'hover:bg-white/5'}`}>🏗️ Build</button>
              <button onClick={() => setTab('research')} className={`flex-1 py-1.5 rounded-lg text-sm font-bold ${tab === 'research' ? 'bg-[#ffd27a] text-black' : 'hover:bg-white/5'}`}>📜 Research</button>
            </div>

            {tab === 'build' && (
              <div className="bg-[#1e1813]/90 border border-[#4a3a28] rounded-xl p-2 flex flex-col gap-1.5 max-h-[420px] overflow-auto">
                {BUILD_ORDER.map(bt => {
                  const info = BUILDING_INFO[bt]; const ok = canAfford(s, info.cost); const sel = s.placing === bt;
                  const count = s.buildings.filter(b => b.type === bt).length;
                  return (
                    <button key={bt} disabled={!ok} onClick={() => { s.placing = sel ? null : bt; }}
                      className={`text-left rounded-lg px-2 py-1.5 border transition ${sel ? 'border-[#ffd27a] bg-[#ffd27a]/15' : 'border-[#4a3a28] hover:bg-white/5'} ${ok ? '' : 'opacity-45 cursor-not-allowed'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{info.icon}</span>
                        <span className="font-bold text-sm">{info.name}</span>
                        {count > 0 && <span className="text-[10px] bg-white/10 rounded px-1">×{count}</span>}
                        <span className="ml-auto text-[11px] flex gap-1.5">
                          {(Object.keys(info.cost) as (keyof Resources)[]).map(k => (
                            <span key={k} className={s.res[k] >= (info.cost[k] ?? 0) ? '' : 'text-red-400'}>{RES_ICON[k]}{info.cost[k]}</span>
                          ))}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#b8a888] leading-tight mt-0.5">{info.desc}</div>
                    </button>
                  );
                })}
                <button onClick={() => expandTerritory(s)} disabled={s.res.gold < expandCost(s)}
                  className={`text-left rounded-lg px-2 py-1.5 border border-[#4a3a28] hover:bg-white/5 ${s.res.gold < expandCost(s) ? 'opacity-45 cursor-not-allowed' : ''}`}>
                  <div className="flex items-center gap-2"><span className="text-lg">🗺️</span><span className="font-bold text-sm">Expand Border</span><span className="ml-auto text-[11px]">🪙{expandCost(s)}</span></div>
                  <div className="text-[11px] text-[#b8a888]">Push the territory ring +40 with gold from the front.</div>
                </button>
              </div>
            )}

            {tab === 'research' && (
              <div className="bg-[#1e1813]/90 border border-[#4a3a28] rounded-xl p-2 flex flex-col gap-1.5">
                {s.research.map(r => (
                  <button key={r.id} disabled={r.bought || s.res.gold < r.cost} onClick={() => buyResearch(s, r.id)}
                    className={`text-left rounded-lg px-2 py-1.5 border ${r.bought ? 'border-green-700 bg-green-900/20' : 'border-[#4a3a28] hover:bg-white/5'} ${!r.bought && s.res.gold < r.cost ? 'opacity-45 cursor-not-allowed' : ''}`}>
                    <div className="flex items-center gap-2"><span className="text-lg">{r.icon}</span><span className="font-bold text-sm">{r.name}</span><span className="ml-auto text-[11px]">{r.bought ? '✓ done' : `🪙${r.cost}`}</span></div>
                    <div className="text-[11px] text-[#b8a888]">{r.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Priorities */}
            <div className="bg-[#1e1813]/90 border border-[#4a3a28] rounded-xl p-3">
              <div className="text-xs font-bold text-[#ffd27a] mb-2">WORKER PRIORITIES</div>
              {(['wood', 'stone', 'food', 'iron'] as ResType[]).map(k => (
                <div key={k} className="flex items-center gap-2 text-xs mb-1">
                  <span className="w-14">{RES_ICON[k]} {k}</span>
                  <input type="range" min={0} max={5} step={1} value={s.priority[k]} onChange={e => { s.priority[k] = +e.target.value; setTick(t => t + 1); }} className="flex-1 accent-[#ffd27a]" />
                  <span className="w-4 text-right tabular-nums">{s.priority[k]}</span>
                </div>
              ))}
            </div>

            {/* Front / stats */}
            <div className="bg-[#1e1813]/90 border border-[#4a3a28] rounded-xl p-3 text-xs space-y-1">
              <div className="font-bold text-[#ffd27a]">FRONTLINE</div>
              <div className="flex justify-between"><span>Sectors conquered</span><b>{s.front.conquered}</b></div>
              <div className="flex justify-between"><span>Production bonus</span><b>+{Math.round((s.prodMult - 1) * 100)}%</b></div>
              <div className="flex justify-between"><span>Enemies slain</span><b>{s.stats.kills}</b></div>
              <div className="flex justify-between"><span>Resources hauled</span><b>{s.stats.delivered}</b></div>
              <div className="flex justify-between"><span>Border radius</span><b>{s.territory}</b></div>
            </div>

            {/* Log */}
            <div className="bg-[#1e1813]/90 border border-[#4a3a28] rounded-xl p-3 text-[11px] space-y-1 text-[#c8b898]">
              {s.log.map((l, i) => <div key={i} className={i === 0 ? 'text-[#f1e6d0]' : 'opacity-70'}>• {l}</div>)}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
