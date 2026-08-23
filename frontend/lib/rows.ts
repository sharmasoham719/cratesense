"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { useApiToken, useAuthReady } from "@/lib/auth";

// Mirrors backend/app/api/rows.py's RowSummary/RowListResponse.
export interface RowSummary {
  mfgPartNum: string;
  partDesc: string;
  e1Brand: string | null;
  unilogBrand: string | null;
  dibBrand: string | null;
  partManuf: string | null;
}

interface RawRowSummary {
  mfg_part_num: string;
  part_desc: string;
  e1_brand: string | null;
  unilog_brand: string | null;
  dib_brand: string | null;
  part_manuf: string | null;
}

interface RawRowListResponse {
  rows: RawRowSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface RowListResult {
  rows: RowSummary[];
  total: number;
  limit: number;
  offset: number;
}

function toRowSummary(raw: RawRowSummary): RowSummary {
  return {
    mfgPartNum: raw.mfg_part_num,
    partDesc: raw.part_desc,
    e1Brand: raw.e1_brand,
    unilogBrand: raw.unilog_brand,
    dibBrand: raw.dib_brand,
    partManuf: raw.part_manuf,
  };
}

export function useRow(mfgPartNum: string) {
  const token = useApiToken();
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ["rows", mfgPartNum],
    queryFn: async () => {
      const raw = await apiFetch<RawRowSummary>(`/rows/${encodeURIComponent(mfgPartNum)}`, undefined, token);
      return toRowSummary(raw);
    },
    enabled: authReady,
  });
}

export function useRows(params: { search?: string; limit: number; offset: number }) {
  const token = useApiToken();
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ["rows", params],
    queryFn: async () => {
      const query = new URLSearchParams({
        limit: String(params.limit),
        offset: String(params.offset),
      });
      if (params.search) query.set("search", params.search);

      const raw = await apiFetch<RawRowListResponse>(`/rows?${query.toString()}`, undefined, token);
      const result: RowListResult = {
        rows: raw.rows.map(toRowSummary),
        total: raw.total,
        limit: raw.limit,
        offset: raw.offset,
      };
      return result;
    },
    placeholderData: (prev) => prev,
    enabled: authReady,
  });
}
