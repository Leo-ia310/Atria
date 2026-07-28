"use client";

import { useEffect, useState } from "react";
import { X, Check } from "lucide-react";
import { PLANES_ARRAY } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export function PlanesModal({
  abierto,
  onCerrar,
  planActual,
}: {
  abierto: boolean;
  onCerrar: () => void;
  planActual: string;
}) {
  const [anual, setAnual] = useState(false);

  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    if (abierto) {
      document.addEventListener("keydown", esc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
      onClick={onCerrar}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-[color:var(--color-text-primary)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCerrar}
          className="absolute right-4 top-4 rounded-md p-1.5 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-text-primary)]"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        <div className="mb-5 text-center">
          <h2 className="text-xl font-bold text-[color:var(--color-text-primary)]">
            Planes de ATRIA
          </h2>
          <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
            Tu plan actual es <strong>{planActual}</strong>. Escala cuando lo necesites.
          </p>
          <div className="mt-3 inline-flex rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-1 text-small">
            <button
              type="button"
              onClick={() => setAnual(false)}
              className={cn(
                "rounded-full px-3 py-1 transition",
                !anual ? "bg-[color:var(--color-surface)] font-medium shadow-sm" : "text-[color:var(--color-text-muted)]",
              )}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setAnual(true)}
              className={cn(
                "rounded-full px-3 py-1 transition",
                anual ? "bg-[color:var(--color-surface)] font-medium shadow-sm" : "text-[color:var(--color-text-muted)]",
              )}
            >
              Anual
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PLANES_ARRAY.map((plan) => {
            const esActual = plan.nombre.toLowerCase() === planActual.toLowerCase();
            const precio = anual ? plan.precioAnualMensualizado : plan.precioMensual;
            return (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-lg border p-4",
                  plan.destacado
                    ? "border-[color:var(--color-primary)] ring-1 ring-[color:var(--color-primary)]/30"
                    : "border-[color:var(--color-border)]",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold">{plan.nombre}</span>
                  {plan.destacado && (
                    <span className="rounded-full bg-[color:var(--color-primary)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Popular
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                  {plan.descripcionCorta}
                </p>
                <div className="mt-3">
                  <span className="text-2xl font-bold text-[color:var(--color-primary)]">
                    ${precio.toFixed(2)}
                  </span>
                  <span className="text-[12px] text-[color:var(--color-text-muted)]">/mes</span>
                  {anual && plan.ahorroAnualPorcentaje > 0 && (
                    <div className="text-[11px] text-[color:var(--color-success)]">
                      Ahorra {plan.ahorroAnualPorcentaje}% al año
                    </div>
                  )}
                </div>
                <ul className="mt-3 flex-1 space-y-1.5 text-[12px]">
                  <LiP ok>{plan.maxSucursales ?? "∞"} sucursal(es)</LiP>
                  <LiP ok>{plan.maxUsuarios ?? "∞"} usuarios</LiP>
                  <LiP ok={plan.features.contabilidad}>Contabilidad</LiP>
                  <LiP ok={plan.features.modulo_nomina}>Nómina</LiP>
                  <LiP ok={plan.features.reportes_avanzados}>Reportes avanzados</LiP>
                  <LiP ok={plan.features.multi_sucursal}>Multi-sucursal</LiP>
                  <LiP ok={plan.features.ia_asistente}>IA integrada</LiP>
                </ul>
                {esActual ? (
                  <div className="mt-4 rounded-md bg-[color:var(--color-surface-2)] py-2 text-center text-small font-medium text-[color:var(--color-text-muted)]">
                    Plan actual
                  </div>
                ) : (
                  <a
                    href={`mailto:ventatormenta@gmail.com?subject=Cambio de plan a ${plan.nombre}`}
                    className="atria-btn atria-btn-primary mt-4 w-full justify-center"
                  >
                    Elegir {plan.nombre}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LiP({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <li className={cn("flex items-center gap-1.5", !ok && "text-[color:var(--color-text-muted)] line-through")}>
      <Check
        size={13}
        className={ok ? "text-[color:var(--color-success)]" : "text-[color:var(--color-border-strong)]"}
      />
      {children}
    </li>
  );
}
