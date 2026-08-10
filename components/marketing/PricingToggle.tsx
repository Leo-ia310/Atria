"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import {
  DESCUENTO_ANUAL_PORCENTAJE,
  DIAS_TRIAL_PLAN_PAGO,
  PLANES_ARRAY,
  PROMO_LANZAMIENTO,
  descuentoPromoPorcentaje,
  precioPromocional,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

const VENTAJAS_POR_PLAN: Record<string, string[]> = {
  demo: [
    "Punto de venta completo",
    "Hasta 25 productos",
    "Hasta 50 transacciones al mes",
    "Hasta 20 clientes",
    "Hasta 10 facturas al mes",
    "1 sucursal",
    "1 usuario",
  ],
  pro: [
    "15 dias gratis antes de pagar",
    "Todo en Demo, sin limites de productos",
    "Contabilidad de partida doble automatica",
    "Nomina incluida para tu equipo",
    "Cotizaciones y notas de credito",
    "Cuentas por cobrar y por pagar",
    "Gestion de proveedores y compras",
    "Roles y permisos granulares",
    "Reportes avanzados y exportacion",
    "7 usuarios incluidos ($5/mes c/u extra)",
    "Soporte por chat",
  ],
  enterprise: [
    "15 dias gratis antes de pagar",
    "Todo en Pro para operacion corporativa",
    "Multi-sucursal (5 incluidas, +$30/mes c/u)",
    "Contabilidad consolidada por sucursal",
    "Transferencias de inventario entre sucursales",
    "IA integrada para asistencia, reportes y predicciones",
    "20 usuarios incluidos ($5/mes c/u extra)",
    "API REST completa y webhooks",
    "Auditoria detallada y rol Auditor",
    "White label y exportacion de datos",
    "Soporte 24/7 + gerente de cuenta",
    "Onboarding 1-a-1 y SLA 99.9%",
  ],
};

export function PricingToggle() {
  const [ciclo, setCiclo] = useState<"mensual" | "anual">("mensual");

  return (
    <div>
      <div className="flex items-center justify-center gap-3">
        <div className="inline-flex rounded-full border border-white/15 bg-[#1b0d31]/90 p-1">
          {(["mensual", "anual"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCiclo(c)}
              className={cn(
                "rounded-full px-5 py-1.5 text-[13px] transition",
                ciclo === c
                  ? "bg-[linear-gradient(135deg,#7c3aed,#2563eb)] font-medium text-white shadow-[0_6px_18px_rgba(124,58,237,0.4)]"
                  : "text-white/60 hover:text-white",
              )}
            >
              {c === "mensual" ? "Mensual" : "Anual"}
            </button>
          ))}
        </div>
        {ciclo === "anual" && (
          <span className="rounded-full bg-[#052e1b] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#34d399]">
            Ahorra {DESCUENTO_ANUAL_PORCENTAJE}%
          </span>
        )}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {PLANES_ARRAY.map((p) => {
          const precioNormal = ciclo === "anual" ? p.precioAnualMensualizado : p.precioMensual;
          const promo = ciclo === "mensual" ? precioPromocional(p.id) : null;
          const promoPorcentaje = promo !== null ? descuentoPromoPorcentaje(p.id) : null;
          const precio = promo ?? precioNormal;
          const ventajas = VENTAJAS_POR_PLAN[p.id] ?? [];
          return (
            <div
              key={p.id}
              className={cn(
                "arca-gradborder h-full transition-transform duration-500",
                p.destacado && "fast md:scale-105",
              )}
            >
              <div
                className={cn(
                  "flex h-full flex-col p-7",
                  p.destacado
                    ? "bg-[linear-gradient(165deg,#241145,#160a2b)] shadow-[0_20px_60px_rgba(124,58,237,0.35)]"
                    : "bg-[linear-gradient(165deg,#180d2b,#120820)]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[18px] font-semibold text-white">{p.nombre}</h3>
                  <div className="flex items-center gap-1.5">
                    {p.id !== "demo" && (
                      <span className="inline-flex items-center rounded-full bg-[#052e1b] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#34d399]">
                        {DIAS_TRIAL_PLAN_PAGO} dias gratis
                      </span>
                    )}
                    {promoPorcentaje !== null && (
                      <span className="inline-flex items-center rounded-full bg-[#052e1b] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#34d399]">
                        -{promoPorcentaje}% x {PROMO_LANZAMIENTO.meses} meses
                      </span>
                    )}
                    {p.destacado && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[linear-gradient(135deg,#7c3aed,#2563eb)] px-2.5 py-1 text-[11px] font-semibold text-white">
                        <Sparkles size={11} /> Popular
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-[13px] text-white/55">{p.descripcionCorta}</p>

                <div className="mt-5 flex items-baseline gap-1.5">
                  {promo !== null && (
                    <span className="text-[16px] font-medium text-white/40 line-through">
                      ${precioNormal.toFixed(2)}
                    </span>
                  )}
                  <span className="text-[44px] font-bold leading-none text-white">
                    ${precio === 0 ? "0" : precio.toFixed(2)}
                  </span>
                  <span className="text-[13px] text-white/50">
                    {precio === 0 ? "/siempre" : "/mes"}
                  </span>
                </div>
                {promo !== null ? (
                  <p className="mt-1 text-[12px] text-white/45">
                    {DIAS_TRIAL_PLAN_PAGO} dias gratis. Luego ${promo.toFixed(2)}/mes por {PROMO_LANZAMIENTO.meses} meses.
                  </p>
                ) : (
                  <>
                    {ciclo === "anual" && p.precioAnual > 0 && (
                      <p className="mt-1 text-[12px] text-white/45">
                        {DIAS_TRIAL_PLAN_PAGO} dias gratis. Luego facturado anual: ${p.precioAnual.toFixed(2)}
                      </p>
                    )}
                    {ciclo === "mensual" && p.precioMensual > 0 && (
                      <p className="mt-1 text-[12px] text-white/45">Sin contrato anual</p>
                    )}
                  </>
                )}

                <Link
                  href={`/registro?plan=${p.id}&ciclo=${ciclo}`}
                  className={cn(
                    "arca-btn arca-btn-lg mt-6 w-full justify-center transition hover:-translate-y-0.5",
                    p.destacado
                      ? "bg-white text-[#160827] hover:bg-[#efe7ff]"
                      : "border border-white/20 bg-white/5 text-white hover:bg-white/12",
                  )}
                >
                  {p.id === "demo" ? "Explorar Demo" : `Probar ${p.nombre} gratis`}
                </Link>

                <ul className="mt-6 space-y-2.5 text-[13px]">
                  {ventajas.map((v) => (
                    <li key={v} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#052e1b]">
                        <Check size={11} className="text-[#34d399]" />
                      </span>
                      <span className="text-white/70">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
