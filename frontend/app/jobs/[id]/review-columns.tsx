"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { ConfidenceMarker, type MarkerLevel } from "@/components/confidence-marker";
import type { AssembledRecord } from "@/lib/jobs";

const MARKER_RANK: Record<MarkerLevel, number> = { red: 0, amber: 1, green: 2 };

// Overall row status = worst marker across every attribute/description --
// per knowledge-base/LAYOUT.md §3 "Job detail -- review view", the table's
// job is to let a reviewer spot the red ones fast, so this must reflect
// the single worst signal, not an average.
export function overallMarker(record: AssembledRecord): MarkerLevel {
  const markers = [
    ...record.attributes.map((a) => a.marker),
    ...Object.values(record.descriptions).map((d) => d.marker),
  ].filter((m): m is MarkerLevel => m !== null);

  if (markers.length === 0) return "red";
  return markers.reduce((worst, m) => (MARKER_RANK[m] < MARKER_RANK[worst] ? m : worst), "green" as MarkerLevel);
}

export const reviewColumns: ColumnDef<AssembledRecord, unknown>[] = [
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <ConfidenceMarker level={overallMarker(row.original)} />,
  },
  {
    accessorKey: "mfgPartNum",
    header: "Mfg Part Num",
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
  },
  {
    id: "invoiceDesc",
    header: "Invoice Desc",
    cell: ({ row }) => {
      const desc = row.original.descriptions.invoice_desc;
      if (!desc) return <span className="text-muted-foreground">—</span>;
      return (
        <span className="flex items-center gap-2">
          <ConfidenceMarker level={desc.marker ?? "red"} />
          <span className="truncate">{desc.text}</span>
        </span>
      );
    },
  },
  {
    accessorKey: "brandName",
    header: "Brand",
    cell: ({ getValue }) => getValue<string | null>() ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "classpath",
    header: "Classpath",
    cell: ({ getValue }) => {
      const value = getValue<string | null>();
      return value ? (
        <span className="font-mono text-xs">{value}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
];
