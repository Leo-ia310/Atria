import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, count, eq, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  compras,
  empresas,
  empleados,
  cuentasPorCobrar,
  cuentasPorPagar,
  solicitudesRrhh,
  ventas,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import {
  moduloDesdeRuta,
  modulosPermitidos,
  puedeAccederModulo,
} from "@/lib/access-control";
import { getAccessContext } from "@/lib/server-access";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import type { Notificacion } from "@/components/layout/NotificacionesBell";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { filtrarCommandItems } from "@/components/layout/nav-items";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();
  const access = await getAccessContext(user);
  const pathname = (await headers()).get("x-atria-pathname") ?? "";
  const moduloActual = moduloDesdeRuta(pathname);

  if (moduloActual && !puedeAccederModulo(access, moduloActual)) {
    redirect("/dashboard?acceso=denegado");
  }

  const filas = await db
    .select({
      nombreEmpresa: empresas.nombreComercial,
      razonSocial: empresas.razonSocial,
    })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);

  const datos = filas[0];
  const nombreEmpresa = datos?.nombreEmpresa || datos?.razonSocial || "Empresa";
  const planNombre = access.plan.nombre;
  const esDemo = access.plan.id === "demo";
  const permitidos = modulosPermitidos(access);
  const commandItems = filtrarCommandItems(permitidos);
  const sucursalScope = await getSucursalScope(user, access);
  const sucursalIds = selectedSucursalIds(sucursalScope);
  const puedeVerCxc = puedeAccederModulo(access, "cxc");
  const puedeVerCxp = puedeAccederModulo(access, "cxp");
  const puedeVerRrhh = puedeAccederModulo(access, "rrhh");

  const hoy = new Date().toISOString().slice(0, 10);
  const [cxcVencidas, cxpVencidas, solicitudesPendientes] = await Promise.all([
    puedeVerCxc
      ? db
          .select({ n: count() })
          .from(cuentasPorCobrar)
          .leftJoin(ventas, eq(ventas.id, cuentasPorCobrar.ventaId))
          .where(
            and(
              eq(cuentasPorCobrar.empresaId, user.empresaId),
              eq(cuentasPorCobrar.estado, "pendiente"),
              lt(cuentasPorCobrar.fechaVencimiento, hoy),
              sucursalIds ? inArray(ventas.sucursalId, sucursalIds) : undefined,
            ),
          )
      : Promise.resolve([{ n: 0 }]),
    puedeVerCxp
      ? db
          .select({ n: count() })
          .from(cuentasPorPagar)
          .leftJoin(compras, eq(compras.id, cuentasPorPagar.compraId))
          .where(
            and(
              eq(cuentasPorPagar.empresaId, user.empresaId),
              eq(cuentasPorPagar.estado, "pendiente"),
              lt(cuentasPorPagar.fechaVencimiento, hoy),
              sucursalIds ? inArray(compras.sucursalId, sucursalIds) : undefined,
            ),
          )
      : Promise.resolve([{ n: 0 }]),
    puedeVerRrhh
      ? db
          .select({ n: count() })
          .from(solicitudesRrhh)
          .innerJoin(empleados, eq(empleados.id, solicitudesRrhh.empleadoId))
          .where(
            and(
              eq(solicitudesRrhh.empresaId, user.empresaId),
              eq(solicitudesRrhh.estado, "pendiente"),
              eq(empleados.empresaId, user.empresaId),
              isNull(empleados.eliminadoEn),
              sucursalIds ? inArray(empleados.sucursalId, sucursalIds) : undefined,
            ),
          )
      : Promise.resolve([{ n: 0 }]),
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
            modulosPermitidos={permitidos}
          />
          <div
            style={{ marginLeft: "var(--sidebar-width)" }}
            className="transition-[margin] duration-200"
          >
            <Header
              breadcrumb={[{ label: nombreEmpresa }]}
              notificaciones={notificaciones}
              commandItems={commandItems}
              sucursalScope={sucursalScope}
            />
            <main className="p-6">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
