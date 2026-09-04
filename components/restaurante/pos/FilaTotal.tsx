import { cn } from "@/lib/utils";

export function FilaTotal({
  label,
  value,
  fuerte,
}: {
  label: string;
  value: string;
  fuerte?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", fuerte && "text-base font-bold")}>
      <span className={fuerte ? undefined : "text-[color:var(--color-text-muted)]"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
