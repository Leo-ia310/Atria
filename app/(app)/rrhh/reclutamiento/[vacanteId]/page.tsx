import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { vacantes, candidatos } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { formatearMoneda } from "@/lib/utils";
import {
  TIPO_CONTRATO_LABEL,
  VACANTE_ESTADO_LABEL,
} from "@/lib/rrhh";
import { VacanteDetalle } from "@/components/rrhh/VacanteDetalle";
import type { PaisCodigo } from "@/lib/paises";

const VARIANTE: Record<string, "success" | "warning" | "neutral" | "error"> = {
  abierta: "success",
  pausada: "warning",
  cerrada: "neutral",
  cancelada: "error",
};

export default async function VacanteDetallePage({
  params,
}: {
  params: Promise<{ vacanteId: string }>;
}) {
  const { vacanteId } = await params;
  const user = await requireSession();

  const [vac] = await db
    .select()
    .from(vacantes)
    .where(and(eq(vacantes.id, vacanteId), eq(vacantes.empresaId, user.empresaId)))
    .limit(1);
  if (!vac) notFound();

  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const lista = await db
    .select({
      id: candidatos.id,
      nombres: candidatos.nombres,
      apellidos: candidatos.apellidos,
      email: candidatos.email,
      telefono: candidatos.telefono,
      fuente: candidatos.fuente,
      expectativaSalarial: candidatos.expectativaSalarial,
      calificacion: candidatos.calificacion,
      etapa: candidatos.etapa,
      notas: candidatos.notas,
    })
    .from(candidatos)
    .where(eq(candidatos.vacanteId, vac.id))
    .orderBy(asc(candidatos.creadoEn));

  return (
    <div>
      <Link
        href="/rrhh/reclutamiento"
        className="mb-3 inline-flex items-center gap-1 text-small text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
      >
        <ArrowLeft size={14} /> Volver a vacantes
      </Link>
      <PageHeader
        title={vac.titulo}
        subtitle={`${vac.codigo}${vac.departamento ? ` · ${vac.departamento}` : ""} · ${
          TIPO_CONTRATO_LABEL[vac.tipoContrato] ?? vac.tipoContrato
        }`}
        actions={
          <Badge variant={VARIANTE[vac.estado] ?? "neutral"}>
            {VACANTE_ESTADO_LABEL[vac.estado] ?? vac.estado}
          </Badge>
        }
      />

      {(vac.descripcion ||
        vac.requisitos ||
        vac.salarioMin ||
        vac.salarioMax ||
        vac.experienciaAnios != null ||
        (vac.habilidades && vac.habilidades.length > 0)) && (
        <div className="atria-card mb-6 p-5 space-y-3">
          {(vac.salarioMin || vac.salarioMax) && (
            <div className="text-small">
              <span className="text-label">Rango salarial: </span>
              {vac.salarioMin ? formatearMoneda(vac.salarioMin, pais) : "—"}
              {vac.salarioMax ? ` – ${formatearMoneda(vac.salarioMax, pais)}` : ""}
            </div>
          )}
          {vac.experienciaAnios != null && (
            <div className="text-small">
              <span className="text-label">Experiencia requerida: </span>
              {vac.experienciaAnios} {vac.experienciaAnios === 1 ? "año" : "años"}
            </div>
          )}
          {vac.habilidades && vac.habilidades.length > 0 && (
            <div className="text-small">
              <span className="text-label">Habilidades: </span>
              <div className="mt-1 flex flex-wrap gap-2">
                {vac.habilidades.map((h) => (
                  <span
                    key={h}
                    className="rounded-full bg-[color:var(--color-tertiary)]/15 px-2.5 py-1 text-[12px] font-medium text-[color:var(--color-primary)]"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}
          {vac.descripcion && (
            <div className="text-small">
              <span className="text-label">Descripción: </span>
              {vac.descripcion}
            </div>
          )}
          {vac.requisitos && (
            <div className="text-small">
              <span className="text-label">Requisitos: </span>
              {vac.requisitos}
            </div>
          )}
        </div>
      )}

      <VacanteDetalle
        vacanteId={vac.id}
        estado={vac.estado}
        pais={pais}
        candidatos={lista.map((c) => ({
          id: c.id,
          nombre: `${c.nombres} ${c.apellidos}`,
          email: c.email,
          telefono: c.telefono,
          fuente: c.fuente,
          expectativaSalarial: c.expectativaSalarial ? Number(c.expectativaSalarial) : null,
          calificacion: c.calificacion,
          etapa: c.etapa,
          notas: c.notas,
        }))}
      />
    </div>
  );
}
