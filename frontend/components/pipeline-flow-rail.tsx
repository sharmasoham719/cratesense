"use client";

import { Check, Circle, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { PIPELINE_NODES, type NodeStatus } from "@/lib/use-job-stream";

// The app's signature element, per knowledge-base/FRONTEND_DESIGN_SYSTEM.md
// §6 and UI_COMPONENT_LIBRARY.md §3 -- a horizontal rail of the 10
// pipeline nodes whose connector segments fill-sweep exactly when a real
// nodeStatuses transition arrives (never a timer), and the active node
// gets a one-shot pulse-in. variant="compact" drops all motion for
// historical/table reuse.
interface PipelineFlowRailProps {
  nodeStatuses: Record<string, NodeStatus>;
  variant?: "default" | "compact";
  animated?: boolean;
}

const NODE_LABELS: Record<string, string> = {
  FilterPlaceholders: "Filter",
  ClasspathResolver: "Classify",
  ManufacturerBrandNormalizer: "Brand",
  AttributeExtractor: "Extract",
  LOVValidator: "Validate",
  UOMNormalizer: "Units",
  AttributeAuditor: "Audit attrs",
  ClearRetryIdsForDescriptionPhase: "—",
  DescriptionBuilder: "Describe",
  DescriptionAuditor: "Audit desc",
};

function StageIcon({ status, compact }: { status: NodeStatus; compact: boolean }) {
  const size = compact ? "size-2.5" : "size-3.5";
  if (status === "completed") return <Check className={cn(size, "text-marker-green")} />;
  if (status === "active") return <LoaderCircle className={cn(size, "text-primary animate-spin")} />;
  return <Circle className={cn(size, "text-muted-foreground")} />;
}

export function PipelineFlowRail({ nodeStatuses, variant = "default", animated = true }: PipelineFlowRailProps) {
  const compact = variant === "compact";
  const isAnimated = animated && !compact;
  const prevStatuses = useRef<Record<string, NodeStatus>>({});
  const [justActivated, setJustActivated] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAnimated) return;
    const freshlyActive = new Set<string>();
    for (const node of PIPELINE_NODES) {
      if (nodeStatuses[node] === "active" && prevStatuses.current[node] !== "active") {
        freshlyActive.add(node);
      }
    }
    if (freshlyActive.size > 0) {
      setJustActivated(freshlyActive);
      const timer = setTimeout(() => setJustActivated(new Set()), 200);
      return () => clearTimeout(timer);
    }
    prevStatuses.current = nodeStatuses;
  }, [nodeStatuses, isAnimated]);

  useEffect(() => {
    prevStatuses.current = nodeStatuses;
  }, [nodeStatuses]);

  return (
    <div
      className={cn("flex items-center", compact ? "gap-0.5" : "gap-1")}
      role="list"
      aria-label="Pipeline progress"
    >
      {PIPELINE_NODES.map((node, i) => {
        const status = nodeStatuses[node] ?? "pending";
        const pulsing = isAnimated && justActivated.has(node);
        return (
          <div key={node} className="flex items-center" role="listitem" aria-label={`${NODE_LABELS[node]}: ${status}`}>
            <span className={cn("relative flex items-center justify-center", pulsing && "motion-safe:animate-pulse-ring")}>
              <StageIcon status={status} compact={compact} />
            </span>
            {i < PIPELINE_NODES.length - 1 && (
              <div className={cn("relative overflow-hidden bg-border", compact ? "mx-0.5 h-px w-1.5" : "mx-0.5 h-px w-2")}>
                <div
                  className={cn(
                    "bg-marker-green absolute inset-0 origin-left",
                    isAnimated && "transition-transform duration-[220ms] ease-out motion-reduce:transition-none"
                  )}
                  style={{ transform: status === "completed" ? "scaleX(1)" : "scaleX(0)" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
