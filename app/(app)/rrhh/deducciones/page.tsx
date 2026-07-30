import Link from "next/link";
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
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { DeduccionesManager } from "@/components/rrhh/DeduccionesManager";
import { FRECUENCIA_LABEL } from "@/lib/rrhh";
import { formatearFecha } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

export default async function DeduccionesPage({
  searchParams,
}: {
  searchParams: Promise<{ nomina?: string }>;
}) {
  const { nomina: nominaParam } = await searchParams;
  const user = await requireSession();
  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const [borradores, tipos] = await Promise.all([
    db
      .select({
        id: nominas.id,
        numero: nominas.numero,
        descripcion: nominas.descripcion,
        frecuencia: nominas.frecuencia,
        periodoInicio: nominas.periodoInicio,
        periodoFin: nominas.periodoFin,
        nivelVerificacion: nominas.nivelVerificacion,
      })
      .from(nominas)
      .where(and(eq(nominas.empresaId, user.empresaId), eq(nominas.estado, "borrador")))
      .orderBy(desc(nominas.creadoEn)),
    db
      .select({ id: tiposDeduccion.id, nombre: tiposDeduccion.nombre })
      .from(tiposDeduccion)
      .where(
        and(eq(tiposDeduccion.empresaId, user.empresaId), eq(tiposDeduccion.activo, true)),
      )
      .orderBy(tiposDeduccion.nombre),
  ]);

  const idSel =
    nominaParam && borradores.some((b) => b.id === nominaParam)
      ? nominaParam
      : borradores[0]?.id;
  const seleccionada = borradores.find((b) => b.id === idSel) ?? null;

  let empleadosData: {
    detalleId: string;
    nombre: string;
    totalDevengado: number;
    otras: number;
    totalNeto: number;
    deducciones: { id: string; tipo: string; monto: number; nota: string | null }[];
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
            tipo: tiposDeduccion.nombre,
          })
          .from(nominaDeducciones)
          .innerJoin(tiposDeduccion, eq(tiposDeduccion.id, nominaDeducciones.tipoDeduccionId))
          .where(inArray(nominaDeducciones.nominaDetalleId, detIds))
      : [];

    empleadosData = detalles.map((d) => ({
      detalleId: d.id,
      nombre: `${d.nombres} ${d.apellidos}`,
      totalDevengado: parseFloat(d.totalDevengado),
      otras: parseFloat(d.otras),
      totalNeto: parseFloat(d.totalNeto),
      deducciones: deds
        .filter((x) => x.detalleId === d.id)
        .map((x) => ({
          id: x.id,
          tipo: x.tipo,
          monto: parseFloat(x.monto),
          nota: x.nota,
        })),
    }));
  }

  return (
    <div>
      <PageHeader
        title="Deducciones"
        subtitle="Deducciones no fijas por empleado (gasolina, transporte, comida, adelantos…)"
      />

      {borradores.length === 0 ? (
        <Card>
          <EmptyState
            icon={Coins}
            titulo="No hay nóminas en borrador"
            descripcion="Las deducciones variables se agregan a una nómina en borrador antes de su verificación final. Genera una nómina para empezar."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Selector de nómina en borrador */}
          <div className="flex flex-wrap gap-2">
            {borradores.map((b) => {
              const activa = b.id === seleccionada?.id;
              return (
                <Link
                  key={b.id}
                  href={`/rrhh/deducciones?nomina=${b.id}`}
                  className={`rounded-md border px-3 py-2 text-small transition ${
                    activa
                      ? "border-[color:var(--color-primary)] bg-[color:var(--color-surface-2)] font-medium"
                      : "border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{b.numero}</span>
                    <Badge variant="warning">Verif. {b.nivelVerificacion}/3</Badge>
                  </div>
                  <div className="text-[11px] text-[color:var(--color-text-muted)]">
                    {FRECUENCIA_LABEL[b.frecuencia] ?? b.frecuencia} ·{" "}
                    {formatearFecha(b.periodoInicio)} — {formatearFecha(b.periodoFin)}
                  </div>
                </Link>
              );
            })}
          </div>

          {seleccionada && (
            <DeduccionesManager
              nominaId={seleccionada.id}
              pais={pais}
              tipos={tipos.map((t) => ({ value: t.id, label: t.nombre }))}
              empleados={empleadosData}
            />
          )}
        </div>
      )}
    </div>
  );
}
