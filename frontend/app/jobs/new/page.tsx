"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { useCreateJob } from "@/lib/jobs";

// Run configuration per knowledge-base/LAYOUT.md §3: single-column,
// vertically stacked form -- a linear, few-field configuration task,
// not a grid. Row selection is handed off from /rows or /rows/[id] via
// sessionStorage (no backend "draft job" concept exists, so this is
// purely a client-side handoff between routes).
export default function NewJobPage() {
  const router = useRouter();
  const [rowIds, setRowIds] = useState<string[]>([]);
  const createJob = useCreateJob();

  useEffect(() => {
    const raw = sessionStorage.getItem("cratesense:pendingRowIds");
    if (raw) {
      try {
        setRowIds(JSON.parse(raw));
      } catch {
        setRowIds([]);
      }
    }
  }, []);

  const handleSubmit = async () => {
    try {
      const job = await createJob.mutateAsync(rowIds);
      sessionStorage.removeItem("cratesense:pendingRowIds");
      toast.success(`Job started — enriching ${rowIds.length} row${rowIds.length === 1 ? "" : "s"}`);
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start job");
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <PageHeader title="Run configuration" subtitle="Confirm the rows to enrich." />

      {rowIds.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl bg-muted/40 px-6 py-14 text-center">
          <ListChecks className="text-muted-foreground size-8" />
          <div className="space-y-1">
            <p className="text-sm font-medium">No rows selected yet</p>
            <p className="text-muted-foreground text-sm">Pick the rows you want enriched, then come back here to start the run.</p>
          </div>
          <Button nativeButton={false} render={<Link href="/rows" />}>Browse rows</Button>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selected rows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <>
              <p className="text-sm">
                {rowIds.length} row{rowIds.length === 1 ? "" : "s"} will be enriched using the pipeline's
                default batch size and concurrency window.
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-xs">
                {rowIds.map((id) => (
                  <li key={id} className="text-muted-foreground">
                    {id}
                  </li>
                ))}
              </ul>
            </>

            {createJob.isError && (
              <Alert variant="destructive">
                <AlertTitle>Failed to start job</AlertTitle>
                <AlertDescription>{createJob.error.message}</AlertDescription>
              </Alert>
            )}

            <Button onClick={handleSubmit} disabled={createJob.isPending} className="w-full">
              {createJob.isPending ? "Starting…" : "Run enrichment"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
