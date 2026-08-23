import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Card + large numeral + label, per knowledge-base/UI_COMPONENT_LIBRARY.md
// §2 -- used for the Evaluation dashboard and Dashboard KPI rows
// (LAYOUT.md §3). trend must be sourced from real aggregation, never
// invented.
interface StatTileProps {
  label: string;
  value: string;
  tone?: "neutral" | "green" | "amber" | "red";
  icon?: LucideIcon;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  // Always-visible plain-language gloss for a protected/jargon term in
  // `label` (e.g. LOV) -- shown as static text, not a hover tooltip, since
  // hover discovery is unreliable on a workfloor/touch device.
  hint?: string;
  // 0-1 fill for the bento-style progress rail under the numeral, per
  // the Stitch "Evaluation Dashboard" reference -- only rendered when
  // the caller supplies a real ratio (e.g. the metric's own 0-1 value),
  // never a decorative placeholder.
  progress?: number | null;
}

const TONE_CLASS: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "text-foreground",
  green: "text-marker-green",
  amber: "text-marker-amber",
  red: "text-marker-red",
};

const TONE_BAR_CLASS: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "bg-foreground",
  green: "bg-marker-green shadow-[0_0_8px_var(--marker-green)]",
  amber: "bg-marker-amber shadow-[0_0_8px_var(--marker-amber)]",
  red: "bg-marker-red shadow-[0_0_8px_var(--marker-red)]",
};

export function StatTile({ label, value, tone = "neutral", icon: Icon, trend, hint, progress }: StatTileProps) {
  return (
    <Card className="relative overflow-hidden p-4">
      {tone !== "neutral" && (
        <div
          className={cn(
            "pointer-events-none absolute -top-10 -right-10 size-32 rounded-full blur-2xl",
            tone === "green" && "bg-marker-green/10",
            tone === "amber" && "bg-marker-amber/10",
            tone === "red" && "bg-marker-red/10"
          )}
        />
      )}
      <CardContent className="relative space-y-1 p-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm">{label}</p>
            {hint && <p className="text-muted-foreground/70 text-xs">{hint}</p>}
          </div>
          {Icon && <Icon className="text-muted-foreground size-4 shrink-0" />}
        </div>
        <p
          key={value}
          className={cn(
            "text-3xl font-semibold tabular-nums motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 duration-200",
            TONE_CLASS[tone]
          )}
        >
          {value}
        </p>
        {trend && (
          <p
            className={cn(
              "flex items-center gap-1 text-xs",
              trend.direction === "up" && "text-marker-green",
              trend.direction === "down" && "text-marker-red",
              trend.direction === "flat" && "text-muted-foreground"
            )}
          >
            {trend.direction === "up" && <TrendingUp className="size-3" />}
            {trend.direction === "down" && <TrendingDown className="size-3" />}
            {trend.label}
          </p>
        )}
        {progress !== undefined && progress !== null && (
          <div className="bg-muted mt-3 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={cn("h-full rounded-full transition-all duration-300", TONE_BAR_CLASS[tone])}
              style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
