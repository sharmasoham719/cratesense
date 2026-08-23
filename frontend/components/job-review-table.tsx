"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { overallMarker, reviewColumns } from "@/app/jobs/[id]/review-columns";
import type { MarkerLevel } from "@/components/confidence-marker";
import type { AssembledRecord } from "@/lib/jobs";

// Review-mode results table per knowledge-base/LAYOUT.md §3: marker
// filter chips above a DataTable, consistent with the Rows browser's
// filter-bar-above-table pattern. Row click navigates (not a modal) to
// the deep-linkable record detail per journey J2/J6.
interface JobReviewTableProps {
  jobId: string;
  records: AssembledRecord[];
  isLoading?: boolean;
}

const FILTERS: { label: string; value: MarkerLevel | "all" }[] = [
  { label: "All", value: "all" },
  { label: "🟢 Green", value: "green" },
  { label: "🟡 Amber", value: "amber" },
  { label: "🔴 Red", value: "red" },
];

export function JobReviewTable({ jobId, records, isLoading }: JobReviewTableProps) {
  const [filter, setFilter] = useState<MarkerLevel | "all">("all");
  const router = useRouter();

  const filtered = useMemo(() => {
    if (filter === "all") return records;
    return records.filter((r) => overallMarker(r) === filter);
  }, [records, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      <DataTable
        columns={reviewColumns}
        data={filtered}
        isLoading={isLoading}
        emptyMessage="No rows match this filter."
        onRowClick={(record) => router.push(`/jobs/${jobId}/rows/${record.mfgPartNum}`)}
      />
    </div>
  );
}
