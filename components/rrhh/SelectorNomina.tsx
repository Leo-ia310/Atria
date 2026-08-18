"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, History } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

type Estado = "borrador" | "aprobada" | "pagada" | "anulada" | string;

const VARIANTE: Record<string, "success" | "warning" | "neutral" | "error" | "info"> = {
  borrador: "warning",
  aprobada: "info",
  pagada: "success",
  anulada: "error",
};

export type NominaItem = {
  id: string;
  numero: string;
  estado: Estado;
  periodo: string;
  extra?: string;
};

export function SelectorNomina({
  basePath,
  items,
  selectedId,
}: {
  basePath: string;
  items: NominaItem[];
  selectedId?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [abierto]);

  const seleccionada = items.find((n) => n.id === selectedId) ?? items[0];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        {seleccionada && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-[color:var(--color-text-primary)]">
              {seleccionada.numero}
            </span>
            <Badge variant={VARIANTE[seleccionada.estado] ?? "neutral"}>
              {seleccionada.estado}
            </Badge>
            <span className="text-small text-[color:var(--color-text-muted)]">
              {seleccionada.periodo}
            </span>
          </div>
        )}
      </div>

      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="arca-btn arca-btn-secondary arca-btn-sm"
        >
          <History size={14} /> Historial de nóminas
          <ChevronDown
            size={14}
            className={`transition-transform ${abierto ? "rotate-180" : ""}`}
          />
        </button>

        {abierto && (
          <div className="absolute right-0 z-20 mt-2 max-h-80 w-80 overflow-y-auto rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1.5 shadow-lg">
            {items.map((n) => {
              const activa = n.id === seleccionada?.id;
              return (
                <Link
                  key={n.id}
                  href={`${basePath}?nomina=${n.id}`}
                  onClick={() => setAbierto(false)}
                  className={`block rounded-md px-3 py-2 transition ${
                    activa
                      ? "bg-[color:var(--color-surface-2)]"
                      : "hover:bg-[color:var(--color-surface-2)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-small font-medium">{n.numero}</span>
                    <Badge variant={VARIANTE[n.estado] ?? "neutral"}>{n.estado}</Badge>
                  </div>
                  <div className="text-[11px] text-[color:var(--color-text-muted)]">
                    {n.periodo}
                  </div>
                  {n.extra && (
                    <div className="text-[11px] text-[color:var(--color-error)]">{n.extra}</div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
