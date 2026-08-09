import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("arca-card", className)} {...rest}>
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
    <div className="flex flex-col items-start justify-between gap-3 border-b border-[color:var(--color-border)] px-4 py-4 sm:flex-row sm:gap-4 sm:px-5">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-[color:var(--color-text-primary)]">
          {title}
        </h3>
        {subtitle && (
          <p className="text-small mt-0.5 text-[color:var(--color-text-muted)]">
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

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}

export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-[color:var(--color-border)] px-4 py-3 text-small text-[color:var(--color-text-muted)] sm:px-5">
      {children}
    </div>
  );
}
