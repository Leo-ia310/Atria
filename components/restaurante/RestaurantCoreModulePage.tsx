import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";

export type RestaurantKpi = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
};

export type RestaurantAction = {
  href: string;
  label: string;
  icon?: LucideIcon;
  primary?: boolean;
};

export type RestaurantListItem = {
  id: string;
  title: string;
  subtitle?: string;
  value?: string;
  meta?: string;
  badge?: string;
  tone?: "success" | "warning" | "error" | "info" | "neutral";
  href?: string;
};

export function RestaurantCoreModulePage({
  eyebrow,
  title,
  subtitle,
  actions = [],
  kpis = [],
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: RestaurantAction[];
  kpis?: RestaurantKpi[];
  children: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-label">{eyebrow}</p>
          <h1 className="mt-1 text-xl">{title}</h1>
          <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
            {subtitle}
          </p>
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <RestaurantActionLink key={action.href} action={action} />
            ))}
          </div>
        )}
      </header>

      {kpis.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </section>
      )}

      {children}
    </div>
  );
}

export function RestaurantActionLink({ action }: { action: RestaurantAction }) {
  const Icon = action.icon ?? ArrowRight;
  return (
    <Link
      href={action.href}
      className={
        action.primary
          ? "arca-btn arca-btn-primary arca-btn-sm"
          : "arca-btn arca-btn-secondary arca-btn-sm"
      }
    >
      <Icon size={14} /> {action.label}
    </Link>
  );
}

export function RestaurantModuleList({
  title,
  subtitle,
  items,
  empty,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  items: RestaurantListItem[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody>
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-[color:var(--color-border)] px-4 py-8 text-center text-small text-[color:var(--color-text-muted)]">
            {empty}
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--color-border)]">
            {items.map((item) => (
              <RestaurantModuleListRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function RestaurantModuleListRow({ item }: { item: RestaurantListItem }) {
  const content = (
    <div className="flex min-h-[64px] items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{item.title}</span>
          {item.badge && <Badge variant={item.tone ?? "neutral"}>{item.badge}</Badge>}
        </div>
        {item.subtitle && (
          <p className="mt-1 line-clamp-2 text-[12px] text-[color:var(--color-text-muted)]">
            {item.subtitle}
          </p>
        )}
        {item.meta && (
          <p className="mt-1 text-[11px] text-[color:var(--color-text-secondary)]">
            {item.meta}
          </p>
        )}
      </div>
      {item.value && (
        <div className="shrink-0 text-right font-semibold text-[color:var(--color-text-primary)]">
          {item.value}
        </div>
      )}
    </div>
  );

  if (!item.href) return content;
  return (
    <Link href={item.href} className="block rounded-md px-2 transition hover:bg-[color:var(--color-surface-2)]">
      {content}
    </Link>
  );
}

export function RestaurantModuleGrid({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions: RestaurantAction[];
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex min-h-[84px] items-center justify-between gap-3 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 transition hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-surface-2)]"
            >
              <span className="font-medium">{action.label}</span>
              <ArrowRight size={16} className="text-[color:var(--color-secondary)]" />
            </Link>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
