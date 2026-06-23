"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const PREGUNTAS = [
  {
    q: "¿Necesito conocimientos de contabilidad para usar ATRIA?",
    a: "No. ATRIA genera los asientos contables automáticamente con cada venta, compra o gasto. Tú vendes — el sistema cuadra. Tu contador puede revisar el libro diario cuando lo necesite.",
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
    q: "¿Para qué países está hecho ATRIA?",
    a: "Estamos diseñados para Latinoamérica: Honduras, Nicaragua, Guatemala, Costa Rica y El Salvador. Cada país tiene su moneda, impuesto, formato de identificación fiscal y catálogo de cuentas base.",
  },
  {
    q: "¿Qué pasa si supero los límites del plan?",
    a: "Te avisamos antes de que llegues al límite. Puedes mejorar de plan en cualquier momento sin perder datos. En Pro y Enterprise puedes pagar usuarios o sucursales adicionales por separado.",
  },
  {
    q: "¿Cómo cobran? ¿Qué métodos de pago aceptan?",
    a: "Cobramos mes a mes o anual (con 15% de descuento). Aceptamos tarjeta de crédito/débito y transferencia bancaria. Puedes cancelar en cualquier momento.",
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
    <div className="mx-auto max-w-3xl">
      {PREGUNTAS.map((p, i) => {
        const activo = abierto === i;
        return (
          <div
            key={p.q}
            className="border-b border-[color:var(--color-border)] py-1 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => setAbierto(activo ? null : i)}
              className="flex w-full items-center justify-between gap-6 py-4 text-left"
            >
              <span className="text-base font-medium text-[color:var(--color-text-primary)]">
                {p.q}
              </span>
              <span
                className={`flex-shrink-0 rounded-full p-1 text-[color:var(--color-text-muted)]`}
              >
                {activo ? <Minus size={16} /> : <Plus size={16} />}
              </span>
            </button>
            <div
              className={`grid overflow-hidden transition-all duration-300 ${
                activo ? "grid-rows-[1fr] pb-4" : "grid-rows-[0fr]"
              }`}
            >
              <p className="overflow-hidden text-small leading-relaxed text-[color:var(--color-text-secondary)]">
                {p.a}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
