"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { MarkerDistributionBar } from "@/components/marker-distribution-bar";
import { useJobs, type JobSummary } from "@/lib/jobs";

// Job history table (knowledge-base/LAYOUT.md §3) -- shared by `/` (job
// history landing, per LAYOUT.md §1's "Dashboard / job history landing")
// and `/jobs`, since the spec describes them as the same content.
const STATUS_VARIANT: Record<JobSummary["status"], "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  running: "outline",
  completed: "default",
  failed: "destructive",
};

const columns: ColumnDef<JobSummary, unknown>[] = [
  {
    accessorKey: "rowCount",
    header: "Batch",
    cell: ({ getValue, row }) => {
      const count = getValue<number>();
      return (
        <div>
          <div className="font-medium">{count} row{count === 1 ? "" : "s"}</div>
          <div className="text-muted-foreground/70 font-mono text-[11px]">{row.original.id.slice(0, 8)}</div>
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ getValue }) => {
      const value = getValue<string>();
      return <span className="text-muted-foreground text-sm">{new Date(value).toLocaleString()}</span>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const status = getValue<JobSummary["status"]>();
      return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
    },
  },
  {
    id: "markerDistribution",
    header: "Quality",
    cell: ({ row }) => {
      const dist = row.original.markerDistribution;
      if (!dist) return <span className="text-muted-foreground text-xs">—</span>;
      return <MarkerDistributionBar {...dist} total={dist.green + dist.amber + dist.red} />;
    },
  },
];

export function JobHistoryTable() {
  const { data: jobs, isLoading } = useJobs();
  const router = useRouter();

  return (
    <DataTable
      columns={columns}
      data={jobs ?? []}
      isLoading={isLoading}
      emptyMessage="No jobs yet — run your first enrichment from the Rows browser."
      onRowClick={(job) => router.push(`/jobs/${job.id}`)}
    />
  );
}
