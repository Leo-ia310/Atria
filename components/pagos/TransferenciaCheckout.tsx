import { Building2, MessageCircle } from "lucide-react";
import type { Plan } from "@/lib/pricing";
import type { Ciclo } from "@/lib/suscripciones/core";

const SOPORTE_TRANSFERENCIA_WHATSAPP = "50589969483";
const SOPORTE_TRANSFERENCIA_LABEL = "+505 8996 9483";

export function TransferenciaCheckout({
  plan,
  ciclo,
  precio,
}: {
  plan: Plan;
  ciclo: Ciclo;
  precio: number;
}) {
  const mensaje = [
    "Hola, soporte de ARCA.",
    `Quiero comprar el plan ${plan.nombre} ${ciclo} por transferencia.`,
    `Monto: $${precio.toFixed(2)} USD.`,
    "Por favor compartanme los datos para realizar el pago.",
  ].join(" ");
  const href = `https://wa.me/${SOPORTE_TRANSFERENCIA_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;

  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
          <Building2 size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
            Transferencia
          </h3>
          <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--color-text-muted)]">
            Comunicate con soporte al {SOPORTE_TRANSFERENCIA_LABEL} para comprar este plan
            por transferencia.
          </p>
        </div>
      </div>

      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="arca-btn mt-4 w-full justify-center border border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/10 text-[color:var(--color-success)] hover:bg-[color:var(--color-success)]/15"
      >
        <MessageCircle size={16} />
        Pagar por transferencia
      </a>
    </div>
  );
}
