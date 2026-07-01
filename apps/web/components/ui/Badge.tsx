import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Variant = "success" | "warning" | "error" | "info" | "neutral";

export function Badge({
  variant = "neutral",
  children,
  className,
}: {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("atria-badge", `atria-badge-${variant}`, className)}>
      {children}
    </span>
  );
}
