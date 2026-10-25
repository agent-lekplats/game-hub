// ---------- shared UI atoms ----------
import { TreePine, BrickWall, Anvil, Gem, Medal, Sword, Crosshair, Shield, Mountain, Crown, Wand2, Dumbbell } from "lucide-react";
import type { Cost, ResKey } from "../game/state";
import { RES_META } from "../game/data";
import { G } from "../game/state";
import { fmt } from "../game/util";
import { cn } from "../utils/cn";

export function ResIcon({ k, size = 14, className }: { k: ResKey; size?: number; className?: string }) {
  const props = { size, color: RES_META[k].color, className, strokeWidth: 2.2 };
  switch (k) {
    case "wood": return <TreePine {...props} />;
    case "stone": return <BrickWall {...props} />;
    case "iron": return <Anvil {...props} />;
    case "crystal": return <Gem {...props} />;
    case "valor": return <Medal {...props} />;
  }
}

export function UnitIcon({ k, size = 18, className }: { k: string; size?: number; className?: string }) {
  const map: Record<string, any> = { militia: Sword, archer: Crosshair, guardian: Shield, golem: Mountain };
  const Ico = map[k] ?? Sword;
  return <Ico size={size} className={className} strokeWidth={2} />;
}

export function EnemyIcon({ k, size = 14, className }: { k: string; size?: number; className?: string }) {
  const map: Record<string, any> = { raider: Sword, brute: Dumbbell, shaman: Wand2, warlord: Crown };
  const Ico = map[k] ?? Sword;
  return <Ico size={size} className={className} strokeWidth={2} />;
}

export function CostChips({ cost, className }: { cost: Cost; className?: string }) {
  const s = G.s;
  const entries = Object.entries(cost) as [ResKey, number][];
  if (entries.length === 0) return <span className="text-[10px] text-amber-100/50">Free</span>;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-0.5", className)}>
      {entries.map(([r, a]) => {
        const has = (s?.res[r] ?? 0) >= a;
        return (
          <span key={r} className={cn("inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums", has ? "text-amber-100/85" : "text-red-400/90")} title={RES_META[r].label}>
            <ResIcon k={r} size={12} />
            {fmt(a)}
          </span>
        );
      })}
    </div>
  );
}

export function Pips({ lvl, max, color = "#ffb25e" }: { lvl: number; max: number; color?: string }) {
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className="h-[5px] w-[11px] rounded-full" style={{ background: i < lvl ? color : "rgba(255,220,170,0.16)" }} />
      ))}
    </div>
  );
}

export function Bar({ v, max, className, fill = "linear-gradient(90deg,#e0641a,#ffb25e)" }: { v: number; max: number; className?: string; fill?: string }) {
  const p = Math.max(0, Math.min(1, v / Math.max(1e-6, max)));
  return (
    <div className={cn("h-[7px] w-full overflow-hidden rounded-full bg-black/50", className)}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${p * 100}%`, background: fill }} />
    </div>
  );
}

export function Section({ title, icon, right, children, className }: { title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-3 py-2.5", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.22em] text-amber-200/60">
          {icon}
          <span className="font-display">{title}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
