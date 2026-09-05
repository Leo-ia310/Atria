"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DESCUENTO_ANUAL_PORCENTAJE } from "@/lib/pricing";

const PREGUNTAS = [
  {
    q: "¿Necesito conocimientos de contabilidad para usar ARCA?",
    a: "No. ARCA genera los asientos contables automáticamente con cada venta, compra o gasto. Tú vendes — el sistema cuadra. Tu contador puede revisar el libro diario cuando lo necesite.",
  },
  {
    q: "¿Funciona sin internet?",
    a: "El POS funciona en modo offline. Las ventas se guardan en el dispositivo y se sincronizan cuando vuelve la conexión. El inventario y los precios se mantienen cacheados.",
  },
  {
    q: "¿Puedo migrar mis datos desde Excel u otro sistema?",
    a: "Sí. Soportamos importación de productos, clientes y proveedores desde CSV/Excel. En el plan Enterprise incluimos onboarding 1-a-1 donde te ayudamos con la migración.",
  },
  {
    q: "¿Para qué países está hecho ARCA?",
    a: "Estamos diseñados para Honduras, Nicaragua, Guatemala, Costa Rica, El Salvador, Estados Unidos y México. Cada país tiene su moneda, impuesto, formato de identificación fiscal y catálogo de cuentas base.",
  },
  {
    q: "¿Qué pasa si supero los límites del plan?",
    a: "Te avisamos antes de que llegues al límite. Puedes mejorar de plan en cualquier momento sin perder datos. En Pro y Enterprise puedes pagar usuarios o sucursales adicionales por separado.",
  },
  {
    q: "¿Cómo cobran? ¿Qué métodos de pago aceptan?",
    a: `Cobramos mes a mes o anual (con ${DESCUENTO_ANUAL_PORCENTAJE}% de descuento). Aceptamos tarjeta de crédito/débito y transferencia bancaria. Puedes cancelar en cualquier momento.`,
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Sí. Encriptación en tránsito y reposo, copias de seguridad diarias, aislamiento por empresa con Row-Level Security a nivel de base de datos. Tú eres dueño de tus datos y puedes exportarlos cuando quieras.",
  },
  {
    q: "¿Puedo usarlo en mi celular o tablet?",
    a: "Sí. La interfaz es responsive — funciona en cualquier dispositivo con navegador moderno. El POS está optimizado para tablets de 10\" y monitores táctiles, pero también opera en computadora.",
  },
];

export function FAQ() {
  const [abierto, setAbierto] = useState<number | null>(0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      {PREGUNTAS.map((p, i) => {
        const activo = abierto === i;
        return (
          <div
            key={p.q}
            className={`group overflow-hidden rounded-[14px] border transition-all duration-300 ${
              activo
                ? "border-[#a78bfa]/50 bg-[linear-gradient(160deg,rgba(124,58,237,0.16),rgba(37,99,235,0.08))] shadow-[0_18px_50px_rgba(124,58,237,0.22)]"
                : "border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.06]"
            }`}
          >
            <button
              type="button"
              onClick={() => setAbierto(activo ? null : i)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left"
            >
              <span
                className={`text-[13px] font-bold tabular-nums transition-colors ${
                  activo ? "text-[#c4b5fd]" : "text-white/35"
                }`}
              >
                0{i + 1}
              </span>
              <span className="flex-1 text-[15px] font-medium text-white">{p.q}</span>
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                  activo
                    ? "rotate-[135deg] bg-[linear-gradient(135deg,#7c3aed,#2563eb)] text-white"
                    : "bg-white/10 text-white/60 group-hover:bg-white/15"
                }`}
              >
                <Plus size={15} />
              </span>
            </button>
            <div
              className={`grid transition-all duration-300 ease-out ${
                activo ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 pl-[52px] text-[14px] leading-relaxed text-white/65">
                  {p.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
