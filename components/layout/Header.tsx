"use client";

import { useEffect, useState } from "react";
import { LogOut, Menu, Search } from "lucide-react";
import { signOut } from "next-auth/react";
import { NotificacionesBell, type Notificacion } from "./NotificacionesBell";
import { CommandPalette } from "./CommandPalette";
import { SucursalScopeSelector } from "./SucursalScopeSelector";
import { ThemeToggle } from "./ThemeToggle";
import type { CommandItem } from "@/components/layout/nav-items";

export type SucursalScopeHeader = {
  visible: boolean;
  modo: "all" | "selected";
  sucursales: { id: string; nombre: string }[];
  sucursalIds: string[];
  etiqueta: string;
};

export function Header({
  breadcrumb,
  notificaciones = [],
  commandItems,
  sucursalScope,
  onAbrirMenu,
}: {
  breadcrumb: { label: string; href?: string }[];
  notificaciones?: Notificacion[];
  commandItems: CommandItem[];
  sucursalScope?: SucursalScopeHeader;
  onAbrirMenu?: () => void;
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
      className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 sm:px-6"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onAbrirMenu}
          aria-label="Abrir menu"
          title="Abrir menu"
          className="arca-btn arca-btn-ghost p-2 sm:hidden"
        >
          <Menu size={17} />
        </button>

        <nav className="flex min-w-0 items-center gap-2 text-small">
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex min-w-0 items-center gap-2">
              {i > 0 && (
                <span className="text-[color:var(--color-text-muted)]">/</span>
              )}
              <span
                className={
                  i === breadcrumb.length - 1
                    ? "truncate font-medium text-[color:var(--color-text-primary)]"
                    : "text-[color:var(--color-text-muted)]"
                }
              >
                {b.label}
              </span>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setPaleta(true)}
          aria-label="Buscar modulo"
          className="flex h-9 w-9 items-center justify-center gap-2 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-0 text-small text-[color:var(--color-text-muted)] transition hover:border-[color:var(--color-border-strong)] sm:w-56 sm:justify-start sm:px-3 md:w-64"
        >
          <Search size={14} />
          <span className="hidden flex-1 text-left sm:block">Buscar modulo...</span>
          <kbd className="hidden rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-1.5 py-0.5 text-[10px] text-[color:var(--color-text-muted)] lg:inline-block">
            Ctrl K
          </kbd>
        </button>
        {sucursalScope?.visible && <SucursalScopeSelector scope={sucursalScope} />}
        <NotificacionesBell notificaciones={notificaciones} />
        <ThemeToggle />
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="arca-btn arca-btn-ghost p-2 md:px-3"
          aria-label="Salir"
          title="Salir"
        >
          <LogOut size={14} />
          <span className="hidden md:inline">Salir</span>
        </button>
      </div>

      <CommandPalette
        abierto={paleta}
        onCerrar={() => setPaleta(false)}
        items={commandItems}
      />
    </header>
  );
}
