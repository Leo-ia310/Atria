import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { empleados, asistencias } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackLink } from "@/components/layout/BackLink";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatearFecha } from "@/lib/utils";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";

const ESTADO_VARIANTE: Record<
  string,
  "success" | "warning" | "error" | "neutral" | "info"
> = {
  presente: "success",
  tarde: "warning",
  ausente: "error",
  justificado: "info",
  permiso: "info",
  vacaciones: "info",
  incapacidad: "warning",
  feriado: "neutral",
  descanso: "neutral",
};

const ESTADO_LABEL: Record<string, string> = {
  presente: "Presente",
  tarde: "Tarde",
  ausente: "Ausente",
  justificado: "Justificado",
  permiso: "Permiso",
  vacaciones: "Vacaciones",
  incapacidad: "Incapacidad",
  feriado: "Feriado",
  descanso: "Descanso",
};

function primerDiaMes(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function ultimoDiaMes(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export default async function HistorialAsistenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; empleado?: string }>;
}) {
  const [{ desde, hasta, empleado }, user] = await Promise.all([
    searchParams,
    requireSession(),
  ]);
  const scope = await getSucursalScope(user);
  const sucursalIds = selectedSucursalIds(scope);

  const hoy = new Date();
  const rangoDesde =
    desde && /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : primerDiaMes(hoy);
  const rangoHasta =
    hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta) ? hasta : ultimoDiaMes(hoy);

  const condiciones = [
    eq(asistencias.empresaId, user.empresaId),
    gte(asistencias.fecha, rangoDesde),
    lte(asistencias.fecha, rangoHasta),
    eq(empleados.empresaId, user.empresaId),
    isNull(empleados.eliminadoEn),
  ];
  if (empleado && empleado !== "") {
    condiciones.push(eq(asistencias.empleadoId, empleado));
  }
  if (sucursalIds) {
    condiciones.push(inArray(empleados.sucursalId, sucursalIds));
  }

  const [listaEmpleados, registros] = await Promise.all([
    db
      .select({
        id: empleados.id,
        nombres: empleados.nombres,
        apellidos: empleados.apellidos,
      })
      .from(empleados)
      .where(
        and(
          eq(empleados.empresaId, user.empresaId),
          isNull(empleados.eliminadoEn),
          sucursalIds ? inArray(empleados.sucursalId, sucursalIds) : undefined,
        ),
      )
      .orderBy(empleados.nombres),
    db
      .select({
        id: asistencias.id,
        fecha: asistencias.fecha,
        estado: asistencias.estado,
        horasTrabajadas: asistencias.horasTrabajadas,
        horasExtra: asistencias.horasExtra,
        notas: asistencias.notas,
        nombres: empleados.nombres,
        apellidos: empleados.apellidos,
      })
      .from(asistencias)
      .innerJoin(empleados, eq(empleados.id, asistencias.empleadoId))
      .where(and(...condiciones))
      .orderBy(desc(asistencias.fecha), empleados.nombres)
      .limit(500),
  ]);

  return (
    <div className="space-y-3">
      <BackLink href="/rrhh/asistencia" label="Volver a Asistencia" />
      <PageHeader
        title="Historial de asistencias"
        subtitle={`${registros.length} registros en el rango seleccionado${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportarExcel
              recurso="asistencia-historial"
              params={{ desde: rangoDesde, hasta: rangoHasta, empleado }}
            />
            <Link
              href="/rrhh/asistencia"
              className="arca-btn arca-btn-secondary arca-btn-sm"
            >
              Registro diario
            </Link>
          </div>
        }
      />

      <Card>
        <CardBody>
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div>
              <label htmlFor="asistencia-desde" className="text-label mb-1.5 block">Desde</label>
              <input
                id="asistencia-desde"
                type="date"
                name="desde"
                defaultValue={rangoDesde}
                className="arca-input w-44"
              />
            </div>
            <div>
              <label htmlFor="asistencia-hasta" className="text-label mb-1.5 block">Hasta</label>
              <input
                id="asistencia-hasta"
                type="date"
                name="hasta"
                defaultValue={rangoHasta}
                className="arca-input w-44"
              />
            </div>
            <div>
              <label htmlFor="asistencia-empleado" className="text-label mb-1.5 block">Empleado</label>
              <select
                id="asistencia-empleado"
                name="empleado"
                defaultValue={empleado ?? ""}
                className="arca-input w-56"
              >
                <option value="">Todos</option>
                {listaEmpleados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombres} {e.apellidos}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="arca-btn arca-btn-primary">
              Filtrar
            </button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Registros" />
        <CardBody className="p-0">
          {registros.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={CalendarCheck}
                titulo="Sin registros"
                descripcion="No hay asistencias registradas en el rango seleccionado."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                  <tr>
                    <th className="text-label px-4 py-3 text-left font-semibold">Fecha</th>
                    <th className="text-label px-4 py-3 text-left font-semibold">Empleado</th>
                    <th className="text-label px-4 py-3 text-left font-semibold">Estado</th>
                    <th className="text-label px-4 py-3 text-right font-semibold">Horas</th>
                    <th className="text-label px-4 py-3 text-right font-semibold">Extra</th>
                    <th className="text-label px-4 py-3 text-left font-semibold">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[color:var(--color-border)] last:border-b-0"
                    >
                      <td className="px-4 py-2 whitespace-nowrap">
                        {formatearFecha(r.fecha)}
                      </td>
                      <td className="px-4 py-2 font-medium">
                        {r.nombres} {r.apellidos}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={ESTADO_VARIANTE[r.estado] ?? "neutral"}>
                          {ESTADO_LABEL[r.estado] ?? r.estado}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right">{Number(r.horasTrabajadas)}</td>
                      <td className="px-4 py-2 text-right">{Number(r.horasExtra)}</td>
                      <td className="px-4 py-2 text-[color:var(--color-text-muted)]">
                        {r.notas || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
