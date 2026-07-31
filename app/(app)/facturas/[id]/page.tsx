import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { facturas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getPaisConfig, type PaisCodigo } from "@/lib/paises";
import { reciboDesdeSnapshot } from "@/lib/facturas";
import { PageHeader } from "@/components/layout/PageHeader";
import { FacturaDetalleVista } from "@/components/facturas/FacturaDetalleVista";

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
      <FacturaDetalleVista data={recibo} />
    </div>
  );
}
