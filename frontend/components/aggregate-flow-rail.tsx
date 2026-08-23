"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { PIPELINE_NODES, type RowProgress } from "@/lib/use-job-stream";

// The batch-level hero visual for the running-job view. Renders the
// pipeline as one connected node graph (pill + connector, left to right)
// rather than a grid of disconnected mini progress bars, so the whole
// batch reads as a single journey moving through the LangGraph state
// machine -- matching HACKATHON_STATEMENT.md §6's "show the state machine
// progressing node-by-node" demo narrative. A node is "active" the moment
// any row in the batch is on it; "done" only once every row has cleared
// it, so the rail's own progress mirrors real aggregate state, never a
// timer. Per apple-design-skill motion.md: motion here is driven only by
// genuine SSE-derived state transitions (width/scale/color changes on the
// existing CSS transition), no continuous decorative animation.
interface AggregateFlowRailProps {
  rows: Map<string, RowProgress>;
}

const NODE_LABELS: Record<string, string> = {
  FilterPlaceholders: "Filter",
  ClasspathResolver: "Classify",
  ManufacturerBrandNormalizer: "Brand",
  AttributeExtractor: "Extract",
  LOVValidator: "Validate",
  UOMNormalizer: "Units",
  AttributeAuditor: "Audit",
  ClearRetryIdsForDescriptionPhase: "—",
  DescriptionBuilder: "Describe",
  DescriptionAuditor: "Review",
};

const VISIBLE_NODES = PIPELINE_NODES.filter((n) => n !== "ClearRetryIdsForDescriptionPhase");

type StageState = "pending" | "active" | "done";

export function AggregateFlowRail({ rows }: AggregateFlowRailProps) {
  const total = rows.size;

  const stages = useMemo(() => {
    return VISIBLE_NODES.map((node) => {
      let completed = 0;
      let active = 0;
      for (const row of rows.values()) {
        const status = row.nodeStatuses[node] ?? "pending";
        if (status === "completed") completed++;
        else if (status === "active") active++;
      }
      const state: StageState = completed === total && total > 0 ? "done" : active > 0 || completed > 0 ? "active" : "pending";
      return { node, completed, active, state };
    });
  }, [rows, total]);

  if (total === 0) return null;

  return (
    <div className="bg-card rounded-xl p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-sm font-medium">Pipeline</span>
        <span className="text-muted-foreground text-xs">{total} row{total === 1 ? "" : "s"} moving through</span>
      </div>

      <div className="flex items-start overflow-x-auto pb-1">
        {stages.map((stage, i) => (
          <div key={stage.node} className="flex items-start">
            <div className="flex w-[92px] shrink-0 flex-col items-center gap-2 text-center">
              <span
                className={cn(
                  "relative flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300 motion-reduce:transition-none",
                  stage.state === "done" && "bg-marker-green/15 border-marker-green text-marker-green",
                  stage.state === "active" && "bg-primary/10 border-primary text-primary motion-safe:animate-pulse-ring",
                  stage.state === "pending" && "bg-muted border-border text-muted-foreground"
                )}
              >
                {stage.state === "done" && <Check className="size-4" />}
                {stage.state === "active" && <LoaderCircle className="size-4 motion-safe:animate-spin" />}
                {stage.state === "pending" && <span className="size-1.5 rounded-full bg-current" />}
              </span>
              <div className="space-y-0.5">
                <div className="text-foreground text-xs font-medium">{NODE_LABELS[stage.node]}</div>
                <div className="text-muted-foreground text-[11px] tabular-nums">{stage.completed}/{total}</div>
              </div>
            </div>
            {i < stages.length - 1 && (
              <div className="relative mt-4 h-0.5 w-6 shrink-0 overflow-hidden bg-border">
                <div
                  className="bg-marker-green absolute inset-0 origin-left transition-transform duration-300 ease-out motion-reduce:transition-none"
                  style={{ transform: `scaleX(${stage.completed / total})` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
