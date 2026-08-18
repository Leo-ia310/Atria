import { and, desc, eq, inArray } from "drizzle-orm";
import { CircleDollarSign } from "lucide-react";
import { db } from "@/lib/db";
import {
  nominas,
  nominaDetalles,
  nominaIngresos,
  tiposIngreso,
  empleados,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectorNomina } from "@/components/rrhh/SelectorNomina";
import { IngresosManager } from "@/components/rrhh/IngresosManager";
import { FRECUENCIA_LABEL } from "@/lib/rrhh";
import { formatearFecha, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

export default async function IngresosPage({
  searchParams,
}: {
  searchParams: Promise<{ nomina?: string }>;
}) {
  const { nomina: nominaParam } = await searchParams;
  const user = await requireSession();
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
      })
      .from(nominas)
      .where(eq(nominas.empresaId, user.empresaId))
      .orderBy(desc(nominas.creadoEn))
      .limit(40),
    db
      .select({ id: tiposIngreso.id, nombre: tiposIngreso.nombre })
      .from(tiposIngreso)
      .where(and(eq(tiposIngreso.empresaId, user.empresaId), eq(tiposIngreso.activo, true)))
      .orderBy(tiposIngreso.nombre),
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
    ingresos: number;
    totalNeto: number;
    registros: {
      id: string;
      tipo: string;
      monto: number;
      nota: string | null;
      semana: string;
      creadoEn: string;
    }[];
  }[] = [];

  if (seleccionada) {
    const detalles = await db
      .select({
        id: nominaDetalles.id,
        nombres: empleados.nombres,
        apellidos: empleados.apellidos,
        totalDevengado: nominaDetalles.totalDevengado,
        ingresos: nominaDetalles.bonificaciones,
        totalNeto: nominaDetalles.totalNeto,
      })
      .from(nominaDetalles)
      .innerJoin(empleados, eq(empleados.id, nominaDetalles.empleadoId))
      .where(eq(nominaDetalles.nominaId, seleccionada.id))
      .orderBy(empleados.nombres);

    const detIds = detalles.map((d) => d.id);
    const ingresosRows = detIds.length
      ? await db
          .select({
            id: nominaIngresos.id,
            detalleId: nominaIngresos.nominaDetalleId,
            monto: nominaIngresos.monto,
            nota: nominaIngresos.nota,
            semana: nominaIngresos.semana,
            creadoEn: nominaIngresos.creadoEn,
            tipo: tiposIngreso.nombre,
          })
          .from(nominaIngresos)
          .innerJoin(tiposIngreso, eq(tiposIngreso.id, nominaIngresos.tipoIngresoId))
          .where(inArray(nominaIngresos.nominaDetalleId, detIds))
          .orderBy(nominaIngresos.creadoEn)
      : [];

    empleadosData = detalles.map((d) => ({
      detalleId: d.id,
      nombre: `${d.nombres} ${d.apellidos}`,
      totalDevengado: parseFloat(d.totalDevengado),
      ingresos: parseFloat(d.ingresos),
      totalNeto: parseFloat(d.totalNeto),
      registros: ingresosRows
        .filter((x) => x.detalleId === d.id)
        .map((x) => ({
          id: x.id,
          tipo: x.tipo,
          monto: parseFloat(x.monto),
          nota: x.nota,
          semana: x.semana,
          creadoEn: x.creadoEn.toISOString(),
        })),
    }));
  }

  const totalIngresos = empleadosData.reduce((acc, emp) => acc + emp.ingresos, 0);

  return (
    <div>
      <PageHeader
        title="Ingresos"
        subtitle={`Historial y registro de ingresos extra por nomina - ${formatearMoneda(totalIngresos, pais)}`}
      />

      {nominasLista.length === 0 ? (
        <Card>
          <EmptyState
            icon={CircleDollarSign}
            titulo="No hay nominas"
            descripcion="Genera una nomina para empezar a registrar ingresos."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <SelectorNomina
            basePath="/rrhh/ingresos"
            selectedId={seleccionada?.id}
            items={nominasLista.map((b) => ({
              id: b.id,
              numero: b.numero,
              estado: b.estado,
              periodo: `${FRECUENCIA_LABEL[b.frecuencia] ?? b.frecuencia} · ${formatearFecha(b.periodoInicio)} - ${formatearFecha(b.periodoFin)}`,
            }))}
          />

          {seleccionada && (
            <IngresosManager
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
