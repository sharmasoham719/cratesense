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
}

const TONE_CLASS: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "text-foreground",
  green: "text-marker-green",
  amber: "text-marker-amber",
  red: "text-marker-red",
};

export function StatTile({ label, value, tone = "neutral", icon: Icon, trend, hint }: StatTileProps) {
  return (
    <Card className="p-4">
      <CardContent className="space-y-1 p-0">
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
      </CardContent>
    </Card>
  );
}
