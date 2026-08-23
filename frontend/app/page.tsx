"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Boxes, CircleCheck, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { JobHistoryTable } from "@/components/job-history-table";
import { MarkerDistributionChart } from "@/components/marker-distribution-chart";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { useJobs } from "@/lib/jobs";

// Dashboard / job history landing (knowledge-base/LAYOUT.md §1, §3): KPI
// row + aggregate marker chart + JobHistoryTable, all sourced from
// useJobs() via client-side aggregation -- no new backend endpoint.
export default function DashboardPage() {
  const { data: jobs, isLoading } = useJobs();

  const summary = useMemo(() => {
    if (!jobs) return null;
    const totalRows = jobs.reduce((sum, j) => sum + j.rowCount, 0);
    const distribution = jobs.reduce(
      (acc, j) => {
        if (j.markerDistribution) {
          acc.green += j.markerDistribution.green;
          acc.amber += j.markerDistribution.amber;
          acc.red += j.markerDistribution.red;
        }
        return acc;
      },
      { green: 0, amber: 0, red: 0 }
    );
    const totalScored = distribution.green + distribution.amber + distribution.red;
    const greenPct = totalScored > 0 ? Math.round((distribution.green / totalScored) * 100) : null;
    const mostRecent = jobs[0] ?? null;
    return { totalJobs: jobs.length, totalRows, distribution, greenPct, mostRecent };
  }, [jobs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Every enrichment run, most recent first."
        action={
          <Button nativeButton={false} render={<Link href="/rows" />}>
            Run enrichment
          </Button>
        }
      />

      {isLoading || !summary ? (
        <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @5xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @5xl:grid-cols-4">
          <StatTile label="Jobs run" value={summary.totalJobs.toLocaleString()} icon={ListChecks} />
          <StatTile label="Rows enriched" value={summary.totalRows.toLocaleString()} icon={Boxes} />
          <StatTile
            label="Green rate"
            value={summary.greenPct === null ? "—" : `${summary.greenPct}%`}
            tone={summary.greenPct === null ? "neutral" : summary.greenPct >= 80 ? "green" : summary.greenPct >= 50 ? "amber" : "red"}
            icon={CircleCheck}
          />
          <StatTile
            label="Most recent"
            value={summary.mostRecent?.status ?? "—"}
            tone={
              summary.mostRecent?.status === "completed"
                ? "green"
                : summary.mostRecent?.status === "failed"
                  ? "red"
                  : "neutral"
            }
          />
        </div>
      )}

      {summary && summary.totalJobs > 0 && <MarkerDistributionChart distribution={summary.distribution} />}

      <JobHistoryTable />
    </div>
  );
}
