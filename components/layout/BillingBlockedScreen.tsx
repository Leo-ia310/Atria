"use client";

import { useState } from "react";
import { CalendarClock, LockKeyhole, ShieldAlert } from "lucide-react";
import { PlanesModal } from "@/components/layout/PlanesModal";
import { formatearFecha } from "@/lib/utils";
import type { PlanId } from "@/lib/pricing";

export function BillingBlockedScreen({
  planNombre,
  planActualId,
  vencioISO,
  eliminaISO,
  diasGraciaRestantes,
}: {
  planNombre: string;
  planActualId: PlanId;
  vencioISO: string | null;
  eliminaISO: string | null;
  diasGraciaRestantes: number | null;
}) {
  const [planesAbierto, setPlanesAbierto] = useState(false);
  const vencioTexto = vencioISO ? formatearFecha(vencioISO) : "la fecha de corte";
  const eliminaTexto = eliminaISO ? formatearFecha(eliminaISO) : "el fin del periodo de gracia";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-170px)] max-w-2xl items-center justify-center">
      <div className="w-full rounded-lg border border-[color:var(--color-warning)]/30 bg-[color:var(--color-surface)] p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-warning-bg)] text-[color:var(--color-warning)]">
            <LockKeyhole size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[color:var(--color-text-primary)]">
              Cuenta bloqueada por pago pendiente
            </h1>
            <p className="mt-2 text-small leading-6 text-[color:var(--color-text-secondary)]">
              La prueba gratis de {planNombre} termino el {vencioTexto}. Para
              recuperar el acceso, completa el pago del plan.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
            <div className="flex items-center gap-2 text-small font-medium text-[color:var(--color-text-primary)]">
              <CalendarClock size={16} />
              Periodo de gracia
            </div>
            <p className="mt-2 text-[12px] leading-5 text-[color:var(--color-text-muted)]">
              Quedan {diasGraciaRestantes ?? 0} dias de gracia. Si no se paga antes
              del {eliminaTexto}, la informacion de la cuenta se eliminara.
            </p>
          </div>
          <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
            <div className="flex items-center gap-2 text-small font-medium text-[color:var(--color-text-primary)]">
              <ShieldAlert size={16} />
              Datos protegidos
            </div>
            <p className="mt-2 text-[12px] leading-5 text-[color:var(--color-text-muted)]">
              Durante la gracia no puedes operar modulos, pero todavia puedes pagar
              para desbloquear y conservar la informacion.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPlanesAbierto(true)}
          className="arca-btn arca-btn-primary mt-6 w-full justify-center sm:w-auto"
        >
          Pagar ahora
        </button>

        <PlanesModal
          abierto={planesAbierto}
          onCerrar={() => setPlanesAbierto(false)}
          planActual={planNombre}
          planActualId={planActualId}
          suscripcionEstado="vencida"
          suscripcionBloqueada
        />
      </div>
    </div>
  );
}
