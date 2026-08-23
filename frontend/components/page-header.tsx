import type { ReactNode } from "react";

// Shared page header per knowledge-base/UI_COMPONENT_LIBRARY.md §2 --
// every screen's title/subtitle/primary-action block goes through this,
// not hand-rolled markup.
interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
