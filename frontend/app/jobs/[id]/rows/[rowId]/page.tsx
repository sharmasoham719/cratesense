"use client";

import { useParams } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FieldRuleTrace } from "@/components/field-rule-trace";
import { PageHeader } from "@/components/page-header";
import { useJobRow, type AssembledAttribute } from "@/lib/jobs";

// Enriched record detail (knowledge-base/LAYOUT.md §3): field groups each
// rendered as a Card in a responsive 2-column grid -- only groups this
// pipeline actually populates (Taxonomy, Brand/Manufacturer, Descriptions,
// Attributes), per record_assembler.py's scope decision. No modal --
// deep-linkable per journey J2/J6.
const DESCRIPTION_LABELS: Record<string, string> = {
  invoice_desc: "Invoice",
  mobile_desc: "Mobile",
  short_desc: "Short",
  long_desc: "Long",
  retail_desc: "Retail",
  marketing_description: "Marketing",
};

export default function JobRowDetailPage() {
  const params = useParams<{ id: string; rowId: string }>();
  const { data: record, isLoading, isError } = useJobRow(params.id, params.rowId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !record) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Row not found</AlertTitle>
        <AlertDescription>
          No enriched record for {params.rowId} in job {params.id}.
        </AlertDescription>
      </Alert>
    );
  }

  const descriptionEntries = Object.entries(record.descriptions);

  return (
    <div className="space-y-6">
      <PageHeader title={record.mfgPartNum} subtitle={record.partDesc} />

      {record.flags.length > 0 && (
        <Alert>
          <AlertTitle>Review flags</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc font-mono text-xs">
              {record.flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-4">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-base">Taxonomy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-0 text-sm">
            <div>
              <span className="text-muted-foreground">Classpath (category path):</span>{" "}
              <span className="font-mono text-xs">{record.classpath ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-base">Brand / Manufacturer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-0 text-sm">
            <div>
              <span className="text-muted-foreground">Manufacturer:</span> {record.manufacturerName ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Brand:</span> {record.brandName ?? "—"}
            </div>
          </CardContent>
        </Card>

        {descriptionEntries.length > 0 && (
          <Card className="p-4 md:col-span-2">
            <CardHeader className="p-0 pb-2">
              <CardTitle className="text-base">Descriptions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-0">
              {descriptionEntries.map(([name, desc]) => (
                <div key={name} className="border-b pb-2 last:border-b-0 last:pb-0">
                  <FieldRuleTrace
                    fieldName={DESCRIPTION_LABELS[name] ?? name}
                    marker={desc.marker ?? "red"}
                    ruleChecks={desc.ruleChecks}
                  />
                  <p className="text-muted-foreground mt-1 pl-6 text-sm">{desc.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {record.attributes.length > 0 && (
          <Card className="p-4 md:col-span-2">
            <CardHeader className="p-0 pb-2">
              <CardTitle className="text-base">Attributes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>UOM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {record.attributes.map((attr) => (
                    <AttributeRow key={attr.label} attr={attr} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function AttributeRow({ attr }: { attr: AssembledAttribute }) {
  return (
    <TableRow>
      <TableCell>
        <FieldRuleTrace fieldName={attr.label} marker={attr.marker ?? "red"} ruleChecks={attr.ruleChecks} />
      </TableCell>
      <TableCell>{attr.value}</TableCell>
      <TableCell className="text-muted-foreground">{attr.uom ?? "—"}</TableCell>
    </TableRow>
  );
}
