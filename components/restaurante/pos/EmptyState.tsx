import type { ReactNode } from "react";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-5 text-center text-small text-[color:var(--color-text-muted)]">
      {children}
    </div>
  );
}
