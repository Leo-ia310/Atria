import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("atria-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-border)] px-5 py-4">
      <div>
        <h3 className="text-base font-semibold text-[color:var(--color-text-primary)]">
          {title}
        </h3>
        {subtitle && (
          <p className="text-small mt-0.5 text-[color:var(--color-text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-[color:var(--color-border)] px-5 py-3 text-small text-[color:var(--color-text-muted)]">
      {children}
    </div>
  );
}
