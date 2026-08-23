"use client";

import { Check, ChevronDown, X } from "lucide-react";

import { ConfidenceMarker, type MarkerLevel } from "@/components/confidence-marker";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// "Click a marker to see why" (USER_JOURNEYS.md J2), per
// knowledge-base/UI_COMPONENT_LIBRARY.md §3. Built on Collapsible so the
// rule-check trace expands inline -- no modal, per knowledge-base/LAYOUT.md §5.
export interface RuleCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

interface FieldRuleTraceProps {
  fieldName: string;
  marker: MarkerLevel;
  ruleChecks: RuleCheck[];
  sourceLovId?: string | null;
}

export function FieldRuleTrace({ fieldName, marker, ruleChecks, sourceLovId }: FieldRuleTraceProps) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-accent">
        <span className="flex items-center gap-2">
          <ConfidenceMarker level={marker} />
          <span className="font-medium">{fieldName}</span>
        </span>
        <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-1 space-y-1 pl-6">
          {ruleChecks.map((check) => (
            <li key={check.rule} className="flex items-start gap-2 text-xs">
              {check.passed ? (
                <Check className="text-marker-green mt-0.5 size-3.5 shrink-0" />
              ) : (
                <X className="text-marker-red mt-0.5 size-3.5 shrink-0" />
              )}
              <span className={cn(!check.passed && "text-foreground", "text-muted-foreground")}>
                <span className="text-foreground font-medium">{check.rule}</span>: {check.detail}
              </span>
            </li>
          ))}
          {sourceLovId && (
            <li className="text-muted-foreground pl-5.5 font-mono text-xs">Matched LOV row: {sourceLovId}</li>
          )}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
