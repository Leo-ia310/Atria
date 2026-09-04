import type { ReactNode } from "react";

export function MiniInfo({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
      <div className="flex items-center gap-2 text-[12px] text-[color:var(--color-text-muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
