"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { useRows } from "@/lib/rows";
import { buildColumns } from "./columns";

const PAGE_SIZE = 50;

export default function RowsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useRows({ search, limit: PAGE_SIZE, offset });

  const toggle = (mfgPartNum: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(mfgPartNum)) next.delete(mfgPartNum);
      else next.add(mfgPartNum);
      return next;
    });
  };

  const allSelectedOnPage = (data?.rows.length ?? 0) > 0 && (data?.rows.every((r) => selected.has(r.mfgPartNum)) ?? false);

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const row of data?.rows ?? []) {
        if (checked) next.add(row.mfgPartNum);
        else next.delete(row.mfgPartNum);
      }
      return next;
    });
  };

  const columns = useMemo(
    () => buildColumns(selected, toggle, toggleAll, allSelectedOnPage),
    [selected, allSelectedOnPage, data?.rows]
  );

  const total = data?.total ?? 0;
  const hasNextPage = offset + PAGE_SIZE < total;
  const hasPrevPage = offset > 0;

  const handleRunEnrichment = () => {
    const ids = Array.from(selected);
    sessionStorage.setItem("cratesense:pendingRowIds", JSON.stringify(ids));
    router.push("/jobs/new");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Rows" subtitle={`Browse the Sample Dataset Input (${total.toLocaleString()} rows).`} />

      <FilterBar
        value={search}
        onChange={(v) => {
          setSearch(v);
          setOffset(0);
        }}
        placeholder="Search by description…"
      />

      {isError ? (
        <p className="text-destructive text-sm">Failed to load rows. Is the backend running?</p>
      ) : (
        <DataTable columns={columns} data={data?.rows ?? []} isLoading={isLoading} emptyMessage="No rows found." />
      )}

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">
          {total > 0 ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}` : ""}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!hasPrevPage} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={!hasNextPage} onClick={() => setOffset((o) => o + PAGE_SIZE)}>
            Next
          </Button>
        </div>
      </div>

      {/* Floating bulk-action bar, per the Stitch "Data Ingestion Hub"
          reference: a glassmorphic panel fixed above the content rather
          than an inline banner, so it stays reachable while scrolling a
          long table. */}
      <div
        className={cn(
          "fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4 rounded-xl border px-5 py-3",
          "bg-popover/80 shadow-lg backdrop-blur-md transition-all duration-200",
          selected.size > 0 ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="bg-primary/20 text-primary flex size-6 items-center justify-center rounded-full text-xs font-bold">
            {selected.size}
          </span>
          <span className="text-sm">Row{selected.size === 1 ? "" : "s"} selected</span>
        </div>
        <div className="bg-border h-6 w-px" />
        <Button size="sm" onClick={handleRunEnrichment}>
          Start Enrichment
        </Button>
        <button
          className="text-muted-foreground hover:text-foreground ml-1"
          onClick={() => setSelected(new Set())}
          aria-label="Clear selection"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
