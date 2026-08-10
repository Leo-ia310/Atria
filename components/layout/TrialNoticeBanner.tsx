"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { PlanesModal } from "@/components/layout/PlanesModal";
import { formatearFecha } from "@/lib/utils";
import type { PlanId } from "@/lib/pricing";

export function TrialNoticeBanner({
  planNombre,
  planActualId,
  finISO,
}: {
  planNombre: string;
  planActualId: PlanId;
  finISO: string;
}) {
  const [planesAbierto, setPlanesAbierto] = useState(false);
  const finTexto = formatearFecha(finISO);

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--color-info)]/25 bg-[color:var(--color-info-bg)] px-4 py-2.5 text-small text-[color:var(--color-info)] sm:px-6">
      <CalendarClock size={16} className="flex-shrink-0" />
      <p className="min-w-0 flex-1">
        <strong className="font-semibold">Prueba gratis de {planNombre}:</strong>{" "}
        termina el {finTexto}. Puedes usar el plan sin pagar hasta esa fecha; si no pagas
        despues, la cuenta se bloqueara y entrara en 7 dias de gracia.
      </p>
      <button
        type="button"
        onClick={() => setPlanesAbierto(true)}
        className="flex-shrink-0 font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
      >
        Ver planes
      </button>

      <PlanesModal
        abierto={planesAbierto}
        onCerrar={() => setPlanesAbierto(false)}
        planActual={planNombre}
        planActualId={planActualId}
        suscripcionEstado="trial"
        suscripcionFinISO={finISO}
      />
    </div>
  );
}
