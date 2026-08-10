"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, History } from "lucide-react";
import { cn } from "@/lib/utils";

export type Movimiento = {
  fecha: string;
  tipo: string;
  cantidad: number;
  usuario: string | null;
  nota: string | null;
};

type Periodo = "semana" | "mes" | "90d" | "todo";

const PERIODOS: { value: Periodo; label: string; dias: number | null }[] = [
  { value: "semana", label: "Última semana", dias: 7 },
  { value: "mes", label: "Último mes", dias: 30 },
  { value: "90d", label: "Últimos 90 días", dias: 90 },
  { value: "todo", label: "Ver todo", dias: null },
];

const TIPO_LABEL: Record<string, string> = {
  entrada_compra: "Compra",
  salida_venta: "Venta",
  ajuste_entrada: "Ajuste (+)",
  ajuste_salida: "Ajuste (−)",
  transferencia_entrada: "Traslado (+)",
  transferencia_salida: "Traslado (−)",
  devolucion_cliente: "Devolución cliente",
  devolucion_proveedor: "Devolución proveedor",
  merma: "Merma",
  conteo_diferencia: "Ajuste de conteo",
};

const TIPOS_ENTRADA = new Set([
  "entrada_compra",
  "ajuste_entrada",
  "transferencia_entrada",
  "devolucion_cliente",
]);

function esEntrada(tipo: string): boolean {
  return TIPOS_ENTRADA.has(tipo);
}

function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RegistroMovimientos({ movimientos }: { movimientos: Movimiento[] }) {
  const [periodo, setPeriodo] = useState<Periodo>("90d");

  const filtrados = useMemo(() => {
    const dias = PERIODOS.find((p) => p.value === periodo)?.dias ?? null;
    if (dias === null) return movimientos;
    const corte = Date.now() - dias * 24 * 60 * 60 * 1000;
    return movimientos.filter((m) => new Date(m.fecha).getTime() >= corte);
  }, [movimientos, periodo]);

  return (
    <div className="arca-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-border)] p-4">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-[color:var(--color-text-primary)]">
            <History size={16} /> Registro de movimientos
          </div>
          <p className="text-small text-[color:var(--color-text-muted)]">
            {filtrados.length} movimiento{filtrados.length === 1 ? "" : "s"} en el período
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriodo(p.value)}
              className={cn(
                "rounded px-2.5 py-1 text-[12px] transition",
                periodo === p.value
                  ? "bg-[color:var(--color-surface)] font-medium text-[color:var(--color-text-primary)] shadow-sm"
                  : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-small">
          <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
            <tr>
              <th className="text-label px-4 py-2.5 text-left font-semibold">Fecha</th>
              <th className="text-label px-4 py-2.5 text-left font-semibold">Movimiento</th>
              <th className="text-label px-4 py-2.5 text-right font-semibold">Cantidad</th>
              <th className="text-label px-4 py-2.5 text-left font-semibold">Registrado por</th>
              <th className="text-label px-4 py-2.5 text-left font-semibold">Nota</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[color:var(--color-text-muted)]">
                  Sin movimientos en este período.
                </td>
              </tr>
            ) : (
              filtrados.map((m, i) => {
                const entrada = esEntrada(m.tipo);
                return (
                  <tr key={i} className="border-b border-[color:var(--color-border)] last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-[color:var(--color-text-muted)]">
                      {formatearFechaHora(m.fecha)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 font-medium",
                          entrada
                            ? "text-[color:var(--color-success)]"
                            : "text-[color:var(--color-danger)]",
                        )}
                      >
                        {entrada ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                        {TIPO_LABEL[m.tipo] ?? m.tipo}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right font-semibold",
                        entrada
                          ? "text-[color:var(--color-success)]"
                          : "text-[color:var(--color-danger)]",
                      )}
                    >
                      {entrada ? "+" : "−"}
                      {m.cantidad.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5">{m.usuario ?? "—"}</td>
                    <td className="max-w-[220px] truncate px-4 py-2.5 text-[color:var(--color-text-muted)]">
                      {m.nota ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
