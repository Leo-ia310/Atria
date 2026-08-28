import { and, desc, eq, inArray } from "drizzle-orm";
import { Coins } from "lucide-react";
import { db } from "@/lib/db";
import {
  nominas,
  nominaDetalles,
  nominaDeducciones,
  tiposDeduccion,
  empleados,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectorNomina } from "@/components/rrhh/SelectorNomina";
import { DeduccionesManager } from "@/components/rrhh/DeduccionesManager";
import { FRECUENCIA_LABEL } from "@/lib/rrhh";
import { formatearFecha, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

export default async function DeduccionesPage({
  searchParams,
}: {
  searchParams: Promise<{ nomina?: string }>;
}) {
  const [{ nomina: nominaParam }, user] = await Promise.all([
    searchParams,
    requireSession(),
  ]);
  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const [nominasLista, tipos] = await Promise.all([
    db
      .select({
        id: nominas.id,
        numero: nominas.numero,
        descripcion: nominas.descripcion,
        frecuencia: nominas.frecuencia,
        periodoInicio: nominas.periodoInicio,
        periodoFin: nominas.periodoFin,
        nivelVerificacion: nominas.nivelVerificacion,
        estado: nominas.estado,
        totalDeducciones: nominas.totalDeducciones,
      })
      .from(nominas)
      .where(eq(nominas.empresaId, user.empresaId))
      .orderBy(desc(nominas.creadoEn))
      .limit(40),
    db
      .select({ id: tiposDeduccion.id, nombre: tiposDeduccion.nombre })
      .from(tiposDeduccion)
      .where(
        and(eq(tiposDeduccion.empresaId, user.empresaId), eq(tiposDeduccion.activo, true)),
      )
      .orderBy(tiposDeduccion.nombre),
  ]);

  const idSel =
    nominaParam && nominasLista.some((b) => b.id === nominaParam)
      ? nominaParam
      : nominasLista[0]?.id;
  const seleccionada = nominasLista.find((b) => b.id === idSel) ?? null;
  const editable = seleccionada?.estado === "borrador";

  let empleadosData: {
    detalleId: string;
    nombre: string;
    totalDevengado: number;
    otras: number;
    totalNeto: number;
    deducciones: { id: string; tipo: string; monto: number; nota: string | null; semana: string }[];
  }[] = [];

  if (seleccionada) {
    const detalles = await db
      .select({
        id: nominaDetalles.id,
        nombres: empleados.nombres,
        apellidos: empleados.apellidos,
        totalDevengado: nominaDetalles.totalDevengado,
        otras: nominaDetalles.otrasDeducciones,
        totalNeto: nominaDetalles.totalNeto,
      })
      .from(nominaDetalles)
      .innerJoin(empleados, eq(empleados.id, nominaDetalles.empleadoId))
      .where(eq(nominaDetalles.nominaId, seleccionada.id))
      .orderBy(empleados.nombres);

    const detIds = detalles.map((d) => d.id);
    const deds = detIds.length
      ? await db
          .select({
            id: nominaDeducciones.id,
            detalleId: nominaDeducciones.nominaDetalleId,
            monto: nominaDeducciones.monto,
            nota: nominaDeducciones.nota,
            semana: nominaDeducciones.semana,
            tipo: tiposDeduccion.nombre,
          })
          .from(nominaDeducciones)
          .innerJoin(tiposDeduccion, eq(tiposDeduccion.id, nominaDeducciones.tipoDeduccionId))
          .where(inArray(nominaDeducciones.nominaDetalleId, detIds))
      : [];

    const deduccionesPorDetalle = new Map<string, typeof deds>();
    for (const deduccion of deds) {
      const actuales = deduccionesPorDetalle.get(deduccion.detalleId) ?? [];
      actuales.push(deduccion);
      deduccionesPorDetalle.set(deduccion.detalleId, actuales);
    }

    empleadosData = detalles.map((d) => ({
      detalleId: d.id,
      nombre: `${d.nombres} ${d.apellidos}`,
      totalDevengado: parseFloat(d.totalDevengado),
      otras: parseFloat(d.otras),
      totalNeto: parseFloat(d.totalNeto),
      deducciones: (deduccionesPorDetalle.get(d.id) ?? []).map((x) => ({
          id: x.id,
          tipo: x.tipo,
          monto: parseFloat(x.monto),
          nota: x.nota,
          semana: x.semana,
      })),
    }));
  }

  return (
    <div>
      <PageHeader
        title="Deducciones"
        subtitle="Historial y registro de deducciones variables por nomina."
      />

      {nominasLista.length === 0 ? (
        <Card>
          <EmptyState
            icon={Coins}
            titulo="No hay nominas"
            descripcion="Genera una nomina para empezar a registrar deducciones."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <SelectorNomina
            basePath="/rrhh/deducciones"
            selectedId={seleccionada?.id}
            items={nominasLista.map((b) => ({
              id: b.id,
              numero: b.numero,
              estado: b.estado,
              periodo: `${FRECUENCIA_LABEL[b.frecuencia] ?? b.frecuencia} · ${formatearFecha(b.periodoInicio)} - ${formatearFecha(b.periodoFin)}`,
              extra: formatearMoneda(b.totalDeducciones, pais),
            }))}
          />

          {seleccionada && (
            <DeduccionesManager
              nominaId={seleccionada.id}
              pais={pais}
              tipos={tipos.map((t) => ({ value: t.id, label: t.nombre }))}
              empleados={empleadosData}
              editable={editable}
            />
          )}
        </div>
      )}
    </div>
  );
}
