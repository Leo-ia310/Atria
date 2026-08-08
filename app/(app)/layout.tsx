import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/actions/session-helpers";
import {
  moduloDesdeRuta,
  modulosPermitidos,
  puedeAccederModulo,
} from "@/lib/access-control";
import { getAccessContext } from "@/lib/server-access";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DemoNoticeBanner } from "@/components/layout/DemoNoticeBanner";
import type { Notificacion } from "@/components/layout/NotificacionesBell";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { filtrarCommandItems } from "@/components/layout/nav-items";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getLayoutNotificationCounts } from "@/lib/layout-notifications";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();
  const [access, empresa, sucursalScope, headerStore] = await Promise.all([
    getAccessContext(user),
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
    headers(),
  ]);
  const pathname = headerStore.get("x-arca-pathname") ?? "";
  const moduloActual = moduloDesdeRuta(pathname);

  if (moduloActual && !puedeAccederModulo(access, moduloActual)) {
    redirect("/dashboard?acceso=denegado");
  }

  const nombreEmpresa =
    empresa?.nombreComercial || empresa?.razonSocial || "Empresa";
  const planNombre = access.plan.nombre;
  const esDemo = access.plan.id === "demo";
  const permitidos = modulosPermitidos(access);
  const commandItems = filtrarCommandItems(permitidos);
  const sucursalIds = selectedSucursalIds(sucursalScope);
  const puedeVerCxc = puedeAccederModulo(access, "cxc");
  const puedeVerCxp = puedeAccederModulo(access, "cxp");
  const puedeVerRrhh = puedeAccederModulo(access, "rrhh");

  const {
    cxcVencidas: nCxc,
    cxpVencidas: nCxp,
    solicitudesPendientes: nSol,
  } = await getLayoutNotificationCounts(
    user.empresaId,
    sucursalIds,
    puedeVerCxc,
    puedeVerCxp,
    puedeVerRrhh,
  );

  const notificaciones: Notificacion[] = [];
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
            {esDemo && <DemoNoticeBanner />}
            <main className="p-6">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
