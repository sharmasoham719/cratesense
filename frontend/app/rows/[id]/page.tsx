"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldRuleTrace } from "@/components/field-rule-trace";
import { PageHeader } from "@/components/page-header";
import { useLatestEnrichedRow } from "@/lib/jobs";
import { useRow } from "@/lib/rows";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{value ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

const DESCRIPTION_LABELS: Record<string, string> = {
  invoice_desc: "Invoice",
  mobile_desc: "Mobile",
  short_desc: "Short",
  long_desc: "Long",
  retail_desc: "Retail",
  marketing_description: "Marketing",
};

// J6 (knowledge-base/USER_JOURNEYS.md): "before/after" comparison for a
// single item -- raw input row alongside its enriched output, once
// enriched, annotated with which job/pipeline run produced it. Falls back
// to raw-only + "Run enrichment" for a row never processed yet.
export default function RowDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: row, isLoading, isError } = useRow(params.id);
  const { data: enriched, isLoading: enrichedLoading } = useLatestEnrichedRow(params.id);

  const handleRunEnrichment = () => {
    sessionStorage.setItem("cratesense:pendingRowIds", JSON.stringify([params.id]));
    router.push("/jobs/new");
  };

  if (isLoading) {
    return <Skeleton className="h-48 w-full max-w-2xl" />;
  }

  if (isError || !row) {
    return <p className="text-destructive text-sm">Row not found: {params.id}</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={row.mfgPartNum}
        subtitle={
          enriched
            ? `Raw input vs. enriched output, from job ${enriched.jobId}.`
            : "Raw input row, pre-enrichment."
        }
        action={<Button onClick={handleRunEnrichment}>Run enrichment</Button>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Before — raw input</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Part_Desc" value={row.partDesc} />
              </div>
              <Field label="E1_Brand" value={row.e1Brand} />
              <Field label="Unilog_Brand" value={row.unilogBrand} />
              <Field label="DIB_Brand" value={row.dibBrand} />
              <Field label="Part_Manuf" value={row.partManuf} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">After — enriched output</CardTitle>
          </CardHeader>
          <CardContent>
            {enrichedLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !enriched ? (
              <p className="text-muted-foreground text-sm">
                Not enriched yet. Run enrichment to see the generated descriptions and attributes here.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>
                    <span className="text-muted-foreground">Manufacturer:</span>{" "}
                    {enriched.record.manufacturerName ?? "—"}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Brand:</span> {enriched.record.brandName ?? "—"}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Classpath:</span>{" "}
                    <span className="font-mono text-xs">{enriched.record.classpath ?? "—"}</span>
                  </span>
                </div>
                <div className="space-y-3">
                  {Object.entries(enriched.record.descriptions).map(([name, desc]) => (
                    <div key={name} className="border-b pb-2 last:border-b-0 last:pb-0">
                      <FieldRuleTrace
                        fieldName={DESCRIPTION_LABELS[name] ?? name}
                        marker={desc.marker ?? "red"}
                        ruleChecks={desc.ruleChecks}
                      />
                      <p className="text-muted-foreground mt-1 pl-6 text-sm">{desc.text}</p>
                    </div>
                  ))}
                </div>
                <Link
                  href={`/jobs/${enriched.jobId}/rows/${row.mfgPartNum}`}
                  className="text-primary text-sm hover:underline"
                >
                  View full record in job {enriched.jobId} →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {enriched && enriched.record.flags.length > 0 && (
        <Alert>
          <AlertTitle>Review flags</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc font-mono text-xs">
              {enriched.record.flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
