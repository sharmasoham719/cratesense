"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { useApiToken, useAuthReady } from "@/lib/auth";

// Mirrors backend/app/api/evaluation.py's EvaluationResponse.
export interface FieldAccuracyDetail {
  rowId: string;
  fieldName: string;
  expected: string;
  actual: string | null;
  matched: boolean;
}

export interface Evaluation {
  jobId: string;
  scoredRowCount: number;
  totalRowCount: number;
  fieldLevelAccuracy: number | null;
  charLimitCompliance: number | null;
  lovCompliance: number | null;
  fieldAccuracyDetails: FieldAccuracyDetail[];
  unscoredRowIds: string[];
}

interface RawFieldAccuracyDetail {
  row_id: string;
  field_name: string;
  expected: string;
  actual: string | null;
  matched: boolean;
}

interface RawEvaluation {
  job_id: string;
  scored_row_count: number;
  total_row_count: number;
  field_level_accuracy: number | null;
  char_limit_compliance: number | null;
  lov_compliance: number | null;
  field_accuracy_details: RawFieldAccuracyDetail[];
  unscored_row_ids: string[];
}

export function useEvaluation(jobId: string | null) {
  const token = useApiToken();
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ["evaluation", jobId],
    queryFn: async () => {
      const raw = await apiFetch<RawEvaluation>(`/evaluation/${jobId}`, undefined, token);
      const evaluation: Evaluation = {
        jobId: raw.job_id,
        scoredRowCount: raw.scored_row_count,
        totalRowCount: raw.total_row_count,
        fieldLevelAccuracy: raw.field_level_accuracy,
        charLimitCompliance: raw.char_limit_compliance,
        lovCompliance: raw.lov_compliance,
        fieldAccuracyDetails: raw.field_accuracy_details.map((d) => ({
          rowId: d.row_id,
          fieldName: d.field_name,
          expected: d.expected,
          actual: d.actual,
          matched: d.matched,
        })),
        unscoredRowIds: raw.unscored_row_ids,
      };
      return evaluation;
    },
    enabled: jobId !== null && authReady,
  });
}
