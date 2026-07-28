"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";

export type Notificacion = {
  id: string;
  titulo: string;
  detalle?: string;
  href: string;
  tono: "error" | "warning" | "info";
};

const TONO_COLOR: Record<Notificacion["tono"], string> = {
  error: "var(--color-error)",
  warning: "var(--color-warning)",
  info: "var(--color-secondary)",
};

export function NotificacionesBell({
  notificaciones,
}: {
  notificaciones: Notificacion[];
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hay = notificaciones.length > 0;

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    if (abierto) document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={cn(
          "atria-btn atria-btn-ghost relative p-2",
          hay && "text-[color:var(--color-primary)]",
        )}
        aria-label={hay ? `${notificaciones.length} notificaciones` : "Notificaciones"}
      >
        {hay ? (
          <BellRing size={16} className="animate-[wiggle_1.2s_ease-in-out_infinite]" />
        ) : (
          <Bell size={16} />
        )}
        {hay && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--color-error)] px-1 text-[10px] font-bold text-white">
            {notificaciones.length > 9 ? "9+" : notificaciones.length}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-11 z-40 w-80 overflow-hidden rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg">
          <div className="border-b border-[color:var(--color-border)] px-4 py-2.5 text-small font-semibold">
            Notificaciones
          </div>
          {!hay ? (
            <div className="px-4 py-6 text-center text-small text-[color:var(--color-text-muted)]">
              No tienes notificaciones pendientes.
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-[color:var(--color-border)] overflow-y-auto">
              {notificaciones.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => setAbierto(false)}
                    className="flex gap-3 px-4 py-3 transition hover:bg-[color:var(--color-surface-2)]"
                  >
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: TONO_COLOR[n.tono] }}
                    />
                    <span className="min-w-0">
                      <span className="block text-small font-medium">{n.titulo}</span>
                      {n.detalle && (
                        <span className="block text-[12px] text-[color:var(--color-text-muted)]">
                          {n.detalle}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
