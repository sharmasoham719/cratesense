"use client";

import { useEffect, useRef, useState } from "react";

import { API_URL } from "@/lib/api";

// Mirrors backend/app/jobs/events.py's JobEvent.to_dict() shape, per
// knowledge-base/APPLICATION_ARCHITECTURE.md §3.
export interface JobStreamEvent {
  event: "batch_started" | "node_transition" | "row_completed" | "batch_completed" | "job_completed" | "job_failed" | "batch_failed";
  batch_id?: string;
  row_id?: string;
  node?: string;
  status?: string;
  marker?: string;
  error?: string;
}

export type NodeStatus = "pending" | "active" | "completed";

export interface RowProgress {
  rowId: string;
  nodeStatuses: Record<string, NodeStatus>;
  completed: boolean;
}

// The exact 10-node sequence per knowledge-base/BACKEND_COGNITIVE_FLOW.md §2.
export const PIPELINE_NODES = [
  "FilterPlaceholders",
  "ClasspathResolver",
  "ManufacturerBrandNormalizer",
  "AttributeExtractor",
  "LOVValidator",
  "UOMNormalizer",
  "AttributeAuditor",
  "ClearRetryIdsForDescriptionPhase",
  "DescriptionBuilder",
  "DescriptionAuditor",
] as const;

function emptyNodeStatuses(): Record<string, NodeStatus> {
  return Object.fromEntries(PIPELINE_NODES.map((n) => [n, "pending" as NodeStatus]));
}

export interface StreamLogEntry {
  id: number;
  time: string;
  message: string;
  tone: "neutral" | "amber" | "red";
}

const MAX_LOG_ENTRIES = 30;

function describeEvent(data: JobStreamEvent): { message: string; tone: StreamLogEntry["tone"] } | null {
  switch (data.event) {
    case "batch_started":
      return { message: `Batch ${data.batch_id ?? ""} started.`, tone: "neutral" };
    case "node_transition":
      if (data.status === "entered" || data.status === "retrying") {
        return {
          message: `${data.row_id} entered ${data.node}${data.status === "retrying" ? " (retrying)" : ""}.`,
          tone: data.status === "retrying" ? "amber" : "neutral",
        };
      }
      return null;
    case "row_completed":
      return {
        message: `${data.row_id} completed${data.marker ? ` — ${data.marker}` : ""}.`,
        tone: data.marker === "red" ? "red" : data.marker === "amber" ? "amber" : "neutral",
      };
    case "batch_completed":
      return { message: `Batch ${data.batch_id ?? ""} completed.`, tone: "neutral" };
    case "batch_failed":
      return { message: `Batch ${data.batch_id ?? ""} failed${data.error ? `: ${data.error}` : ""}.`, tone: "red" };
    default:
      return null;
  }
}

interface UseJobStreamResult {
  rows: Map<string, RowProgress>;
  isComplete: boolean;
  isFailed: boolean;
  isConnected: boolean;
  log: StreamLogEntry[];
  anomalyCount: number;
}

// SsePipelineFeed per knowledge-base/UI_COMPONENT_LIBRARY.md §3: wraps
// EventSource, parses the event shape from
// knowledge-base/APPLICATION_ARCHITECTURE.md §3, exposes reactive
// per-row/per-node state. Handles reconnect-on-drop per
// knowledge-base/FRONTEND_DESIGN_SYSTEM.md §7 (EventSource does this
// natively -- browsers auto-reconnect on a dropped connection).
export function useJobStream(jobId: string | null, idToken?: string): UseJobStreamResult {
  const [rows, setRows] = useState<Map<string, RowProgress>>(new Map());
  const [isComplete, setIsComplete] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [log, setLog] = useState<StreamLogEntry[]>([]);
  const [anomalyCount, setAnomalyCount] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);
  const logIdRef = useRef(0);

  useEffect(() => {
    if (!jobId) return;

    setRows(new Map());
    setIsComplete(false);
    setIsFailed(false);
    setLog([]);
    setAnomalyCount(0);
    logIdRef.current = 0;

    // EventSource can't set custom headers, so a real (non-DEV_OVERRIDE)
    // session's token is forwarded as a query param instead
    // (knowledge-base/AUTH_AND_SECURITY.md §3). idToken is sourced from
    // useApiToken() (useSession()-backed) by the caller -- not fetched
    // here via next-auth/react's standalone getSession(), which hangs in
    // any deployed environment (see the comment in lib/api.ts's apiFetch).
    const url = idToken
      ? `${API_URL}/jobs/${jobId}/stream?token=${encodeURIComponent(idToken)}`
      : `${API_URL}/jobs/${jobId}/stream`;
    const source = new EventSource(url);
    sourceRef.current = source;
    source.onopen = () => setIsConnected(true);
    source.onerror = () => setIsConnected(false);
    source.onmessage = handleMessage;

    function handleMessage(e: MessageEvent) {
      const data: JobStreamEvent = JSON.parse(e.data);

      const described = describeEvent(data);
      if (described) {
        logIdRef.current += 1;
        const entry: StreamLogEntry = {
          id: logIdRef.current,
          time: new Date().toLocaleTimeString([], { hour12: false }),
          message: described.message,
          tone: described.tone,
        };
        setLog((prev) => [entry, ...prev].slice(0, MAX_LOG_ENTRIES));
        if (data.event === "row_completed" && (data.marker === "amber" || data.marker === "red")) {
          setAnomalyCount((n) => n + 1);
        }
      }

      if (data.event === "job_completed") {
        setIsComplete(true);
        source.close();
        return;
      }
      if (data.event === "job_failed") {
        setIsFailed(true);
        source.close();
        return;
      }
      if (!data.row_id) return;

      setRows((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.row_id!) ?? {
          rowId: data.row_id!,
          nodeStatuses: emptyNodeStatuses(),
          completed: false,
        };

        if (data.event === "node_transition" && data.node) {
          const nextStatus: NodeStatus = data.status === "entered" || data.status === "retrying" ? "active" : "completed";
          existing.nodeStatuses = { ...existing.nodeStatuses, [data.node]: nextStatus };
        } else if (data.event === "row_completed") {
          existing.completed = true;
        }

        next.set(data.row_id!, { ...existing });
        return next;
      });
    }

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [jobId, idToken]);

  return { rows, isComplete, isFailed, isConnected, log, anomalyCount };
}
