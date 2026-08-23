"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

// Filter/search bar per knowledge-base/LAYOUT.md §3: full-width, sits
// above every DataTable in the app (consistent placement per
// knowledge-base/UI_COMPONENT_LIBRARY.md §2). Only exposes what the
// backend actually supports (GET /rows?search= is a Part_Desc substring
// match) -- no fabricated classpath/category filters the API can't serve.
interface FilterBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function FilterBar({ value, onChange, placeholder = "Search…" }: FilterBarProps) {
  return (
    <div className="relative max-w-md">
      <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="focus-visible:ring-primary/30 pl-9"
      />
    </div>
  );
}
