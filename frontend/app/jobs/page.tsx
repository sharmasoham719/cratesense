"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { JobHistoryTable } from "@/components/job-history-table";
import { PageHeader } from "@/components/page-header";

// Job history (knowledge-base/LAYOUT.md §3): standard list-table pattern
// -- job name/timestamp, row count, status, marker distribution.
export default function JobsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        subtitle="Every enrichment run, most recent first."
        action={
          <Button nativeButton={false} render={<Link href="/rows" />}>
            Run enrichment
          </Button>
        }
      />
      <JobHistoryTable />
    </div>
  );
}
