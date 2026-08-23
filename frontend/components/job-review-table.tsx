"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { RowDetailDrawer } from "@/components/row-detail-drawer";
import { overallMarker, reviewColumns } from "@/app/jobs/[id]/review-columns";
import type { MarkerLevel } from "@/components/confidence-marker";
import type { AssembledRecord } from "@/lib/jobs";

// Review-mode results table per the Stitch "Batch Results Review"
// reference: segmented filter toggle above a DataTable, row click opens
// a right-side field-audit drawer in place (no page navigation) so a
// reviewer can move through many rows without losing table scroll
// position or the active filter.
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
  const [activeRecord, setActiveRecord] = useState<AssembledRecord | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return records;
    return records.filter((r) => overallMarker(r) === filter);
  }, [records, filter]);

  return (
    <div className="space-y-4">
      <div className="bg-muted inline-flex items-center gap-1 rounded-md border p-1">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "ghost"}
            className="h-7"
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
        onRowClick={(record) => setActiveRecord(record)}
      />
      <RowDetailDrawer
        record={activeRecord}
        open={activeRecord !== null}
        onOpenChange={(open) => {
          if (!open) setActiveRecord(null);
        }}
      />
    </div>
  );
}
