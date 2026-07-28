import Link from "next/link";
import { Briefcase } from "lucide-react";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { vacantes, candidatos, empresas, sucursales } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatearMoneda } from "@/lib/utils";
import { VACANTE_ESTADO_LABEL, TIPO_CONTRATO_LABEL } from "@/lib/rrhh";
import { VacanteCrearButton } from "@/components/rrhh/VacanteCrearButton";

const VARIANTE: Record<string, "success" | "warning" | "neutral" | "error"> = {
  abierta: "success",
  pausada: "warning",
  cerrada: "neutral",
  cancelada: "error",
};

export default async function ReclutamientoPage() {
  const user = await requireSession();

  const [empresa] = await db
    .select({ pais: empresas.pais })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);
  const pais = empresa?.pais ?? "NI";

  const lista = await db
    .select({
      id: vacantes.id,
      codigo: vacantes.codigo,
      titulo: vacantes.titulo,
      departamento: vacantes.departamento,
      tipoContrato: vacantes.tipoContrato,
      salarioMin: vacantes.salarioMin,
      salarioMax: vacantes.salarioMax,
      plazas: vacantes.plazas,
      estado: vacantes.estado,
      candidatosCount: sql<number>`count(${candidatos.id})`.mapWith(Number),
    })
    .from(vacantes)
    .leftJoin(candidatos, eq(candidatos.vacanteId, vacantes.id))
    .where(eq(vacantes.empresaId, user.empresaId))
    .groupBy(vacantes.id)
    .orderBy(desc(vacantes.creadoEn))
    .limit(100);

  const sucs = await db
    .select({ id: sucursales.id, nombre: sucursales.nombre })
    .from(sucursales)
    .where(and(eq(sucursales.empresaId, user.empresaId), isNull(sucursales.eliminadoEn)));

  const abiertas = lista.filter((v) => v.estado === "abierta").length;

  function rangoSalario(min: string | null, max: string | null) {
    if (!min && !max) return "A convenir";
    if (min && max) return `${formatearMoneda(min, pais)} – ${formatearMoneda(max, pais)}`;
    return formatearMoneda((min ?? max)!, pais);
  }

  return (
    <div>
      <PageHeader
        title="Reclutamiento"
        subtitle={`${lista.length} vacantes · ${abiertas} abiertas`}
        actions={<VacanteCrearButton sucursales={sucs.map((s) => ({ value: s.id, label: s.nombre }))} />}
      />

      {lista.length === 0 ? (
        <div className="atria-card p-8">
          <EmptyState
            icon={Briefcase}
            titulo="No hay vacantes"
            descripcion="Publica una vacante y gestiona a los candidatos por etapas del proceso."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lista.map((v) => (
            <Link key={v.id} href={`/rrhh/reclutamiento/${v.id}`} className="group">
              <div className="atria-card h-full p-5 transition hover:border-[color:var(--color-tertiary)] hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-[color:var(--color-text-primary)]">
                      {v.titulo}
                    </div>
                    <div className="text-[12px] text-[color:var(--color-text-muted)]">
                      {v.codigo}
                      {v.departamento ? ` · ${v.departamento}` : ""}
                    </div>
                  </div>
                  <Badge variant={VARIANTE[v.estado] ?? "neutral"}>
                    {VACANTE_ESTADO_LABEL[v.estado] ?? v.estado}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1 text-small text-[color:var(--color-text-muted)]">
                  <div>{TIPO_CONTRATO_LABEL[v.tipoContrato] ?? v.tipoContrato}</div>
                  <div>{rangoSalario(v.salarioMin, v.salarioMax)}</div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[color:var(--color-border)] pt-3 text-[12px]">
                  <span className="text-[color:var(--color-text-muted)]">{v.plazas} plaza(s)</span>
                  <span className="font-medium text-[color:var(--color-secondary)]">
                    {v.candidatosCount} candidato(s)
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
