"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { Checkbox } from "@/components/ui/checkbox";
import type { RowSummary } from "@/lib/rows";

export function buildColumns(
  selected: Set<string>,
  onToggle: (mfgPartNum: string) => void,
  onToggleAll: (checked: boolean) => void,
  allSelectedOnPage: boolean
): ColumnDef<RowSummary, unknown>[] {
  return [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={allSelectedOnPage}
          onCheckedChange={(checked) => onToggleAll(checked === true)}
          aria-label="Select all rows on this page"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selected.has(row.original.mfgPartNum)}
          onCheckedChange={() => onToggle(row.original.mfgPartNum)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select row ${row.original.mfgPartNum}`}
        />
      ),
    },
    {
      accessorKey: "mfgPartNum",
      header: "Mfg Part Num",
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
    },
    {
      accessorKey: "partDesc",
      header: "Description",
    },
    {
      accessorKey: "dibBrand",
      header: "Brand",
      cell: ({ getValue }) => getValue<string | null>() ?? <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "partManuf",
      header: "Manufacturer",
      cell: ({ getValue }) => getValue<string | null>() ?? <span className="text-muted-foreground">—</span>,
    },
  ];
}
