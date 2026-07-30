import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  deltaPositive,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="arca-card p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-label">{label}</span>
        {Icon && (
          <div className="rounded-md bg-[color:var(--color-surface-2)] p-1.5 text-[color:var(--color-secondary)]">
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-2xl text-[color:var(--color-text-primary)]">{value}</div>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[12px] font-medium",
              deltaPositive
                ? "text-[color:var(--color-success)]"
                : "text-[color:var(--color-error)]",
            )}
          >
            {deltaPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {delta}
          </span>
        )}
      </div>
      {hint && (
        <p className="mt-2 text-small text-[color:var(--color-text-muted)]">{hint}</p>
      )}
    </div>
  );
}
