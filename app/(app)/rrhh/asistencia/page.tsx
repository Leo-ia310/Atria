import { CalendarCheck } from "lucide-react";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { empleados, asistencias, feriados } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { AsistenciaTablero } from "@/components/rrhh/AsistenciaTablero";

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function AsistenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { fecha } = await searchParams;
  const dia = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoyISO();
  const user = await requireSession();

  const activos = await db
    .select({
      id: empleados.id,
      codigo: empleados.codigo,
      nombres: empleados.nombres,
      apellidos: empleados.apellidos,
      puesto: empleados.puesto,
    })
    .from(empleados)
    .where(
      and(
        eq(empleados.empresaId, user.empresaId),
        isNull(empleados.eliminadoEn),
        sql`${empleados.estado} <> 'baja'`,
      ),
    )
    .orderBy(empleados.nombres);

  const registros = await db
    .select({
      empleadoId: asistencias.empleadoId,
      estado: asistencias.estado,
      horasTrabajadas: asistencias.horasTrabajadas,
      horasExtra: asistencias.horasExtra,
      notas: asistencias.notas,
    })
    .from(asistencias)
    .where(and(eq(asistencias.empresaId, user.empresaId), eq(asistencias.fecha, dia)));

  const [feriado] = await db
    .select({ nombre: feriados.nombre })
    .from(feriados)
    .where(and(eq(feriados.empresaId, user.empresaId), eq(feriados.fecha, dia)))
    .limit(1);

  const registrosMap = Object.fromEntries(
    registros.map((r) => [
      r.empleadoId,
      {
        estado: r.estado,
        horasTrabajadas: Number(r.horasTrabajadas),
        horasExtra: Number(r.horasExtra),
        notas: r.notas ?? "",
      },
    ]),
  );

  const registrados = registros.length;

  return (
    <div>
      <PageHeader
        title="Asistencia"
        subtitle={`${activos.length} empleados · ${registrados} registrados el día`}
      />
      {activos.length === 0 ? (
        <div className="atria-card p-8">
          <EmptyState
            icon={CalendarCheck}
            titulo="No hay empleados activos"
            descripcion="Registra empleados para poder marcar su asistencia diaria."
          />
        </div>
      ) : (
        <AsistenciaTablero
          fecha={dia}
          feriado={feriado?.nombre ?? null}
          empleados={activos}
          registros={registrosMap}
        />
      )}
    </div>
  );
}
