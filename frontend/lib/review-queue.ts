"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { useApiToken, useAuthReady } from "@/lib/auth";
import type { MarkerLevel } from "@/components/confidence-marker";

// Mirrors backend/app/api/review_queue.py's ReviewQueueEntry.
export interface ReviewQueueEntry {
  jobId: string;
  rowId: string;
  fieldType: "attribute" | "description";
  fieldName: string;
  value: string;
  marker: MarkerLevel;
}

interface RawReviewQueueEntry {
  job_id: string;
  row_id: string;
  field_type: "attribute" | "description";
  field_name: string;
  value: string;
  marker: MarkerLevel;
}

export function useReviewQueue() {
  const token = useApiToken();
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ["review-queue"],
    queryFn: async () => {
      const raw = await apiFetch<RawReviewQueueEntry[]>("/review-queue", undefined, token);
      return raw.map(
        (e): ReviewQueueEntry => ({
          jobId: e.job_id,
          rowId: e.row_id,
          fieldType: e.field_type,
          fieldName: e.field_name,
          value: e.value,
          marker: e.marker,
        })
      );
    },
    enabled: authReady,
  });
}
