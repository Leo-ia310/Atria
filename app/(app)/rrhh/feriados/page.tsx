import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { feriados } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackLink } from "@/components/layout/BackLink";
import { FeriadosManager } from "@/components/rrhh/FeriadosManager";
import { getPaisConfig } from "@/lib/paises";

export default async function FeriadosPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  const { anio } = await searchParams;
  const user = await requireSession();
  const year =
    anio && /^\d{4}$/.test(anio) ? parseInt(anio, 10) : new Date().getFullYear();

  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = empresa?.pais ?? "NI";

  const lista = await db
    .select({
      id: feriados.id,
      nombre: feriados.nombre,
      fecha: feriados.fecha,
      esNacional: feriados.esNacional,
    })
    .from(feriados)
    .where(
      and(
        eq(feriados.empresaId, user.empresaId),
        gte(feriados.fecha, `${year}-01-01`),
        lte(feriados.fecha, `${year}-12-31`),
      ),
    )
    .orderBy(asc(feriados.fecha));

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <BackLink href="/rrhh/nomina" label="Volver a Nómina" />
      <PageHeader
        title="Feriados"
        subtitle={`Calendario de días no laborables · ${getPaisConfig(pais).nombre}`}
      />
      <FeriadosManager anio={year} feriados={lista} />
    </div>
  );
}
