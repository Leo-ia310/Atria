import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/actions/session-helpers";
import {
  type ModuloAcceso,
  moduloDesdeRuta,
  modulosPermitidos,
  puedeAccederModulo,
} from "@/lib/access-control";
import { getAccessContext } from "@/lib/server-access";
import { AppShell } from "@/components/layout/AppShell";
import { BillingBlockedScreen } from "@/components/layout/BillingBlockedScreen";
import { DemoNoticeBanner } from "@/components/layout/DemoNoticeBanner";
import { TrialNoticeBanner } from "@/components/layout/TrialNoticeBanner";
import type { Notificacion } from "@/components/layout/NotificacionesBell";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { filtrarCommandItems } from "@/components/layout/nav-items";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getLayoutNotificationCounts } from "@/lib/layout-notifications";
import { dbConEmpresa } from "@/lib/db";
import { usuarioOnboardingModulos, usuarios } from "@/lib/db/schema";

const MODULOS_PERMITIDOS_BLOQUEO: ModuloAcceso[] = ["dashboard", "mi-cuenta"];
const NOTIFICACIONES_BLOQUEO: Notificacion[] = [];
const DIAS_USUARIO_RECIENTE_ONBOARDING = 30;

function esUsuarioReciente(creadoEn: Date | null | undefined): boolean {
  if (!creadoEn) return false;
  const edadMs = Date.now() - creadoEn.getTime();
  return edadMs >= 0 && edadMs <= DIAS_USUARIO_RECIENTE_ONBOARDING * 24 * 60 * 60 * 1000;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();
  const [access, empresa, sucursalScope, headerStore, onboarding] = await Promise.all([
    getAccessContext(user),
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
    headers(),
    dbConEmpresa(user.empresaId, async (tx) => {
      const [vistos, usuarioRows] = await Promise.all([
        tx
          .select({ modulo: usuarioOnboardingModulos.modulo })
          .from(usuarioOnboardingModulos)
          .where(
            and(
              eq(usuarioOnboardingModulos.empresaId, user.empresaId),
              eq(usuarioOnboardingModulos.usuarioId, user.id),
            ),
          ),
        tx
          .select({ creadoEn: usuarios.creadoEn })
          .from(usuarios)
          .where(and(eq(usuarios.empresaId, user.empresaId), eq(usuarios.id, user.id)))
          .limit(1),
      ]);
      return {
        vistos: vistos.map((row) => row.modulo),
        usuarioCreadoEn: usuarioRows[0]?.creadoEn ?? null,
      };
    }),
  ]);
  const pathname = headerStore.get("x-arca-pathname") ?? "";
  const moduloActual = moduloDesdeRuta(pathname);

  const nombreEmpresa =
    empresa?.nombreComercial || empresa?.razonSocial || "Empresa";
  const planNombre = access.plan.nombre;
  const esDemo = access.plan.id === "demo";
  const esTrialPago = access.suscripcionEstado === "trial" && access.plan.id !== "demo";
  const esRestaurante =
    access.verticalEmpresa === "restaurante" || access.tipoEmpresa === "restaurante";
  const mostrarOnboardingModulos = esUsuarioReciente(onboarding.usuarioCreadoEn);

  if (access.suscripcionBloqueada) {
    return (
      <SessionProvider>
        <ToastProvider>
          <AppShell
            nombreEmpresa={nombreEmpresa}
            planNombre={planNombre}
            planActualId={access.plan.id}
            suscripcionEstado={access.suscripcionEstado}
            suscripcionFinISO={access.suscripcionFinPeriodo?.toISOString() ?? null}
            suscripcionBloqueada={access.suscripcionBloqueada}
            esDemo={esDemo}
            nombreUsuario={user.nombre}
            modulosPermitidos={MODULOS_PERMITIDOS_BLOQUEO}
            notificaciones={NOTIFICACIONES_BLOQUEO}
            commandItems={filtrarCommandItems(MODULOS_PERMITIDOS_BLOQUEO)}
          >
            <BillingBlockedScreen
              planNombre={planNombre}
              planActualId={access.plan.id}
              vencioISO={access.suscripcionFinPeriodo?.toISOString() ?? null}
              eliminaISO={access.suscripcionFechaEliminacion?.toISOString() ?? null}
              diasGraciaRestantes={access.suscripcionDiasGraciaRestantes}
            />
          </AppShell>
        </ToastProvider>
      </SessionProvider>
    );
  }

  if (esRestaurante && (pathname === "/dashboard" || pathname.startsWith("/dashboard/"))) {
    redirect("/restaurante");
  }

  if (moduloActual && !puedeAccederModulo(access, moduloActual)) {
    redirect(esRestaurante ? "/restaurante?acceso=denegado" : "/dashboard?acceso=denegado");
  }

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
        <AppShell
          nombreEmpresa={nombreEmpresa}
          planNombre={planNombre}
          planActualId={access.plan.id}
          suscripcionEstado={access.suscripcionEstado}
          suscripcionFinISO={access.suscripcionFinPeriodo?.toISOString() ?? null}
          suscripcionBloqueada={access.suscripcionBloqueada}
          esDemo={esDemo}
          nombreUsuario={user.nombre}
          modulosPermitidos={permitidos}
          notificaciones={notificaciones}
          commandItems={commandItems}
          sucursalScope={sucursalScope}
          mostrarOnboardingModulos={mostrarOnboardingModulos}
          onboardingModulosVistos={onboarding.vistos}
          banner={
            esDemo ? (
              <DemoNoticeBanner />
            ) : esTrialPago && access.suscripcionFinPeriodo ? (
              <TrialNoticeBanner
                planNombre={planNombre}
                planActualId={access.plan.id}
                finISO={access.suscripcionFinPeriodo.toISOString()}
              />
            ) : null
          }
        >
          {children}
        </AppShell>
      </ToastProvider>
    </SessionProvider>
  );
}
