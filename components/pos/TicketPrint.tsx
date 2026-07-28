"use client";

import { useEffect } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { formatearMoneda, formatearFechaHora } from "@/lib/utils";
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

export function TicketPrint(props: TicketData) {
  useEffect(() => {
    if (props.autoPrint) {
      const t = setTimeout(() => window.print(), 350);
      return () => clearTimeout(t);
    }
  }, [props.autoPrint]);

  return (
    <div className="min-h-screen bg-[color:var(--color-neutral)] py-6 print:bg-white print:py-0">
      {/* Barra de acciones (no se imprime) */}
      <div className="mx-auto mb-4 flex max-w-[320px] items-center justify-between px-2 print:hidden">
        <Link
          href="/pos"
          className="atria-btn atria-btn-ghost atria-btn-sm"
        >
          <ArrowLeft size={14} /> Volver al POS
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="atria-btn atria-btn-primary atria-btn-sm"
        >
          <Printer size={14} /> Imprimir
        </button>
      </div>

      <div className="mx-auto flex max-w-[320px] flex-col gap-6 print:max-w-none print:gap-0">
        <Copia {...props} etiqueta="ORIGINAL — CLIENTE" />
        <div className="border-t border-dashed border-[color:var(--color-border)] print:break-before-page print:border-0" />
        <Copia {...props} etiqueta="COPIA — NEGOCIO" />
      </div>
    </div>
  );
}

function Copia(props: TicketData & { etiqueta: string }) {
  const { empresa, pais } = props;
  return (
    <div className="mx-auto w-[302px] bg-white p-4 font-mono text-[11px] leading-tight text-black shadow-sm print:w-full print:max-w-[302px] print:shadow-none">
      <div className="text-center">
        <div className="text-[13px] font-bold uppercase">{empresa.nombre}</div>
        {empresa.direccion && <div>{empresa.direccion}</div>}
        {empresa.telefono && <div>Tel: {empresa.telefono}</div>}
        <div>
          {empresa.idFiscalNombre}: {empresa.identificacionFiscal}
        </div>
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <div className="text-center text-[10px] font-semibold tracking-wide">
        {props.etiqueta}
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <div className="space-y-0.5">
        <Linea izq="Factura:" der={props.numero} />
        <Linea izq="Fecha:" der={formatearFechaHora(new Date(props.fecha))} />
        {props.cajero && <Linea izq="Cajero:" der={props.cajero} />}
        <Linea izq="Cliente:" der={props.cliente} />
        <Linea izq="Tipo:" der={props.esCredito ? "CRÉDITO" : "CONTADO"} />
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <table className="w-full">
        <thead>
          <tr className="border-b border-dashed border-black">
            <th className="py-0.5 text-left font-semibold">Cant Producto</th>
            <th className="py-0.5 text-right font-semibold">Importe</th>
          </tr>
        </thead>
        <tbody>
          {props.items.map((it, i) => (
            <tr key={i} className="align-top">
              <td className="py-0.5">
                <div>
                  {it.cantidad} x {formatearMoneda(it.precioUnitario, pais)}
                </div>
                <div className="truncate">{it.nombre}</div>
              </td>
              <td className="py-0.5 text-right">
                {formatearMoneda(it.subtotal, pais)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-2 border-t border-dashed border-black" />

      <div className="space-y-0.5">
        <Linea izq="Subtotal:" der={formatearMoneda(props.subtotal, pais)} />
        {props.descuento > 0 && (
          <Linea izq="Descuento:" der={`- ${formatearMoneda(props.descuento, pais)}`} />
        )}
        <Linea izq={`${props.impuestoNombre}:`} der={formatearMoneda(props.impuesto, pais)} />
        <div className="flex justify-between border-t border-black pt-1 text-[13px] font-bold">
          <span>TOTAL:</span>
          <span>{formatearMoneda(props.total, pais)}</span>
        </div>
      </div>

      {props.pagos.length > 0 && (
        <>
          <div className="my-2 border-t border-dashed border-black" />
          <div className="space-y-0.5">
            {props.pagos.map((p, i) => (
              <Linea
                key={i}
                izq={p.formaPago + (p.referencia ? ` (${p.referencia})` : "")}
                der={formatearMoneda(p.monto, pais)}
              />
            ))}
          </div>
        </>
      )}

      <div className="my-2 border-t border-dashed border-black" />
      <div className="text-center text-[10px]">
        ¡Gracias por su compra!
      </div>
    </div>
  );
}

function Linea({ izq, der }: { izq: string; der: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-black/70">{izq}</span>
      <span className="text-right font-medium">{der}</span>
    </div>
  );
}
