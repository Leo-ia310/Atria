import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function DemoNoticeBanner() {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning-bg)] px-4 py-2.5 text-small text-[color:var(--color-warning)] sm:px-6">
      <AlertTriangle size={16} className="flex-shrink-0" />
      <p className="min-w-0 flex-1">
        <strong className="font-semibold">Cuenta Demo:</strong> es gratis y permanente:
        punto de venta completo, 25 productos, 50 transacciones al mes, 20 clientes y
        10 facturas al mes. Para operar sin topes, actualiza a un plan pago.
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
