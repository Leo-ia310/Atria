import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { feriados, empresas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
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

  const [empresa] = await db
    .select({ pais: empresas.pais })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);
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
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Feriados"
        subtitle={`Calendario de días no laborables · ${getPaisConfig(pais).nombre}`}
      />
      <FeriadosManager anio={year} feriados={lista} />
    </div>
  );
}
