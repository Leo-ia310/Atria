import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, BookOpen } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ventas,
  ventaDetalle,
  pagosVenta,
  productos,
  formasPago,
  clientes,
  empresas,
  asientosContables,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatearMoneda, formatearFechaHora } from "@/lib/utils";

export default async function VentaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSession();

  const [venta] = await db
    .select({
      id: ventas.id,
      numero: ventas.numero,
      fecha: ventas.fecha,
      estado: ventas.estado,
      esCredito: ventas.esCredito,
      subtotal: ventas.subtotal,
      descuento: ventas.descuento,
      impuesto: ventas.impuesto,
      total: ventas.total,
      notas: ventas.notas,
      asientoId: ventas.asientoId,
      cliente: clientes.nombre,
    })
    .from(ventas)
    .leftJoin(clientes, eq(clientes.id, ventas.clienteId))
    .where(and(eq(ventas.id, id), eq(ventas.empresaId, user.empresaId)))
    .limit(1);

  if (!venta) notFound();

  const [empresa] = await db
    .select({ pais: empresas.pais })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);
  const pais = empresa?.pais ?? "NI";

  const items = await db
    .select({
      cantidad: ventaDetalle.cantidad,
      precioUnitario: ventaDetalle.precioUnitario,
      subtotal: ventaDetalle.subtotal,
      impuesto: ventaDetalle.impuesto,
      nombre: productos.nombre,
      sku: productos.sku,
    })
    .from(ventaDetalle)
    .innerJoin(productos, eq(productos.id, ventaDetalle.productoId))
    .where(eq(ventaDetalle.ventaId, venta.id));

  const pagos = await db
    .select({
      monto: pagosVenta.monto,
      referencia: pagosVenta.referencia,
      formaPago: formasPago.nombre,
    })
    .from(pagosVenta)
    .innerJoin(formasPago, eq(formasPago.id, pagosVenta.formaPagoId))
    .where(eq(pagosVenta.ventaId, venta.id));

  const asiento = venta.asientoId
    ? (
        await db
          .select({ numero: asientosContables.numero, id: asientosContables.id })
          .from(asientosContables)
          .where(eq(asientosContables.id, venta.asientoId))
          .limit(1)
      )[0]
    : null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/ventas"
        className="inline-flex items-center gap-1 text-small text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
      >
        <ArrowLeft size={14} /> Volver al historial
      </Link>
      <PageHeader
        title={`Venta ${venta.numero}`}
        subtitle={formatearFechaHora(venta.fecha)}
        actions={
          venta.estado === "anulada" ? (
            <Badge variant="error">Anulada</Badge>
          ) : (
            <Badge variant="success">Completada</Badge>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Productos vendidos" />
          <CardBody>
            <table className="w-full text-small">
              <thead className="border-b border-[color:var(--color-border)]">
                <tr className="text-label">
                  <th className="px-2 py-2 text-left">Producto</th>
                  <th className="px-2 py-2 text-right">Cant.</th>
                  <th className="px-2 py-2 text-right">Precio</th>
                  <th className="px-2 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-[color:var(--color-border)] last:border-b-0">
                    <td className="px-2 py-2">
                      <div className="font-medium">{it.nombre}</div>
                      <div className="text-[11px] text-[color:var(--color-text-muted)]">
                        {it.sku}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right">{parseFloat(it.cantidad).toFixed(0)}</td>
                    <td className="px-2 py-2 text-right">
                      {formatearMoneda(parseFloat(it.precioUnitario), pais)}
                    </td>
                    <td className="px-2 py-2 text-right font-medium">
                      {formatearMoneda(parseFloat(it.subtotal), pais)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Totales" />
          <CardBody className="space-y-2 text-small">
            <Fila label="Cliente" valor={venta.cliente ?? "Consumidor final"} />
            <Fila
              label="Tipo"
              valor={venta.esCredito ? "Crédito" : "Contado"}
            />
            <hr className="border-[color:var(--color-border)]" />
            <Fila label="Subtotal" valor={formatearMoneda(parseFloat(venta.subtotal), pais)} />
            {parseFloat(venta.descuento) > 0 && (
              <Fila label="Descuento" valor={`- ${formatearMoneda(parseFloat(venta.descuento), pais)}`} />
            )}
            <Fila label="Impuesto" valor={formatearMoneda(parseFloat(venta.impuesto), pais)} />
            <hr className="border-[color:var(--color-border)]" />
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-label">Total</span>
              <span className="text-lg font-bold text-[color:var(--color-primary)]">
                {formatearMoneda(parseFloat(venta.total), pais)}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Pagos recibidos" />
          <CardBody>
            {pagos.length === 0 ? (
              <p className="text-small text-[color:var(--color-text-muted)]">
                Sin pagos registrados (venta al crédito)
              </p>
            ) : (
              <table className="w-full text-small">
                <tbody>
                  {pagos.map((p, i) => (
                    <tr key={i} className="border-b border-[color:var(--color-border)] last:border-b-0">
                      <td className="px-2 py-2 font-medium">{p.formaPago}</td>
                      <td className="px-2 py-2 text-[color:var(--color-text-muted)]">
                        {p.referencia ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold">
                        {formatearMoneda(parseFloat(p.monto), pais)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Trazabilidad" />
          <CardBody className="space-y-3 text-small">
            <div className="flex items-center gap-2 text-[color:var(--color-text-muted)]">
              <FileText size={14} />
              <span>Documento: {venta.numero}</span>
            </div>
            {asiento ? (
              <Link
                href="/contabilidad/libro-diario"
                className="flex items-center gap-2 text-[color:var(--color-secondary)] hover:underline"
              >
                <BookOpen size={14} />
                Asiento {asiento.numero}
              </Link>
            ) : (
              <span className="text-[color:var(--color-text-muted)]">
                Sin asiento contable ligado
              </span>
            )}
            {venta.notas && (
              <div className="rounded-md bg-[color:var(--color-surface-2)] p-2 text-[color:var(--color-text-muted)]">
                {venta.notas}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[color:var(--color-text-muted)]">{label}</span>
      <span className="font-medium text-[color:var(--color-text-primary)]">{valor}</span>
    </div>
  );
}
