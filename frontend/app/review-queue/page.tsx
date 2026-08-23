"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { ConfidenceMarker } from "@/components/confidence-marker";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { useReviewQueue, type ReviewQueueEntry } from "@/lib/review-queue";

// Cross-job triage queue (knowledge-base/LAYOUT.md §3: 'Table, grouped/
// sortable by job and marker -- this is a worklist'). Each row is one
// flagged field, not one raw row -- a row click deep-links to the record
// detail so the reviewer sees the full field-rule trace immediately.
// fieldName arrives as the backend's internal snake_case key; the
// protected description-format names (HACKATHON_STATEMENT.md §2) are the
// terms a reviewer actually recognizes, so map to those where known and
// fall back to the raw key for attribute fields, which have no fixed set.
const FIELD_DISPLAY_NAMES: Record<string, string> = {
  invoice_desc: "Invoice description",
  mobile_desc: "Mobile description",
  short_desc: "Short description",
  title_desc: "Title description",
  long_desc: "Long description",
  marketing_desc: "Marketing description",
};

const columns: ColumnDef<ReviewQueueEntry, unknown>[] = [
  {
    id: "marker",
    header: "",
    cell: ({ row }) => <ConfidenceMarker level={row.original.marker} />,
  },
  {
    accessorKey: "rowId",
    header: "Row",
    cell: ({ getValue, row }) => (
      <div>
        <div className="font-mono text-xs">{getValue<string>()}</div>
        <div className="text-muted-foreground/60 font-mono text-[11px]">batch {row.original.jobId.slice(0, 8)}</div>
      </div>
    ),
  },
  {
    accessorKey: "fieldName",
    header: "Field",
    cell: ({ getValue }) => {
      const name = getValue<string>();
      return <span>{FIELD_DISPLAY_NAMES[name] ?? name}</span>;
    },
  },
  {
    accessorKey: "value",
    header: "Generated value",
    cell: ({ getValue }) => <span className="text-muted-foreground truncate">{getValue<string>()}</span>,
  },
  {
    id: "action",
    header: "",
    cell: ({ row }) => (
      <Button
        size="sm"
        variant="ghost"
        nativeButton={false}
        render={<Link href={`/jobs/${row.original.jobId}/rows/${row.original.rowId}`} />}
      >
        See why →
      </Button>
    ),
  },
];

export default function ReviewQueuePage() {
  const { data: entries, isLoading } = useReviewQueue();

  return (
    <div className="space-y-6">
      <PageHeader title="Review Queue" subtitle="Fields that need a second look, worst first." />
      <DataTable
        columns={columns}
        data={entries ?? []}
        isLoading={isLoading}
        emptyMessage="Nothing to review — every completed job scored all-green."
      />
    </div>
  );
}
