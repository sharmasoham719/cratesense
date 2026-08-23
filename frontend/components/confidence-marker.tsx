import { Check, Minus, X } from "lucide-react";

import { cn } from "@/lib/utils";

// The single most-reused component in the app (knowledge-base/UI_COMPONENT_LIBRARY.md
// §3) -- every table cell, card, and chip showing a field's confidence uses
// this, never an ad-hoc colored Badge. Per apple-design-skill color.md
// ("avoid relying solely on color... provide the same information in
// alternative ways so people with color blindness... can understand it"),
// each level pairs its color with a distinct glyph (check/dash/x), not
// just a colored dot -- a color-blind reviewer scanning a dense table can
// still tell green from red by shape alone.
export type MarkerLevel = "green" | "amber" | "red";

interface ConfidenceMarkerProps {
  level: MarkerLevel;
  size?: "sm" | "md";
  showLabel?: boolean;
}

const LEVEL_LABEL: Record<MarkerLevel, string> = {
  green: "High confidence",
  amber: "Partial confidence",
  red: "Low confidence",
};

const LEVEL_ICON: Record<MarkerLevel, typeof Check> = {
  green: Check,
  amber: Minus,
  red: X,
};

const LEVEL_CLASS: Record<MarkerLevel, string> = {
  green: "bg-marker-green/15 text-marker-green",
  amber: "bg-marker-amber/15 text-marker-amber",
  red: "bg-marker-red/15 text-marker-red",
};

export function ConfidenceMarker({ level, size = "sm", showLabel = false }: ConfidenceMarkerProps) {
  const dotSize = size === "sm" ? "size-4" : "size-5";
  const iconSize = size === "sm" ? "size-2.5" : "size-3";
  const Icon = LEVEL_ICON[level];

  return (
    <span className="inline-flex items-center gap-1.5" aria-label={LEVEL_LABEL[level]}>
      <span className={cn("flex shrink-0 items-center justify-center rounded-full", dotSize, LEVEL_CLASS[level])} aria-hidden="true">
        <Icon className={cn(iconSize, "stroke-[3]")} />
      </span>
      {showLabel && <span className="text-sm">{LEVEL_LABEL[level]}</span>}
    </span>
  );
}
