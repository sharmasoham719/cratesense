import { CheckCircle2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { PipelineFlowRail } from "@/components/pipeline-flow-rail";
import type { RowProgress } from "@/lib/use-job-stream";

// Composes PipelineFlowRail + row identifier into the grid-of-cards seen
// on the running-job view, per knowledge-base/UI_COMPONENT_LIBRARY.md §3.
// Rows joining the grid stagger their entrance per
// knowledge-base/FRONTEND_DESIGN_SYSTEM.md §6 -- CSS-only, keyed on
// index, no JS timers.
export function JobProgressCard({ row, index = 0 }: { row: RowProgress; index?: number }) {
  return (
    <Card
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 border-none bg-muted/40 p-4 shadow-none duration-300 fill-mode-backwards"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      <CardContent className="space-y-3 p-0">
        <div className="flex items-center justify-between">
          <span className="truncate font-mono text-xs">{row.rowId}</span>
          {row.completed && <CheckCircle2 className="text-marker-green size-4 shrink-0" />}
        </div>
        <PipelineFlowRail nodeStatuses={row.nodeStatuses} />
      </CardContent>
    </Card>
  );
}
