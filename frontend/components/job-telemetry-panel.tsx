"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { PIPELINE_NODES, type RowProgress, type StreamLogEntry } from "@/lib/use-job-stream";

// Live telemetry strip for the running-job view, per the Stitch "Live
// Pipeline with Telemetry" reference: an overall-progress bar, two stat
// cards, and a scrolling event log. Every number here is derived from
// real SSE state (rows/log/anomalyCount, all already tracked by
// useJobStream) -- no fabricated latency/throughput/token figures the
// backend doesn't emit, which is why those Stitch panels aren't
// reproduced here.
interface JobTelemetryPanelProps {
  rows: Map<string, RowProgress>;
  log: StreamLogEntry[];
  anomalyCount: number;
  totalRowCount: number;
}

const TONE_DOT: Record<StreamLogEntry["tone"], string> = {
  neutral: "bg-muted-foreground/50",
  amber: "bg-marker-amber",
  red: "bg-marker-red",
};

const TONE_TEXT: Record<StreamLogEntry["tone"], string> = {
  neutral: "text-muted-foreground",
  amber: "text-marker-amber",
  red: "text-marker-red",
};

export function JobTelemetryPanel({ rows, log, anomalyCount, totalRowCount }: JobTelemetryPanelProps) {
  const { pctDone, completedRows } = useMemo(() => {
    const totalSteps = totalRowCount * PIPELINE_NODES.length;
    if (totalSteps === 0) return { pctDone: 0, completedRows: 0 };
    let stepsDone = 0;
    let completedRows = 0;
    for (const row of rows.values()) {
      if (row.completed) completedRows++;
      for (const status of Object.values(row.nodeStatuses)) {
        if (status === "completed") stepsDone++;
      }
    }
    return { pctDone: Math.round((stepsDone / totalSteps) * 100), completedRows };
  }, [rows, totalRowCount]);

  return (
    <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-[2fr_1fr_1fr]">
      <div className="bg-card rounded-xl p-5 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm font-medium">Overall Pipeline Progress</span>
          <span className="text-primary text-xl font-semibold tabular-nums">{pctDone}%</span>
        </div>
        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full shadow-[0_0_8px_var(--marker-green)] transition-all duration-300"
            style={{ width: `${pctDone}%` }}
          />
        </div>
      </div>

      <div className="bg-card rounded-xl p-5 shadow-sm">
        <p className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">Rows Processed</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{completedRows}</p>
      </div>

      <div className="bg-card rounded-xl p-5 shadow-sm">
        <p className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">Active Anomalies</p>
        <p className={cn("mt-1 text-2xl font-semibold tabular-nums", anomalyCount > 0 ? "text-marker-amber" : "text-foreground")}>
          {anomalyCount}
        </p>
      </div>

      <div className="bg-card @2xl:col-span-3 rounded-xl p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">Live Event Stream</span>
          <span className="relative flex size-2">
            <span className="bg-primary motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" />
            <span className="bg-primary relative inline-flex size-2 rounded-full" />
          </span>
        </div>
        <ul className="max-h-48 space-y-1.5 overflow-y-auto font-mono text-xs">
          {log.length === 0 && <li className="text-muted-foreground">Waiting for events…</li>}
          {log.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2">
              <span className={cn("mt-1 size-1.5 shrink-0 rounded-full", TONE_DOT[entry.tone])} />
              <span className="text-muted-foreground/70 shrink-0">{entry.time}</span>
              <span className={TONE_TEXT[entry.tone]}>{entry.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
