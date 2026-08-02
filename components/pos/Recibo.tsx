import { formatearMoneda, formatearFechaHora } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

export type ReciboItem = {
  nombre: string;
  sku?: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

export type ReciboPago = {
  formaPago: string;
  monto: number;
  referencia?: string | null;
};

export type ReciboData = {
  pais: PaisCodigo;
  empresa: {
    nombre: string;
    idFiscalNombre: string;
    identificacionFiscal: string;
    direccion?: string | null;
    telefono?: string | null;
  };
  numero: string;
  fecha: string;
  cajero?: string | null;
  cliente: string;
  esCredito: boolean;
  impuestoNombre: string;
  items: ReciboItem[];
  pagos: ReciboPago[];
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  copiaNombre?: string;
};

/**
 * Factura / recibo de una sola copia (negocio), estilizado como documento
 * compacto. Reutilizable para impresión, preview y modal.
 */
export function Recibo({ data }: { data: ReciboData }) {
  const { empresa, pais } = data;
  return (
    <div className="mx-auto w-[340px] max-w-full rounded-lg border border-[color:var(--color-border)] bg-white p-5 text-[13px] leading-snug text-[color:var(--color-text-primary)] shadow-sm">
      {/* Encabezado empresa */}
      <div className="text-center">
        <div className="text-[15px] font-bold uppercase tracking-tight">
          {empresa.nombre}
        </div>
        {empresa.direccion && (
          <div className="text-[11px] text-[color:var(--color-text-muted)]">
            {empresa.direccion}
          </div>
        )}
        <div className="text-[11px] text-[color:var(--color-text-muted)]">
          {empresa.telefono ? `Tel: ${empresa.telefono} · ` : ""}
          {empresa.idFiscalNombre}: {empresa.identificacionFiscal}
        </div>
      </div>

      <div className="my-3 flex items-center justify-between rounded-md bg-[color:var(--color-surface-2)] px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Copia · {data.copiaNombre ?? "Negocio"}
        </span>
        <span className="text-[12px] font-bold">{data.numero}</span>
      </div>

      {/* Meta */}
      <div className="space-y-0.5 text-[12px]">
        <Linea izq="Fecha" der={formatearFechaHora(data.fecha)} />
        {data.cajero && <Linea izq="Cajero" der={data.cajero} />}
        <Linea izq="Cliente" der={data.cliente} />
        <Linea izq="Tipo" der={data.esCredito ? "Crédito" : "Contado"} />
      </div>

      <div className="my-3 border-t border-dashed border-[color:var(--color-border)]" />

      {/* Items */}
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-[color:var(--color-border)] text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
            <th className="py-1 text-left font-semibold">Producto</th>
            <th className="py-1 text-right font-semibold">Importe</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={i} className="align-top">
              <td className="py-1 pr-2">
                <div className="font-medium">{it.nombre}</div>
                <div className="text-[11px] text-[color:var(--color-text-muted)]">
                  {it.cantidad} × {formatearMoneda(it.precioUnitario, pais)}
                </div>
              </td>
              <td className="py-1 text-right font-medium">
                {formatearMoneda(it.subtotal, pais)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-3 border-t border-dashed border-[color:var(--color-border)]" />

      {/* Totales */}
      <div className="space-y-0.5 text-[12px]">
        <Linea izq="Subtotal" der={formatearMoneda(data.subtotal, pais)} />
        {data.descuento > 0 && (
          <Linea izq="Descuento" der={`- ${formatearMoneda(data.descuento, pais)}`} />
        )}
        <Linea izq={data.impuestoNombre} der={formatearMoneda(data.impuesto, pais)} />
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-[color:var(--color-text-primary)] pt-2">
        <span className="text-[14px] font-bold">TOTAL</span>
        <span className="text-[16px] font-bold text-[color:var(--color-primary)]">
          {formatearMoneda(data.total, pais)}
        </span>
      </div>

      {data.pagos.length > 0 && (
        <>
          <div className="my-3 border-t border-dashed border-[color:var(--color-border)]" />
          <div className="space-y-0.5 text-[12px]">
            {data.pagos.map((p, i) => (
              <Linea
                key={i}
                izq={p.formaPago + (p.referencia ? ` (${p.referencia})` : "")}
                der={formatearMoneda(p.monto, pais)}
              />
            ))}
          </div>
        </>
      )}

      <div className="mt-4 text-center text-[11px] text-[color:var(--color-text-muted)]">
        ¡Gracias por su compra!
      </div>
    </div>
  );
}

function Linea({ izq, der }: { izq: string; der: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[color:var(--color-text-muted)]">{izq}</span>
      <span className="text-right font-medium">{der}</span>
    </div>
  );
}
