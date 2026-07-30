"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Undo2 } from "lucide-react";
import { pagarDetalleNomina } from "@/lib/actions/rrhh";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

export function PagoDetalleControl({
  detalleId,
  estadoPago,
  bloqueadoPagado,
}: {
  detalleId: string;
  estadoPago: string;
  /** true cuando la nómina ya está pagada por completo (no se puede revertir). */
  bloqueadoPagado?: boolean;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [pending, startTransition] = useTransition();
  const pagado = estadoPago === "pagado";

  function toggle(pagar: boolean) {
    startTransition(async () => {
      const res = await pagarDetalleNomina(detalleId, pagar);
      if (!res.ok) return mostrar("error", res.error);
      mostrar("success", pagar ? "Recibo marcado como pagado" : "Recibo marcado como pendiente");
      router.refresh();
    });
  }

  if (bloqueadoPagado) {
    return <Badge variant="success">Pagado</Badge>;
  }

  if (pagado) {
    return (
      <button
        type="button"
        onClick={() => toggle(false)}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success)]/15 px-2.5 py-1 text-[12px] font-medium text-[color:var(--color-success)] hover:bg-[color:var(--color-success)]/25"
        title="Marcar como no pagado"
      >
        <Check size={12} /> Pagado
        <Undo2 size={11} className="opacity-70" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggle(true)}
      disabled={pending}
      className="arca-btn arca-btn-secondary arca-btn-sm"
    >
      <Check size={13} /> Pagar
    </button>
  );
}
