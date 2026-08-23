"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, ApiError } from "@/lib/api";
import { useApiToken, useAuthReady } from "@/lib/auth";

// Mirrors backend/app/api/jobs.py's JobSummary/JobDetail.
export interface MarkerDistribution {
  green: number;
  amber: number;
  red: number;
}

export interface JobSummary {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  rowCount: number;
  createdAt: string;
  markerDistribution: MarkerDistribution | null;
}

export interface JobDetail {
  id: string;
  status: JobSummary["status"];
  rowCount: number;
  batchSize: number;
  concurrencyWindow: number;
}

interface RawJobSummary {
  id: string;
  status: JobSummary["status"];
  row_count: number;
  created_at: string;
  marker_distribution: MarkerDistribution | null;
}

interface RawJobDetail extends RawJobSummary {
  batch_size: number;
  concurrency_window: number;
}

function toJobSummary(raw: RawJobSummary): JobSummary {
  return {
    id: raw.id,
    status: raw.status,
    rowCount: raw.row_count,
    createdAt: raw.created_at,
    markerDistribution: raw.marker_distribution,
  };
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  const token = useApiToken();

  return useMutation({
    mutationFn: async (mfgPartNums: string[]) => {
      const raw = await apiFetch<RawJobSummary>(
        "/jobs",
        {
          method: "POST",
          body: JSON.stringify({ mfg_part_nums: mfgPartNums }),
        },
        token
      );
      return toJobSummary(raw);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useJob(jobId: string | null, options?: { refetchInterval?: number | false }) {
  const token = useApiToken();
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ["jobs", jobId],
    queryFn: async () => {
      const raw = await apiFetch<RawJobDetail>(`/jobs/${jobId}`, undefined, token);
      const job: JobDetail = {
        id: raw.id,
        status: raw.status,
        rowCount: raw.row_count,
        batchSize: raw.batch_size,
        concurrencyWindow: raw.concurrency_window,
      };
      return job;
    },
    enabled: jobId !== null && authReady,
    refetchInterval: options?.refetchInterval,
  });
}

export function useJobs(options?: { refetchInterval?: number | false }) {
  const token = useApiToken();
  const authReady = useAuthReady();
  return useQuery({
    // authReady in the key (not just `enabled`) so the not-ready -> ready
    // transition is a genuinely new query, not a resumed one -- sidesteps
    // any edge case where a query first observed as enabled:false doesn't
    // reliably kick off a fetch the moment enabled flips true.
    queryKey: ["jobs", authReady],
    queryFn: async () => {
      const raw = await apiFetch<RawJobSummary[]>("/jobs", undefined, token);
      return raw.map(toJobSummary);
    },
    enabled: authReady,
    refetchInterval: options?.refetchInterval,
  });
}

// Mirrors backend/app/pipeline/state.py's RuleCheckState and
// backend/app/pipeline/nodes/record_assembler.py's AssembledRecord --
// snake_case on the wire (pydantic default), camelCase once through
// apiFetch, per the same convention as JobSummary/JobDetail above.
export interface RuleCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface AssembledAttribute {
  label: string;
  value: string;
  uom: string | null;
  marker: "green" | "amber" | "red" | null;
  ruleChecks: RuleCheck[];
}

export interface AssembledDescription {
  text: string;
  charCount: number;
  marker: "green" | "amber" | "red" | null;
  ruleChecks: RuleCheck[];
}

export interface AssembledRecord {
  mfgPartNum: string;
  partDesc: string;
  e1Brand: string | null;
  unilogBrand: string | null;
  dibBrand: string | null;
  partManuf: string | null;
  classpath: string | null;
  manufacturerName: string | null;
  brandName: string | null;
  descriptions: Record<string, AssembledDescription>;
  attributes: AssembledAttribute[];
  flags: string[];
}

interface RawRuleCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

interface RawAssembledAttribute {
  label: string;
  value: string;
  uom: string | null;
  marker: "green" | "amber" | "red" | null;
  rule_checks: RawRuleCheck[];
}

interface RawAssembledDescription {
  text: string;
  char_count: number;
  marker: "green" | "amber" | "red" | null;
  rule_checks: RawRuleCheck[];
}

interface RawAssembledRecord {
  mfg_part_num: string;
  part_desc: string;
  e1_brand: string | null;
  unilog_brand: string | null;
  dib_brand: string | null;
  part_manuf: string | null;
  classpath: string | null;
  manufacturer_name: string | null;
  brand_name: string | null;
  descriptions: Record<string, RawAssembledDescription>;
  attributes: RawAssembledAttribute[];
  flags: string[];
}

function toAssembledRecord(raw: RawAssembledRecord): AssembledRecord {
  return {
    mfgPartNum: raw.mfg_part_num,
    partDesc: raw.part_desc,
    e1Brand: raw.e1_brand,
    unilogBrand: raw.unilog_brand,
    dibBrand: raw.dib_brand,
    partManuf: raw.part_manuf,
    classpath: raw.classpath,
    manufacturerName: raw.manufacturer_name,
    brandName: raw.brand_name,
    descriptions: Object.fromEntries(
      Object.entries(raw.descriptions).map(([name, d]) => [
        name,
        { text: d.text, charCount: d.char_count, marker: d.marker, ruleChecks: d.rule_checks },
      ])
    ),
    attributes: raw.attributes.map((a) => ({
      label: a.label,
      value: a.value,
      uom: a.uom,
      marker: a.marker,
      ruleChecks: a.rule_checks,
    })),
    flags: raw.flags,
  };
}

export function useJobRows(jobId: string | null) {
  const token = useApiToken();
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ["jobs", jobId, "rows"],
    queryFn: async () => {
      const raw = await apiFetch<RawAssembledRecord[]>(`/jobs/${jobId}/rows`, undefined, token);
      return raw.map(toAssembledRecord);
    },
    enabled: jobId !== null && authReady,
  });
}

export function useJobRow(jobId: string | null, rowId: string | null) {
  const token = useApiToken();
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ["jobs", jobId, "rows", rowId],
    queryFn: async () => {
      const raw = await apiFetch<RawAssembledRecord>(`/jobs/${jobId}/rows/${rowId}`, undefined, token);
      return toAssembledRecord(raw);
    },
    enabled: jobId !== null && rowId !== null && authReady,
  });
}

export interface LatestEnrichedRow {
  jobId: string;
  jobCreatedAt: string;
  record: AssembledRecord;
}

// Backs J6 (knowledge-base/USER_JOURNEYS.md) -- "before/after" comparison
// for a single item. No new backend endpoint per USER_JOURNEYS.md §3
// ("no journey requires... a new pipeline node" / composition over
// existing reads only): scans jobs newest-first and asks each one
// directly for this row_id, since GET /jobs/{id}/rows/{row_id} 404s
// cleanly for a job that never processed it -- stops at the first hit,
// so a row enriched early on doesn't pay for scanning every job ever run.
export function useLatestEnrichedRow(mfgPartNum: string | null) {
  const token = useApiToken();
  const authReady = useAuthReady();
  const { data: jobs, isLoading: jobsLoading } = useJobs();

  return useQuery({
    queryKey: ["rows", mfgPartNum, "latest-enriched", jobs?.map((j) => j.id)],
    queryFn: async (): Promise<LatestEnrichedRow | null> => {
      const candidates = (jobs ?? []).filter((j) => j.status === "completed");
      for (const job of candidates) {
        try {
          const raw = await apiFetch<RawAssembledRecord>(`/jobs/${job.id}/rows/${mfgPartNum}`, undefined, token);
          return { jobId: job.id, jobCreatedAt: job.createdAt, record: toAssembledRecord(raw) };
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) continue;
          throw err;
        }
      }
      return null;
    },
    enabled: mfgPartNum !== null && authReady && !jobsLoading && jobs !== undefined,
  });
}
