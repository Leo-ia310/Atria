import type { ReciboData } from "@/components/pos/Recibo";
import type { PaisCodigo } from "@/lib/paises";

type EmpresaRecibo = ReciboData["empresa"];

export function reciboDesdeSnapshot({
  snapshot,
  pais,
  empresa,
  impuestoNombre,
}: {
  snapshot: Record<string, unknown>;
  pais: PaisCodigo;
  empresa: EmpresaRecibo;
  impuestoNombre: string;
}): ReciboData {
  const items = Array.isArray(snapshot.items)
    ? (snapshot.items as Record<string, unknown>[])
    : [];
  const pagos = Array.isArray(snapshot.pagos)
    ? (snapshot.pagos as Record<string, unknown>[])
    : [];

  return {
    documentType: snapshot.documentType === "internal_receipt" ? "internal_receipt" : undefined,
    pais,
    empresa,
    numero: String(snapshot.numero ?? ""),
    fecha: String(snapshot.fecha ?? new Date().toISOString()),
    zonaHoraria:
      snapshot.zonaHoraria != null ? String(snapshot.zonaHoraria) : undefined,
    cajero: snapshot.cajero != null ? String(snapshot.cajero) : null,
    cliente: String(snapshot.cliente ?? "Consumidor final"),
    esCredito: Boolean(snapshot.esCredito),
    impuestoNombre,
    items: items.map((it) => ({
      nombre: String(it.nombre ?? "Producto"),
      sku: it.sku != null ? String(it.sku) : "",
      cantidad: Number(it.cantidad ?? 0),
      precioUnitario: Number(it.precioUnitario ?? 0),
      subtotal: Number(it.subtotal ?? 0),
    })),
    pagos: pagos.map((p) => ({
      formaPago: String(p.formaPago ?? "Otro")+(p.paymentSource==="bank_transfer_pending"?(p.paymentStatus==="verified"?" · Abono verificado":p.paymentStatus==="rejected"?" · Rechazada; saldo por cobrar":" · Pendiente de verificación; no es dinero recibido"):""),
      monto: Number(p.monto ?? 0),
      referencia: p.referencia != null ? String(p.referencia) : null,
    })),
    subtotal: Number(snapshot.subtotal ?? 0),
    descuento: Number(snapshot.descuento ?? 0),
    impuesto: Number(snapshot.impuesto ?? 0),
    total: Number(snapshot.total ?? 0),
  };
}
