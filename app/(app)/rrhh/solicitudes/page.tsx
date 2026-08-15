import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { solicitudesRrhh, empleados } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { SolicitudesPanel } from "@/components/rrhh/SolicitudesPanel";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";

export default async function SolicitudesPage() {
  const user = await requireSession();
  const [scope, empresa] = await Promise.all([
    getSucursalScope(user),
    getEmpresaMetadata(user.empresaId),
  ]);
  const sucursalIds = selectedSucursalIds(scope);

  const lista = await db
    .select({
      id: solicitudesRrhh.id,
      tipo: solicitudesRrhh.tipo,
      estado: solicitudesRrhh.estado,
      fechaInicio: solicitudesRrhh.fechaInicio,
      fechaFin: solicitudesRrhh.fechaFin,
      dias: solicitudesRrhh.dias,
      monto: solicitudesRrhh.monto,
      motivo: solicitudesRrhh.motivo,
      comentarioResolucion: solicitudesRrhh.comentarioResolucion,
      creadoEn: solicitudesRrhh.creadoEn,
      empleadoNombres: empleados.nombres,
      empleadoApellidos: empleados.apellidos,
    })
    .from(solicitudesRrhh)
    .innerJoin(empleados, eq(empleados.id, solicitudesRrhh.empleadoId))
    .where(
      and(
        eq(solicitudesRrhh.empresaId, user.empresaId),
        eq(empleados.empresaId, user.empresaId),
        isNull(empleados.eliminadoEn),
        sucursalIds ? inArray(empleados.sucursalId, sucursalIds) : undefined,
      ),
    )
    .orderBy(desc(solicitudesRrhh.creadoEn))
    .limit(200);

  const activos = await db
    .select({ id: empleados.id, nombres: empleados.nombres, apellidos: empleados.apellidos })
    .from(empleados)
    .where(
      and(
        eq(empleados.empresaId, user.empresaId),
        isNull(empleados.eliminadoEn),
        sql`${empleados.estado} <> 'baja'`,
        sucursalIds ? inArray(empleados.sucursalId, sucursalIds) : undefined,
      ),
    )
    .orderBy(empleados.nombres);

  const pendientes = lista.filter((s) => s.estado === "pendiente").length;

  return (
    <div>
      <PageHeader
        title="Solicitudes"
        subtitle={`${lista.length} solicitudes · ${pendientes} pendientes${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
        actions={<BotonExportarExcel recurso="solicitudes" />}
      />
      <SolicitudesPanel
        pais={empresa?.pais ?? "NI"}
        solicitudes={lista.map((s) => ({
          id: s.id,
          tipo: s.tipo,
          estado: s.estado,
          fechaInicio: s.fechaInicio,
          fechaFin: s.fechaFin,
          dias: Number(s.dias),
          monto: s.monto ? Number(s.monto) : null,
          motivo: s.motivo,
          comentarioResolucion: s.comentarioResolucion,
          empleado: `${s.empleadoNombres ?? ""} ${s.empleadoApellidos ?? ""}`.trim(),
        }))}
        empleados={activos.map((e) => ({
          value: e.id,
          label: `${e.nombres} ${e.apellidos}`,
        }))}
      />
    </div>
  );
}
