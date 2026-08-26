import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FormField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-secondary)]">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="block text-[11px] text-[color:var(--color-text-muted)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function FormGroup({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("space-y-2", className)}>
      <legend className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-secondary)]">
        {label}
      </legend>
      {children}
      {hint ? (
        <p className="text-[11px] text-[color:var(--color-text-muted)]">{hint}</p>
      ) : null}
    </fieldset>
  );
}
