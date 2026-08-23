"use client";

import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfidenceMarker } from "@/components/confidence-marker";
import type { AssembledAttribute, AssembledDescription, AssembledRecord } from "@/lib/jobs";
import { overallMarker } from "@/app/jobs/[id]/review-columns";

// Right-side slide-in field audit panel, per the Stitch "Batch Results
// Review" reference: category-grouped field checks (Descriptions,
// Attributes) each showing a pass/fail rule trace, with a discard/keep
// footer -- replaces navigating away to a separate row page for the
// review-table's row-click interaction.
interface RowDetailDrawerProps {
  record: AssembledRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DESCRIPTION_LABELS: Record<string, string> = {
  invoice_desc: "Invoice",
  mobile_desc: "Mobile",
  short_desc: "Short",
  long_desc: "Long",
  retail_desc: "Retail",
  marketing_description: "Marketing",
};

export function RowDetailDrawer({ record, open, onOpenChange }: RowDetailDrawerProps) {
  if (!record) return null;

  const descriptionEntries = Object.entries(record.descriptions);
  const overall = overallMarker(record);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle className="flex items-center gap-2">
            <ConfidenceMarker level={overall} size="md" />
            <span className="font-mono">{record.mfgPartNum}</span>
          </SheetTitle>
          <SheetDescription className="truncate">{record.partDesc}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {record.flags.length > 0 && (
            <div className="border-marker-red/20 bg-marker-red/5 space-y-1 rounded-md border p-3">
              <p className="text-marker-red text-xs font-semibold uppercase tracking-wide">Review flags</p>
              <ul className="list-inside list-disc font-mono text-xs">
                {record.flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">Manufacturer:</span> {record.manufacturerName ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Brand:</span> {record.brandName ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Classpath:</span>{" "}
              <span className="font-mono text-xs">{record.classpath ?? "—"}</span>
            </div>
          </div>

          {descriptionEntries.length > 0 && (
            <FieldGroup title="Descriptions" count={descriptionEntries.length}>
              {descriptionEntries.map(([name, desc]) => (
                <FieldAuditCard key={name} label={DESCRIPTION_LABELS[name] ?? name} field={desc} />
              ))}
            </FieldGroup>
          )}

          {record.attributes.length > 0 && (
            <FieldGroup title="Attributes" count={record.attributes.length}>
              {record.attributes.map((attr) => (
                <FieldAuditCard key={attr.label} label={attr.label} field={attr} value={attr.value} uom={attr.uom} />
              ))}
            </FieldGroup>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 border-t px-4 py-4">
          <Button variant="outline" className="flex-1" nativeButton={false} render={<SheetClose />}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FieldGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h5 className="text-muted-foreground border-b pb-1 text-xs font-semibold tracking-wide uppercase">
        {title} ({count})
      </h5>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

const MARKER_RING: Record<string, string> = {
  green: "before:bg-marker-green",
  amber: "before:bg-marker-amber",
  red: "before:bg-marker-red",
};

function FieldAuditCard({
  label,
  field,
  value,
  uom,
}: {
  label: string;
  field: AssembledDescription | AssembledAttribute;
  value?: string;
  uom?: string | null;
}) {
  const marker = field.marker ?? "red";
  return (
    <div
      className={
        "bg-muted/40 relative space-y-1.5 overflow-hidden rounded-md border p-3 " +
        "before:absolute before:top-0 before:left-0 before:h-full before:w-[2px] " +
        (MARKER_RING[marker] ?? "before:bg-marker-red")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <ConfidenceMarker level={marker} />
      </div>
      <p className="text-muted-foreground text-sm">
        {value ?? (field as AssembledDescription).text}
        {uom && <span className="text-muted-foreground/70 ml-1 text-xs">{uom}</span>}
      </p>
      <ul className="space-y-1">
        {field.ruleChecks.map((check) => (
          <li key={check.rule} className="flex items-start gap-1.5 font-mono text-[11px]">
            {check.passed ? (
              <Check className="text-marker-green mt-0.5 size-3 shrink-0" />
            ) : (
              <X className="text-marker-red mt-0.5 size-3 shrink-0" />
            )}
            <span className="text-muted-foreground">
              <span className="text-foreground">{check.rule}:</span> {check.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
