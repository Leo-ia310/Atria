import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:mb-6 sm:flex-row sm:items-end sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl text-[color:var(--color-text-primary)]">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
