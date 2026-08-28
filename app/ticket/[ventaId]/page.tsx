import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ventas, ventaDetalle, pagosVenta, productos, formasPago, clientes, usuarios } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { requireModulo } from "@/lib/server-access";
import { getPaisConfig, type PaisCodigo } from "@/lib/paises";
import { TicketPrint } from "@/components/pos/TicketPrint";

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ ventaId: string }>;
  searchParams: Promise<{ print?: string; copies?: string }>;
}) {
  const [{ ventaId }, { print, copies }, user] = await Promise.all([
    params,
    searchParams,
    requireSession(),
  ]);
  const copias = copies === "2" ? 2 : 1;
  await requireModulo(user, "ventas");

  const [venta] = await db
    .select({
      id: ventas.id,
      numero: ventas.numero,
      fecha: ventas.fecha,
      esCredito: ventas.esCredito,
      subtotal: ventas.subtotal,
      descuento: ventas.descuento,
      impuesto: ventas.impuesto,
      total: ventas.total,
      cliente: clientes.nombre,
      cajero: usuarios.nombre,
    })
    .from(ventas)
    .leftJoin(clientes, eq(clientes.id, ventas.clienteId))
    .leftJoin(usuarios, eq(usuarios.id, ventas.usuarioId))
    .where(and(eq(ventas.id, ventaId), eq(ventas.empresaId, user.empresaId)))
    .limit(1);

  if (!venta) notFound();

  const [empresa, items, pagos] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    db
      .select({
        cantidad: ventaDetalle.cantidad,
        precioUnitario: ventaDetalle.precioUnitario,
        subtotal: ventaDetalle.subtotal,
        nombre: productos.nombre,
        sku: productos.sku,
      })
      .from(ventaDetalle)
      .innerJoin(productos, eq(productos.id, ventaDetalle.productoId))
      .where(eq(ventaDetalle.ventaId, venta.id)),
    db
      .select({
        monto: pagosVenta.monto,
        referencia: pagosVenta.referencia,
        formaPago: formasPago.nombre,
      })
      .from(pagosVenta)
      .innerJoin(formasPago, eq(formasPago.id, pagosVenta.formaPagoId))
      .where(eq(pagosVenta.ventaId, venta.id)),
  ]);

  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const config = getPaisConfig(pais);

  return (
    <TicketPrint
      pais={pais}
      autoPrint={print === "1"}
      copies={copias}
      empresa={{
        nombre: empresa?.nombreComercial || empresa?.razonSocial || "Mi Empresa",
        idFiscalNombre: config.idFiscalNombre,
        identificacionFiscal: empresa?.identificacionFiscal ?? "",
        direccion: empresa?.direccion ?? null,
        telefono: empresa?.telefono ?? null,
      }}
      numero={venta.numero}
      fecha={venta.fecha.toISOString()}
      zonaHoraria={empresa?.zonaHoraria}
      cajero={venta.cajero}
      cliente={venta.cliente ?? "Consumidor final"}
      esCredito={venta.esCredito}
      impuestoNombre={config.impuestoNombre}
      items={items.map((it) => ({
        nombre: it.nombre,
        sku: it.sku,
        cantidad: parseFloat(it.cantidad),
        precioUnitario: parseFloat(it.precioUnitario),
        subtotal: parseFloat(it.subtotal),
      }))}
      pagos={pagos.map((p) => ({
        formaPago: p.formaPago,
        monto: parseFloat(p.monto),
        referencia: p.referencia,
      }))}
      subtotal={parseFloat(venta.subtotal)}
      descuento={parseFloat(venta.descuento)}
      impuesto={parseFloat(venta.impuesto)}
      total={parseFloat(venta.total)}
    />
  );
}
