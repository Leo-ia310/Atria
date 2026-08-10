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
  zonaHoraria?: string | null;
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
  copies?: 1 | 2;
};

export function imprimirRecibo(modo?: "simple" | "lote" | unknown) {
  const clase = modo === "lote" ? "imprimiendo-recibos-lote" : "imprimiendo-recibo";
  document.body.classList.add(clase);
  const cleanup = () => {
    document.body.classList.remove(clase);
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

export function TicketPrint(props: TicketData) {
  const copies = props.copies === 2 ? 2 : 1;
  useEffect(() => {
    if (props.autoPrint) {
      const t = setTimeout(
        () => imprimirRecibo(copies === 2 ? "lote" : "simple"),
        350,
      );
      return () => clearTimeout(t);
    }
  }, [props.autoPrint, copies]);

  const data: ReciboData = { ...props };
  const labels = copies === 2 ? (["Negocio", "Cliente"] as const) : (["Negocio"] as const);

  return (
    <div className="min-h-screen bg-[color:var(--color-neutral)] py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex w-[340px] max-w-full items-center justify-between px-1 print:hidden">
        <Link href="/pos" className="arca-btn arca-btn-ghost arca-btn-sm">
          <ArrowLeft size={14} /> Volver al POS
        </Link>
        <button
          type="button"
          onClick={() => imprimirRecibo(copies === 2 ? "lote" : "simple")}
          className="arca-btn arca-btn-primary arca-btn-sm"
        >
          <Printer size={14} /> Imprimir {copies}
        </button>
      </div>

      {copies === 1 ? (
        <div className="recibo-imprimible">
          <Recibo data={{ ...data, copiaNombre: "Negocio" }} />
        </div>
      ) : (
        <div className="recibos-lote-imprimible">
          {labels.map((label) => (
            <div key={label} className="recibo-lote-pagina">
              <Recibo data={{ ...data, copiaNombre: label }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
