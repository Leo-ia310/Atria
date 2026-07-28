"use client";

import { useEffect, useState } from "react";
import { Search, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { NotificacionesBell, type Notificacion } from "./NotificacionesBell";
import { CommandPalette } from "./CommandPalette";

export function Header({
  breadcrumb,
  notificaciones = [],
}: {
  breadcrumb: { label: string; href?: string }[];
  notificaciones?: Notificacion[];
}) {
  const [paleta, setPaleta] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaleta((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
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
          onClick={() => setPaleta(true)}
          className="flex h-8 w-64 items-center gap-2 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 text-small text-[color:var(--color-text-muted)] transition hover:border-[color:var(--color-border-strong)]"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Buscar módulo...</span>
          <kbd className="rounded border border-[color:var(--color-border)] bg-white px-1.5 py-0.5 text-[10px]">
            ⌘K
          </kbd>
        </button>
        <NotificacionesBell notificaciones={notificaciones} />
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="atria-btn atria-btn-ghost"
        >
          <LogOut size={14} />
          Salir
        </button>
      </div>

      <CommandPalette abierto={paleta} onCerrar={() => setPaleta(false)} />
    </header>
  );
}
