"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
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

      {selected.size > 0 && (
        <div className="bg-muted flex items-center justify-between rounded-md border px-4 py-2">
          <span className="text-sm">
            {selected.size} row{selected.size === 1 ? "" : "s"} selected
          </span>
          <Button size="sm" onClick={handleRunEnrichment}>
            Run enrichment on {selected.size} row{selected.size === 1 ? "" : "s"}
          </Button>
        </div>
      )}

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
    </div>
  );
}
