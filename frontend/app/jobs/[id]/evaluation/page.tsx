"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { Check, Download, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { API_URL } from "@/lib/api";
import { useAuthedUrl } from "@/lib/auth";
import { useEvaluation } from "@/lib/evaluation";
import { cn } from "@/lib/utils";

const complianceChartConfig = {
  value: { label: "Compliance", color: "var(--chart-1)" },
} satisfies ChartConfig;

// Evaluation dashboard (knowledge-base/LAYOUT.md §3): grid of KPI stat
// tiles at top, breakdown table below -- comparative tabular data, not
// cards, per the app's grid-vs-table decision rule (LAYOUT.md §4).
function formatPercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function toneForPercent(value: number | null): "neutral" | "green" | "amber" | "red" {
  if (value === null) return "neutral";
  if (value >= 0.8) return "green";
  if (value >= 0.5) return "amber";
  return "red";
}

export default function JobEvaluationPage() {
  const params = useParams<{ id: string }>();
  const { data: evaluation, isLoading, isError } = useEvaluation(params.id);
  const exportUrl = useAuthedUrl(`${API_URL}/jobs/${params.id}/export`);

  // Gap-detection breakdown, per the Stitch "Evaluation Dashboard"
  // reference: which fields most often miss ground truth. Grouped from
  // the same fieldAccuracyDetails already fetched, not a fabricated
  // "reason" taxonomy the backend doesn't produce.
  const gapBreakdown = useMemo(() => {
    if (!evaluation) return [];
    const mismatches = evaluation.fieldAccuracyDetails.filter((d) => !d.matched);
    if (mismatches.length === 0) return [];
    const counts = new Map<string, number>();
    for (const d of mismatches) {
      counts.set(d.fieldName, (counts.get(d.fieldName) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([fieldName, count]) => ({ fieldName, count, pct: Math.round((count / mismatches.length) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [evaluation]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evaluation"
        subtitle={
          <>
            How this batch scored against ground truth.{" "}
            <span className="text-muted-foreground/70 font-mono text-xs">{params.id}</span>
          </>
        }
        action={
          <Button variant="outline" nativeButton={false} render={<a href={exportUrl} />}>
            <Download />
            Export CSV
          </Button>
        }
      />

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load evaluation</AlertTitle>
          <AlertDescription>No evaluation data for job {params.id}.</AlertDescription>
        </Alert>
      )}

      {evaluation && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatTile
              label="Field-level accuracy"
              value={formatPercent(evaluation.fieldLevelAccuracy)}
              tone={toneForPercent(evaluation.fieldLevelAccuracy)}
              progress={evaluation.fieldLevelAccuracy}
            />
            <StatTile
              label="Char-limit compliance"
              value={formatPercent(evaluation.charLimitCompliance)}
              tone={toneForPercent(evaluation.charLimitCompliance)}
              progress={evaluation.charLimitCompliance}
            />
            <StatTile
              label="LOV compliance"
              hint="values from the approved list"
              value={formatPercent(evaluation.lovCompliance)}
              tone={toneForPercent(evaluation.lovCompliance)}
              progress={evaluation.lovCompliance}
            />
          </div>

          {[evaluation.fieldLevelAccuracy, evaluation.charLimitCompliance, evaluation.lovCompliance].some(
            (v) => v !== null
          ) && (
            <ChartContainer config={complianceChartConfig} className="h-48 w-full">
              <BarChart
                data={[
                  { metric: "Field accuracy", value: evaluation.fieldLevelAccuracy },
                  { metric: "Char limit", value: evaluation.charLimitCompliance },
                  { metric: "LOV", value: evaluation.lovCompliance },
                ].filter((d) => d.value !== null)}
                layout="vertical"
              >
                <CartesianGrid horizontal={false} />
                <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <YAxis type="category" dataKey="metric" width={100} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${Math.round(Number(v) * 100)}%`} />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}

          {gapBreakdown.length > 0 && (
            <div className="bg-card rounded-xl p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium">Gap Detection: Failure Reasons</h3>
                <span className="bg-marker-amber/10 text-marker-amber border-marker-amber/20 rounded border px-2 py-0.5 text-xs">
                  Needs attention
                </span>
              </div>
              <div className="space-y-3">
                {gapBreakdown.map((g) => (
                  <div key={g.fieldName}>
                    <div className="mb-1 flex justify-between font-mono text-xs">
                      <span className="text-muted-foreground">{g.fieldName}</span>
                      <span className="text-marker-amber">{g.pct}%</span>
                    </div>
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div className="bg-marker-amber h-full rounded-full" style={{ width: `${g.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {evaluation.unscoredRowIds.length > 0 && (
            <Alert>
              <AlertTitle>
                {evaluation.scoredRowCount} of {evaluation.totalRowCount} rows scored against ground truth
              </AlertTitle>
              <AlertDescription>
                <p>
                  {evaluation.unscoredRowIds.length} row{evaluation.unscoredRowIds.length === 1 ? "" : "s"} had no
                  ground truth to compare against, so {evaluation.unscoredRowIds.length === 1 ? "it's" : "they're"} left
                  out of the field-accuracy score above.
                </p>
                <details className="mt-1">
                  <summary className="text-muted-foreground w-fit cursor-pointer text-xs hover:underline">
                    Show excluded rows
                  </summary>
                  <p className="text-muted-foreground mt-1 font-mono text-xs">{evaluation.unscoredRowIds.join(", ")}</p>
                </details>
              </AlertDescription>
            </Alert>
          )}

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Matched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluation.fieldAccuracyDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                      No field-level comparisons available.
                    </TableCell>
                  </TableRow>
                ) : (
                  evaluation.fieldAccuracyDetails
                    .filter((d) => !d.matched)
                    .concat(evaluation.fieldAccuracyDetails.filter((d) => d.matched))
                    .map((d, i) => (
                      <TableRow key={`${d.rowId}:${d.fieldName}:${i}`}>
                        <TableCell className="font-mono text-xs">{d.rowId}</TableCell>
                        <TableCell>{d.fieldName}</TableCell>
                        <TableCell className={cn("font-mono text-xs", !d.matched && "text-muted-foreground/60 line-through")}>
                          {d.expected}
                        </TableCell>
                        <TableCell
                          className={cn("font-mono text-xs", d.matched ? "text-marker-green" : "text-marker-red")}
                        >
                          {d.actual ?? "—"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              d.matched ? "text-marker-green" : "text-marker-red"
                            )}
                          >
                            {d.matched ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                            {d.matched ? "Match" : "Mismatch"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
