"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { PLANES_ARRAY } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const VENTAJAS_POR_PLAN: Record<string, string[]> = {
  demo: [
    "Punto de venta básico",
    "Hasta 10 productos",
    "Hasta 50 transacciones al mes",
    "1 sucursal y 1 usuario",
    "Facturación básica",
  ],
  pro: [
    "Todo en Demo, sin límites de productos",
    "Contabilidad de partida doble automática",
    "Cotizaciones y notas de crédito",
    "Cuentas por cobrar y por pagar",
    "Gestión de proveedores y compras",
    "Reportes avanzados y exportación",
    "5 usuarios incluidos ($5/mes c/u extra)",
    "Soporte por chat",
  ],
  enterprise: [
    "Todo en Pro, sin compromisos",
    "Multi-sucursal (3 incluidas, +$30/mes c/u)",
    "Contabilidad consolidada por sucursal",
    "Transferencias de inventario entre sucursales",
    "10 usuarios incluidos ($5/mes c/u extra)",
    "API REST completa y webhooks",
    "Auditoría detallada y rol Auditor",
    "Soporte 24/7 + gerente de cuenta",
    "Onboarding 1-a-1 y SLA 99.9%",
  ],
};

export function PricingToggle() {
  const [ciclo, setCiclo] = useState<"mensual" | "anual">("mensual");

  return (
    <div>
      <div className="flex items-center justify-center gap-3">
        <div className="inline-flex rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1">
          {(["mensual", "anual"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCiclo(c)}
              className={cn(
                "rounded px-4 py-1.5 text-small transition",
                ciclo === c
                  ? "bg-[color:var(--color-primary)] font-medium text-white"
                  : "text-[color:var(--color-text-secondary)]",
              )}
            >
              {c === "mensual" ? "Mensual" : "Anual"}
            </button>
          ))}
        </div>
        {ciclo === "anual" && (
          <span className="atria-badge atria-badge-success">Ahorra 15%</span>
        )}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {PLANES_ARRAY.map((p) => {
          const precio = ciclo === "anual" ? p.precioAnualMensualizado : p.precioMensual;
          const ventajas = VENTAJAS_POR_PLAN[p.id] ?? [];
          return (
            <div
              key={p.id}
              className={cn(
                "flex flex-col rounded-lg border bg-[color:var(--color-surface)] p-7 transition",
                p.destacado
                  ? "border-[color:var(--color-primary)] shadow-[0_8px_30px_rgba(43,31,58,0.12)] ring-1 ring-[color:var(--color-primary)]/20 md:scale-105"
                  : "border-[color:var(--color-border)]",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">
                  {p.nombre}
                </h3>
                {p.destacado && (
                  <span className="atria-badge atria-badge-info">
                    <Sparkles size={10} /> Popular
                  </span>
                )}
              </div>
              <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
                {p.descripcionCorta}
              </p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-display text-[color:var(--color-text-primary)]">
                  ${precio.toFixed(precio % 1 === 0 ? 0 : 2)}
                </span>
                <span className="text-small text-[color:var(--color-text-muted)]">
                  {precio === 0 ? "/siempre" : "/mes"}
                </span>
              </div>
              {ciclo === "anual" && p.precioAnual > 0 && (
                <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                  Facturado anual: ${p.precioAnual.toFixed(2)}
                </p>
              )}
              {ciclo === "mensual" && p.precioMensual > 0 && (
                <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                  Sin contrato anual
                </p>
              )}

              <Link
                href={`/registro?plan=${p.id}&ciclo=${ciclo}`}
                className={cn(
                  "mt-6 atria-btn w-full justify-center",
                  p.destacado ? "atria-btn-primary" : "atria-btn-secondary",
                )}
              >
                {p.id === "demo" ? "Probar gratis" : `Empezar ${p.nombre}`}
              </Link>

              <ul className="mt-6 space-y-2.5 text-small">
                {ventajas.map((v) => (
                  <li key={v} className="flex items-start gap-2">
                    <Check
                      size={14}
                      className="mt-0.5 flex-shrink-0 text-[color:var(--color-success)]"
                    />
                    <span className="text-[color:var(--color-text-secondary)]">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
