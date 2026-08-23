import { cn } from "@/lib/utils";

// A small horizontal stacked bar (green/amber/red proportional segments),
// per knowledge-base/UI_COMPONENT_LIBRARY.md §3 -- used in the job
// history table and the running-job summary bar for an at-a-glance
// quality signal without opening the job. Never color-only: aria-label
// spells out the counts (knowledge-base/FRONTEND_DESIGN_SYSTEM.md §2/§8).
interface MarkerDistributionBarProps {
  green: number;
  amber: number;
  red: number;
  total: number;
}

export function MarkerDistributionBar({ green, amber, red, total }: MarkerDistributionBarProps) {
  if (total === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div
      className="bg-muted flex h-2 w-24 overflow-hidden rounded-full"
      aria-label={`${green} green, ${amber} amber, ${red} red`}
    >
      {green > 0 && <div className={cn("bg-marker-green h-full")} style={{ width: pct(green) }} />}
      {amber > 0 && <div className={cn("bg-marker-amber h-full")} style={{ width: pct(amber) }} />}
      {red > 0 && <div className={cn("bg-marker-red h-full")} style={{ width: pct(red) }} />}
    </div>
  );
}
