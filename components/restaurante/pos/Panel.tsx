import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm">
      <div className="border-b border-[color:var(--color-border)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <span className="text-[12px] text-[color:var(--color-text-muted)]">{subtitle}</span>}
        </div>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}
