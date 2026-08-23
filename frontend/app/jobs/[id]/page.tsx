"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { Download, LineChart } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AggregateFlowRail } from "@/components/aggregate-flow-rail";
import { JobProgressCard } from "@/components/job-progress-card";
import { JobReviewTable } from "@/components/job-review-table";
import { PageHeader } from "@/components/page-header";
import { API_URL } from "@/lib/api";
import { useApiToken, useAuthedUrl } from "@/lib/auth";
import { useJob, useJobRows } from "@/lib/jobs";
import { useJobStream } from "@/lib/use-job-stream";

// State-driven per knowledge-base/LAYOUT.md §1: this one route serves
// both the running view (Goal 13, this implementation) and the review
// view (Goal 14, not yet built) based on job status.
export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: job, refetch } = useJob(params.id, { refetchInterval: 2000 });
  const apiToken = useApiToken();
  const { rows, isComplete, isFailed, isConnected } = useJobStream(params.id, apiToken);
  const { data: jobRows, isLoading: jobRowsLoading } = useJobRows(
    job?.status === "completed" ? params.id : null
  );
  const exportUrl = useAuthedUrl(`${API_URL}/jobs/${params.id}/export`);

  // Once the SSE stream reports completion, do one final poll so
  // job.status reflects "completed" (the DB write and the job_completed
  // SSE event are emitted in that order by jobs/scheduler.py, so this
  // is never racing ahead of the real state).
  useEffect(() => {
    if (isComplete) refetch();
  }, [isComplete, refetch]);

  const rowList = Array.from(rows.values());
  const completedCount = rowList.filter((r) => r.completed).length;

  if (isFailed || job?.status === "failed") {
    return (
      <Alert variant="destructive">
        <AlertTitle>Job failed</AlertTitle>
        <AlertDescription>This enrichment run did not complete successfully.</AlertDescription>
      </Alert>
    );
  }

  if (job?.status === "completed") {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Batch of ${job.rowCount} row${job.rowCount === 1 ? "" : "s"}`}
          subtitle={
            <>
              Enrichment complete. <span className="text-muted-foreground/70 font-mono text-xs">{params.id}</span>
            </>
          }
          action={
            <div className="flex gap-2">
              <Button variant="outline" nativeButton={false} render={<a href={exportUrl} />}>
                <Download />
                Export CSV
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link href={`/jobs/${params.id}/evaluation`} />}>
                <LineChart />
                Evaluation
              </Button>
            </div>
          }
        />
        <JobReviewTable jobId={params.id} records={jobRows ?? []} isLoading={jobRowsLoading} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Enriching ${job?.rowCount ?? rowList.length} row${(job?.rowCount ?? rowList.length) === 1 ? "" : "s"}`}
        subtitle={
          !isConnected && rowList.length === 0 ? (
            "Connecting…"
          ) : (
            <>
              {completedCount} of {job?.rowCount ?? rowList.length} done.{" "}
              <span className="text-muted-foreground/70 font-mono text-xs">{params.id}</span>
            </>
          )
        }
      />

      <AggregateFlowRail rows={rows} />

      {rowList.length > 0 && (
        <div className="space-y-2">
          <span className="text-muted-foreground text-sm font-medium">Rows in this batch</span>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {rowList.map((row, i) => (
              <JobProgressCard key={row.rowId} row={row} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
