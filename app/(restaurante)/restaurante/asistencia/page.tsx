import type { Metadata } from "next";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { CalendarCheck, Clock, UserCheck } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import { asistencias, empleados, sucursales } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { fechaISOEnZona } from "@/lib/dates";
import { formatearFecha, formatearFechaHora } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import {
  RestaurantCoreModulePage,
  RestaurantModuleGrid,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";
import { cantidad, estadoTone, labelEstado, numero } from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "Asistencia Restaurante | ARCA",
  description: "Turnos, entradas, salidas y horas del personal restaurante.",
};

export default async function RestauranteAsistenciaPage() {
  const user = await requireSession();
  await requireModulo(user, "rrhh");
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const hoy = fechaISOEnZona(new Date(), empresa?.zonaHoraria ?? "America/Managua");
  const sucursalIds = selectedSucursalIds(scope);

  const [empleadosActivos, registros] = await dbConEmpresa(user.empresaId, (tx) =>
    Promise.all([
      tx
        .select({
          id: empleados.id,
          puesto: empleados.puesto,
          sucursal: sucursales.nombre,
        })
        .from(empleados)
        .leftJoin(sucursales, eq(sucursales.id, empleados.sucursalId))
        .where(
          and(
            eq(empleados.empresaId, user.empresaId),
            isNull(empleados.eliminadoEn),
            sql`${empleados.estado} <> 'baja'`,
            sucursalIds ? inArray(empleados.sucursalId, sucursalIds) : undefined,
          ),
        ),
      tx
        .select({
          id: asistencias.id,
          fecha: asistencias.fecha,
          estado: asistencias.estado,
          horaEntrada: asistencias.horaEntrada,
          horaSalida: asistencias.horaSalida,
          horasTrabajadas: asistencias.horasTrabajadas,
          horasExtra: asistencias.horasExtra,
          notas: asistencias.notas,
          nombres: empleados.nombres,
          apellidos: empleados.apellidos,
          puesto: empleados.puesto,
          sucursal: sucursales.nombre,
        })
        .from(asistencias)
        .innerJoin(empleados, eq(empleados.id, asistencias.empleadoId))
        .leftJoin(sucursales, eq(sucursales.id, empleados.sucursalId))
        .where(
          and(
            eq(asistencias.empresaId, user.empresaId),
            eq(empleados.empresaId, user.empresaId),
            sucursalIds ? inArray(empleados.sucursalId, sucursalIds) : undefined,
          ),
        )
        .orderBy(desc(asistencias.fecha), desc(asistencias.creadoEn))
        .limit(160),
    ]),
  );

  const registrosHoy = registros.filter((row) => row.fecha === hoy);
  const presentesHoy = registrosHoy.filter((row) => row.estado === "presente").length;
  const horasHoy = registrosHoy.reduce((total, row) => total + numero(row.horasTrabajadas), 0);
  const horasExtra = registros.reduce((total, row) => total + numero(row.horasExtra), 0);

  return (
    <RestaurantCoreModulePage
      eyebrow={scope.visible ? scope.etiqueta : "Asistencia restaurante"}
      title="Asistencia restaurante"
      subtitle="Entradas, salidas, retrasos, horas trabajadas y horas extra desde RRHH Core."
      actions={[
        { href: "/restaurante/empleados", label: "Empleados", icon: UserCheck },
        { href: "/restaurante/nomina", label: "Nomina", icon: Clock },
      ]}
      kpis={[
        { label: "Personal activo", value: String(empleadosActivos.length), icon: CalendarCheck },
        { label: "Presentes hoy", value: `${presentesHoy}/${empleadosActivos.length}` },
        { label: "Horas hoy", value: cantidad(horasHoy) },
        { label: "Horas extra", value: cantidad(horasExtra), hint: "Registros recientes" },
      ]}
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RestaurantModuleList
          title="Registros recientes"
          subtitle="Preparado para futuras integraciones QR, NFC o huella, sin fingir biometria actual."
          empty="Aun no hay registros de asistencia."
          items={registros.map((row) => ({
            id: row.id,
            title: `${row.nombres} ${row.apellidos}`,
            subtitle: `${row.puesto} / ${row.sucursal ?? "Sin sucursal"} / ${formatearFecha(row.fecha, pais)}`,
            meta: `${row.horaEntrada ? `Entrada ${formatearFechaHora(row.horaEntrada, pais, empresa?.zonaHoraria)}` : "Sin entrada"}${row.horaSalida ? ` / salida ${formatearFechaHora(row.horaSalida, pais, empresa?.zonaHoraria)}` : ""}${row.notas ? ` / ${row.notas}` : ""}`,
            value: `${cantidad(row.horasTrabajadas)} h`,
            badge: labelEstado(row.estado),
            tone: estadoTone(row.estado),
          }))}
        />
        <RestaurantModuleGrid
          title="Control operativo"
          subtitle="Asistencia alimenta costos y nomina, no decisiones automaticas."
          actions={[
            { href: "/restaurante/empleados", label: "Equipo por puesto" },
            { href: "/restaurante/nomina", label: "Nomina vinculada" },
            { href: "/restaurante/reportes", label: "Horas y costos" },
          ]}
        />
      </section>
    </RestaurantCoreModulePage>
  );
}
