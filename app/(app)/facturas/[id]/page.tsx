import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Receipt } from "lucide-react";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { asientosContables, facturas, ventas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getPaisConfig, type PaisCodigo } from "@/lib/paises";
import { reciboDesdeSnapshot } from "@/lib/facturas";
import { PageHeader } from "@/components/layout/PageHeader";
import { FacturaDetalleVista } from "@/components/facturas/FacturaDetalleVista";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export default async function FacturaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, requireSession()]);
  const [factura] = await db
    .select({
      id: facturas.id,
      numero: facturas.numero,
      fecha: facturas.fecha,
      ventaId: facturas.ventaId,
      cliente: facturas.clienteNombre,
      total: facturas.total,
      snapshot: facturas.snapshot,
    })
    .from(facturas)
    .where(and(eq(facturas.id, id), eq(facturas.empresaId, user.empresaId)))
    .limit(1);

  if (!factura) notFound();

  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const config = getPaisConfig(pais);
  const [venta] = await db
    .select({
      id: ventas.id,
      numero: ventas.numero,
      asientoId: ventas.asientoId,
    })
    .from(ventas)
    .where(and(eq(ventas.id, factura.ventaId), eq(ventas.empresaId, user.empresaId)))
    .limit(1);
  const [asiento] = venta
    ? await db
        .select({ id: asientosContables.id, numero: asientosContables.numero })
        .from(asientosContables)
        .where(
          and(
            eq(asientosContables.empresaId, user.empresaId),
            venta.asientoId
              ? or(
                  eq(asientosContables.id, venta.asientoId),
                  and(
                    eq(asientosContables.referenciaTabla, "ventas"),
                    eq(asientosContables.referenciaId, venta.id),
                  ),
                )
              : and(
                  eq(asientosContables.referenciaTabla, "ventas"),
                  eq(asientosContables.referenciaId, venta.id),
                ),
          ),
        )
        .limit(1)
    : [];
  const recibo = reciboDesdeSnapshot({
    snapshot: factura.snapshot as Record<string, unknown>,
    pais,
    impuestoNombre: config.impuestoNombre,
    empresa: {
      nombre: empresa?.nombreComercial || empresa?.razonSocial || "Mi Empresa",
      idFiscalNombre: config.idFiscalNombre,
      identificacionFiscal: empresa?.identificacionFiscal ?? "",
      direccion: empresa?.direccion ?? null,
      telefono: empresa?.telefono ?? null,
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Factura ${factura.numero}`}
        subtitle={`${factura.cliente ?? "Consumidor final"} - ${recibo.empresa.nombre}`}
      />
      <Card className="mb-4 print:hidden">
        <CardHeader title="Trazabilidad" />
        <CardBody className="flex flex-wrap gap-2 text-small">
          {venta && (
            <Link href={`/ventas/${venta.id}`} className="arca-btn arca-btn-secondary arca-btn-sm">
              <Receipt size={14} /> Venta {venta.numero}
            </Link>
          )}
          {asiento && (
            <Link href="/contabilidad/libro-diario" className="arca-btn arca-btn-secondary arca-btn-sm">
              <BookOpen size={14} /> Asiento {asiento.numero}
            </Link>
          )}
        </CardBody>
      </Card>
      <FacturaDetalleVista data={recibo} />
    </div>
  );
}
