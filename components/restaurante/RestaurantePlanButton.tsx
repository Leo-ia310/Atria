"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { PlanesModal } from "@/components/layout/PlanesModal";
import type { PlanId } from "@/lib/pricing";

export function RestaurantePlanButton({
  planNombre,
  planActualId,
  suscripcionEstado,
  suscripcionFinISO,
  suscripcionBloqueada,
}: {
  planNombre: string;
  planActualId?: PlanId;
  suscripcionEstado?: "activa" | "trial" | "vencida" | "cancelada" | "suspendida" | null;
  suscripcionFinISO?: string | null;
  suscripcionBloqueada?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="arca-btn arca-btn-primary arca-btn-sm"
      >
        <CreditCard size={14} />
        Ver planes
      </button>
      <PlanesModal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        planActual={planNombre}
        planActualId={planActualId}
        suscripcionEstado={suscripcionEstado}
        suscripcionFinISO={suscripcionFinISO}
        suscripcionBloqueada={suscripcionBloqueada}
      />
    </>
  );
}
