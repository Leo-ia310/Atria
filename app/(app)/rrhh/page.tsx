import Link from "next/link";
import {
  UserRound,
  CalendarCheck,
  Wallet,
  Inbox,
  CircleDollarSign,
  CalendarClock,
} from "lucide-react";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { empleados, asistencias, solicitudesRrhh, nominas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardBody } from "@/components/ui/Card";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";

const MODULOS = [
  { href: "/rrhh/empleados", icon: UserRound, titulo: "Empleados", descripcion: "Expediente, contrato y compensacion" },
  { href: "/rrhh/asistencia", icon: CalendarCheck, titulo: "Asistencia", descripcion: "Marcacion diaria y horas extra" },
  { href: "/rrhh/nomina", icon: Wallet, titulo: "Nomina", descripcion: "Planillas, deducciones y asientos" },
  { href: "/rrhh/ingresos", icon: CircleDollarSign, titulo: "Ingresos", descripcion: "Bonos, comisiones y pagos extra" },
  { href: "/rrhh/deducciones", icon: Wallet, titulo: "Deducciones", descripcion: "Historial y descuentos variables" },
  { href: "/rrhh/solicitudes", icon: Inbox, titulo: "Solicitudes", descripcion: "Vacaciones, permisos y adelantos" },
  { href: "/rrhh/feriados", icon: CalendarClock, titulo: "Feriados", descripcion: "Calendario de dias no laborables" },
];

export default async function RrhhPage() {
  const user = await requireSession();
  const hoy = new Date().toISOString().slice(0, 10);
  const scope = await getSucursalScope(user);
  const sucursalIds = selectedSucursalIds(scope);
  const filtroSucursalEmpleado = sucursalIds
    ? inArray(empleados.sucursalId, sucursalIds)
    : undefined;

  const activosPromise = db
    .select({ n: count() })
    .from(empleados)
    .where(
      and(
        eq(empleados.empresaId, user.empresaId),
        isNull(empleados.eliminadoEn),
        sql`${empleados.estado} <> 'baja'`,
        filtroSucursalEmpleado,
      ),
    );

  const asistHoyPromise = db
    .select({ n: count() })
    .from(asistencias)
    .innerJoin(empleados, eq(empleados.id, asistencias.empleadoId))
    .where(
      and(
        eq(asistencias.empresaId, user.empresaId),
        eq(asistencias.fecha, hoy),
        eq(empleados.empresaId, user.empresaId),
        isNull(empleados.eliminadoEn),
        filtroSucursalEmpleado,
      ),
    );

  const pendientesPromise = db
    .select({ n: count() })
    .from(solicitudesRrhh)
    .innerJoin(empleados, eq(empleados.id, solicitudesRrhh.empleadoId))
    .where(
      and(
        eq(solicitudesRrhh.empresaId, user.empresaId),
        eq(solicitudesRrhh.estado, "pendiente"),
        eq(empleados.empresaId, user.empresaId),
        isNull(empleados.eliminadoEn),
        filtroSucursalEmpleado,
      ),
    );

  const borradoresPromise = db
    .select({ n: count() })
    .from(nominas)
    .where(and(eq(nominas.empresaId, user.empresaId), eq(nominas.estado, "borrador")));

  const [activosRows, asistHoyRows, pendientesRows, borradoresRows] =
    await Promise.all([
      activosPromise,
      asistHoyPromise,
      pendientesPromise,
      borradoresPromise,
    ]);
  const activos = activosRows[0];
  const asistHoy = asistHoyRows[0];
  const pendientes = pendientesRows[0];
  const borradores = borradoresRows[0];

  return (
    <div>
      <PageHeader
        title="Recursos Humanos"
        subtitle={`Gestiona a tu equipo: asistencia, nomina, ingresos, deducciones y solicitudes${scope.visible ? ` - ${scope.etiqueta}` : ""}`}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Empleados activos" value={String(activos?.n ?? 0)} icon={UserRound} />
        <KpiCard label="Asistencia hoy" value={String(asistHoy?.n ?? 0)} icon={CalendarCheck} />
        <KpiCard label="Solicitudes pendientes" value={String(pendientes?.n ?? 0)} icon={Inbox} />
        <KpiCard label="Nominas en borrador" value={String(borradores?.n ?? 0)} icon={Wallet} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map((m) => (
          <Link key={m.href} href={m.href} className="group">
            <Card className="h-full transition hover:border-[color:var(--color-tertiary)] hover:shadow-md">
              <CardBody>
                <div className="mb-3 inline-flex rounded-md bg-[color:var(--color-surface-2)] p-2 text-[color:var(--color-primary)] transition group-hover:bg-[color:var(--color-tertiary)]/20">
                  <m.icon size={18} />
                </div>
                <div className="text-base font-semibold text-[color:var(--color-text-primary)]">
                  {m.titulo}
                </div>
                <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
                  {m.descripcion}
                </p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
