import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function DemoNoticeBanner() {
  return (
    <div className="flex items-center gap-3 border-b border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning-bg)] px-6 py-2.5 text-small text-[color:var(--color-warning)]">
      <AlertTriangle size={16} className="flex-shrink-0" />
      <p className="flex-1">
        <strong className="font-semibold">Cuenta Demo:</strong> estos datos son de prueba
        y se borran automáticamente cada 3 días. Cuando quieras conservarlos, actualiza a
        un plan pago.
      </p>
      <Link
        href="/configuracion/facturacion"
        className="flex-shrink-0 font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
      >
        Actualizar plan
      </Link>
    </div>
  );
}
