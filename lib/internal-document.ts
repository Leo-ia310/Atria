import { sql } from "drizzle-orm";
import { currentBusinessContext } from "./business-context";
import type { PrintableDocument } from "./commercial-pdf";
import { allocateCents } from "./receivable-core";
import { posMoney } from "./pos-money";
export const internalReceiptLegend =
  "Comprobante interno / recibo de venta — no constituye documento fiscal.";
/** Captured only on creation, inside the existing sale transaction. Never backfill old invoices. */
export async function captureInternalDocument(branch: string) {
  const context = currentBusinessContext();
  if (!context) throw new Error("Falta transacción de venta.");
  const [row] = await context.tx.execute(
    sql`select e.razon_social as nombre,e.nombre_comercial as "nombreComercial",e.direccion,e.telefono,e.email,e.logo_url as "logoUrl",p.ruc,coalesce(p.perfil,'configuracion_pendiente') as "perfilFiscal",e.moneda,e.pais,s.nombre as sucursal from empresas e join sucursales s on s.empresa_id=e.id and s.id=${branch}::uuid left join perfiles_documentales p on p.empresa_id=e.id where e.id=${context.user.empresaId}::uuid`,
  );
  if (!row) throw new Error("Emisor o sucursal no disponible.");
  const { moneda, pais, sucursal, ...issuer } = row;
  return {
    schemaVersion: 1,
    clase: "comprobante_interno",
    fiscal: false,
    issuer,
    moneda,
    pais,
    sucursal,
    sucursalId: branch,
    serie: null,
    autorizacion: null,
    pie: internalReceiptLegend,
  };
}
/** No current company/profile fallback: historical metadata must remain historical. */
export function internalInvoicePrintable(row: {
  id: string;
  venta_id: string;
  numero: string;
  snapshot: unknown;
  estado: string;
  sucursal_id: string;
}): PrintableDocument {
  const s = row.snapshot as Record<string, unknown>,
    c = s.documentContext as Record<string, unknown> | undefined;
  if (
    !c ||
    c.schemaVersion !== 1 ||
    c.fiscal !== false ||
    !c.issuer ||
    typeof c.moneda !== "string"
  )
    throw new Error(
      "Este comprobante histórico no contiene el contexto documental congelado. Conserva su impresión original; no se reconstruirán datos fiscales actuales.",
    );
  const raw = Array.isArray(s.items)
    ? (s.items as Array<Record<string, unknown>>)
    : [];
  const global = posMoney(
    Number(s.descuento) - raw.reduce((a, i) => a + Number(i.descuento), 0),
  );
  if (global < 0)
    throw new Error("Los descuentos del comprobante no concilian.");
  const allocated = allocateCents(
    global,
    raw.map((i) => Number(i.subtotal)),
  );
  const items = raw.map((i, index) => ({
    nombre: String(i.nombre),
    productoId: typeof i.productoId === "string" ? i.productoId : undefined,
    cantidad: Number(i.cantidad),
    precioUnitario: Number(i.precioUnitario),
    descuento: posMoney(Number(i.descuento) + allocated[index]),
    tasa: Number(i.tasa ?? 0),
    subtotal: posMoney(Number(i.subtotal) - allocated[index]),
    impuesto: Number(i.impuesto),
    total: posMoney(Number(i.subtotal) - allocated[index] + Number(i.impuesto)),
  }));
  return {
    id: row.id,
    origenId: row.venta_id,
    kind: "comprobante_interno",
    numero: row.numero,
    version: 1,
    estado: "emitido",
    ventaId: row.venta_id,
    events: [],
    revisions: [],
    snapshot: {
      sucursalId: row.sucursal_id,
      clienteId: null,
      fecha: String(s.fechaLocal ?? String(s.fecha).slice(0, 10)),
      vigenteHasta: null,
      moneda: String(c.moneda),
      issuer: c.issuer as PrintableDocument["snapshot"]["issuer"],
      cliente: {
        nombre: String(s.cliente ?? "Consumidor final"),
        identificacion:
          typeof s.clienteIdentificacion === "string"
            ? s.clienteIdentificacion
            : null,
      },
      vendedor: String(s.cajero ?? ""),
      condicionesPago: s.esCredito ? "Crédito" : "Contado",
      condicionesComerciales: "",
      observaciones: internalReceiptLegend,
      items,
      amounts: {
        subtotal: Number(s.subtotal),
        descuentoTotal: Number(s.descuento),
        impuesto: Number(s.impuesto),
        total: Number(s.total),
        ingresoNeto:
          Math.round((Number(s.total) - Number(s.impuesto)) * 100) / 100,
      },
      documental: {
        schemaVersion: 1,
        clase: "comprobante_interno",
        fiscal: false,
        serie: null,
        autorizacion: null,
        ejemplar: "original",
        pie: internalReceiptLegend,
      },
    },
  };
}
