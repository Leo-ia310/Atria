"use client";

import { Bell, Search } from "lucide-react";
import { useSession } from "./SessionProvider";

export function Header({ breadcrumb }: { breadcrumb: { label: string; href?: string }[] }) {
  const { user } = useSession();

  return (
    <header
      style={{ height: "var(--header-height)" }}
      className="sticky top-0 z-20 flex items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6"
    >
      <nav className="flex items-center gap-2 text-small">
        {breadcrumb.map((b, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && (
              <span className="text-[color:var(--color-text-muted)]">/</span>
            )}
            <span
              className={
                i === breadcrumb.length - 1
                  ? "font-medium text-[color:var(--color-text-primary)]"
                  : "text-[color:var(--color-text-muted)]"
              }
            >
              {b.label}
            </span>
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-8 w-64 items-center gap-2 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 text-small text-[color:var(--color-text-muted)] transition hover:border-[color:var(--color-border-strong)]"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Buscar...</span>
          <kbd className="rounded border border-[color:var(--color-border)] bg-white px-1.5 py-0.5 text-[10px]">
            ⌘K
          </kbd>
        </button>
        <button
          type="button"
          className="atria-btn atria-btn-ghost p-2 relative"
          aria-label="Notificaciones"
        >
          <Bell size={16} />
        </button>
        {user && (
          <span className="text-[12px] text-[color:var(--color-text-muted)]">
            {user.organizationSlug}
          </span>
        )}
      </div>
    </header>
  );
}
