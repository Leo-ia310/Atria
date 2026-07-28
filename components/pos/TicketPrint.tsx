"use client";

import { useEffect } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Recibo, type ReciboData } from "@/components/pos/Recibo";
import type { PaisCodigo } from "@/lib/paises";

type ItemTicket = {
  nombre: string;
  sku: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

type PagoTicket = {
  formaPago: string;
  monto: number;
  referencia: string | null;
};

export type TicketData = {
  pais: PaisCodigo;
  empresa: {
    nombre: string;
    idFiscalNombre: string;
    identificacionFiscal: string;
    direccion: string | null;
    telefono: string | null;
  };
  numero: string;
  fecha: string;
  cajero: string | null;
  cliente: string;
  esCredito: boolean;
  items: ItemTicket[];
  pagos: PagoTicket[];
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  impuestoNombre: string;
  autoPrint?: boolean;
};

export function imprimirRecibo() {
  document.body.classList.add("imprimiendo-recibo");
  const cleanup = () => {
    document.body.classList.remove("imprimiendo-recibo");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

export function TicketPrint(props: TicketData) {
  useEffect(() => {
    if (props.autoPrint) {
      const t = setTimeout(() => imprimirRecibo(), 350);
      return () => clearTimeout(t);
    }
  }, [props.autoPrint]);

  const data: ReciboData = { ...props };

  return (
    <div className="min-h-screen bg-[color:var(--color-neutral)] py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex w-[340px] max-w-full items-center justify-between px-1 print:hidden">
        <Link href="/pos" className="atria-btn atria-btn-ghost atria-btn-sm">
          <ArrowLeft size={14} /> Volver al POS
        </Link>
        <button
          type="button"
          onClick={imprimirRecibo}
          className="atria-btn atria-btn-primary atria-btn-sm"
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
