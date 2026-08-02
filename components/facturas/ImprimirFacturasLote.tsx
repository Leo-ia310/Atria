import Link from "next/link";
import { Printer } from "lucide-react";

export function ImprimirFacturasLote({
  href,
  total,
  label,
}: {
  href: string;
  total: number;
  label: string;
}) {
  if (total === 0) {
    return (
      <button type="button" disabled className="arca-btn arca-btn-secondary arca-btn-sm" title="No hay facturas imprimibles">
        <Printer size={14} /> {label}
      </button>
    );
  }

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="arca-btn arca-btn-secondary arca-btn-sm"
      title={`Preparar ${total} ${total === 1 ? "factura" : "facturas"} en una vista de impresión`}
    >
      <Printer size={14} /> {label}
    </Link>
  );
}
