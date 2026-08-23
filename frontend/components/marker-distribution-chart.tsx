"use client";

import { Cell, Pie, PieChart } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

// Aggregate all-time marker split, per knowledge-base/UI_COMPONENT_LIBRARY.md
// §2 -- real data only, marker colors only, never repurposed for anything
// else. Includes a table fallback so the signal never depends on color
// alone (knowledge-base/FRONTEND_DESIGN_SYSTEM.md §2/§8).
interface MarkerDistributionChartProps {
  distribution: { green: number; amber: number; red: number };
}

const chartConfig = {
  green: { label: "Green", color: "var(--marker-green)" },
  amber: { label: "Amber", color: "var(--marker-amber)" },
  red: { label: "Red", color: "var(--marker-red)" },
} satisfies ChartConfig;

export function MarkerDistributionChart({ distribution }: MarkerDistributionChartProps) {
  const total = distribution.green + distribution.amber + distribution.red;
  const data = [
    { key: "green", label: "Green", value: distribution.green, fill: "var(--marker-green)" },
    { key: "amber", label: "Amber", value: distribution.amber, fill: "var(--marker-amber)" },
    { key: "red", label: "Red", value: distribution.red, fill: "var(--marker-red)" },
  ];

  return (
    <Card className="p-4">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="text-base">Confidence distribution</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {total === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">No scored fields yet.</p>
        ) : (
          <div className="flex items-center gap-6">
            <ChartContainer config={chartConfig} className="h-40 w-40 shrink-0">
              <PieChart width={160} height={160}>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="90%"
                  strokeWidth={2}
                >
                  {data.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            {/* Accessible legend + table-view fallback -- marker identity never
                relies on color alone. */}
            <table className="w-full text-sm" aria-label="Confidence distribution breakdown">
              <tbody>
                {data.map((entry) => (
                  <tr key={entry.key} className="border-b last:border-0">
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: entry.fill }}
                          aria-hidden="true"
                        />
                        {entry.label}
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{entry.value}</td>
                    <td className="text-muted-foreground py-1.5 pl-3 text-right tabular-nums">
                      {total > 0 ? `${Math.round((entry.value / total) * 100)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
