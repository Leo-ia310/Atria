"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Recibo, type ReciboData } from "@/components/pos/Recibo";
import { imprimirRecibo } from "@/components/pos/TicketPrint";

export function FacturaDetalleVista({ data }: { data: ReciboData }) {
  const volverHref = data.esCredito ? "/facturas/credito" : "/facturas/cobradas";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href={volverHref} className="arca-btn arca-btn-ghost arca-btn-sm">
          <ArrowLeft size={14} /> Volver
        </Link>
        <button
          type="button"
          onClick={imprimirRecibo}
          className="arca-btn arca-btn-primary arca-btn-sm"
        >
          <Printer size={14} /> Imprimir
        </button>
      </div>
      <div className="recibo-imprimible">
        <Recibo data={data} />
      </div>
    </div>
  );
}
