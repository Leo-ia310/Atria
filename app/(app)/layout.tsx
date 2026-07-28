import { and, count, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  empresas,
  suscripciones,
  planes,
  cuentasPorCobrar,
  cuentasPorPagar,
  solicitudesRrhh,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import type { Notificacion } from "@/components/layout/NotificacionesBell";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { ToastProvider } from "@/components/ui/Toast";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();

  const filas = await db
    .select({
      nombreEmpresa: empresas.nombreComercial,
      razonSocial: empresas.razonSocial,
      planNombre: planes.nombre,
      planTipo: planes.tipo,
    })
    .from(empresas)
    .leftJoin(suscripciones, eq(suscripciones.empresaId, empresas.id))
    .leftJoin(planes, eq(planes.id, suscripciones.planId))
    .where(eq(empresas.id, user.empresaId))
    .limit(1);

  const datos = filas[0];
  const nombreEmpresa = datos?.nombreEmpresa || datos?.razonSocial || "Empresa";
  const planNombre = datos?.planNombre ?? "Demo";
  const esDemo = datos?.planTipo === "demo";

  const hoy = new Date().toISOString().slice(0, 10);
  const [cxcVencidas, cxpVencidas, solicitudesPendientes] = await Promise.all([
    db
      .select({ n: count() })
      .from(cuentasPorCobrar)
      .where(
        and(
          eq(cuentasPorCobrar.empresaId, user.empresaId),
          eq(cuentasPorCobrar.estado, "pendiente"),
          lt(cuentasPorCobrar.fechaVencimiento, hoy),
        ),
      ),
    db
      .select({ n: count() })
      .from(cuentasPorPagar)
      .where(
        and(
          eq(cuentasPorPagar.empresaId, user.empresaId),
          eq(cuentasPorPagar.estado, "pendiente"),
          lt(cuentasPorPagar.fechaVencimiento, hoy),
        ),
      ),
    db
      .select({ n: count() })
      .from(solicitudesRrhh)
      .where(
        and(
          eq(solicitudesRrhh.empresaId, user.empresaId),
          eq(solicitudesRrhh.estado, "pendiente"),
        ),
      ),
  ]);

  const notificaciones: Notificacion[] = [];
  const nCxc = cxcVencidas[0]?.n ?? 0;
  const nCxp = cxpVencidas[0]?.n ?? 0;
  const nSol = solicitudesPendientes[0]?.n ?? 0;
  if (nCxc > 0) {
    notificaciones.push({
      id: "cxc-vencidas",
      titulo: `${nCxc} ${nCxc === 1 ? "cuenta vencida por cobrar" : "cuentas vencidas por cobrar"}`,
      detalle: "Revisa los cobros pendientes",
      href: "/cxc",
      tono: "error",
    });
  }
  if (nCxp > 0) {
    notificaciones.push({
      id: "cxp-vencidas",
      titulo: `${nCxp} ${nCxp === 1 ? "cuenta vencida por pagar" : "cuentas vencidas por pagar"}`,
      detalle: "Tienes pagos a proveedores vencidos",
      href: "/cxp",
      tono: "warning",
    });
  }
  if (nSol > 0) {
    notificaciones.push({
      id: "solicitudes-pendientes",
      titulo: `${nSol} ${nSol === 1 ? "solicitud pendiente" : "solicitudes pendientes"}`,
      detalle: "Solicitudes de RRHH por resolver",
      href: "/rrhh/solicitudes",
      tono: "info",
    });
  }

  return (
    <SessionProvider>
      <ToastProvider>
        <div className="min-h-screen bg-[color:var(--color-neutral)]">
          <Sidebar
            nombreEmpresa={nombreEmpresa}
            planNombre={planNombre}
            esDemo={esDemo}
            nombreUsuario={user.nombre}
          />
          <div
            style={{ marginLeft: "var(--sidebar-width)" }}
            className="transition-[margin] duration-200"
          >
            <Header
              breadcrumb={[{ label: nombreEmpresa }]}
              notificaciones={notificaciones}
            />
            <main className="p-6">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
