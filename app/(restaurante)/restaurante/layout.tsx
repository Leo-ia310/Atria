import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/actions/session-helpers";
import { getAccessContext } from "@/lib/server-access";
import { modulosPermitidos, type ModuloAcceso } from "@/lib/access-control";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope } from "@/lib/sucursal-scope";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { RestauranteShell } from "@/components/restaurante/RestauranteShell";
import { BillingBlockedScreen } from "@/components/layout/BillingBlockedScreen";
import { dbConEmpresa } from "@/lib/db";
import { usuarioOnboardingModulos, usuarios } from "@/lib/db/schema";

const MODULOS_PERMITIDOS_BLOQUEO: ModuloAcceso[] = ["mi-cuenta", "restaurante-plan"];
const DIAS_USUARIO_RECIENTE_ONBOARDING = 30;

function esUsuarioReciente(creadoEn: Date | null | undefined): boolean {
  if (!creadoEn) return false;
  const edadMs = Date.now() - creadoEn.getTime();
  return edadMs >= 0 && edadMs <= DIAS_USUARIO_RECIENTE_ONBOARDING * 24 * 60 * 60 * 1000;
}

export default async function RestauranteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();
  const [access, empresa, sucursalScope, onboarding] = await Promise.all([
    getAccessContext(user),
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
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

  if (access.verticalEmpresa !== "restaurante" && access.tipoEmpresa !== "restaurante") {
    redirect("/dashboard?acceso=denegado");
  }

  const nombreEmpresa = empresa?.nombreComercial || empresa?.razonSocial || "Empresa";
  const mostrarOnboardingModulos = esUsuarioReciente(onboarding.usuarioCreadoEn);
  if (access.suscripcionBloqueada) {
    return (
      <SessionProvider>
        <ToastProvider>
          <RestauranteShell
            nombreEmpresa={nombreEmpresa}
            nombreUsuario={user.nombre}
            planNombre={access.plan.nombre}
            planActualId={access.plan.id}
            suscripcionEstado={access.suscripcionEstado}
            suscripcionFinISO={access.suscripcionFinPeriodo?.toISOString() ?? null}
            suscripcionBloqueada={access.suscripcionBloqueada}
            esDemo={access.plan.id === "demo"}
            modulosPermitidos={MODULOS_PERMITIDOS_BLOQUEO}
            sucursalScope={sucursalScope}
            mostrarOnboardingModulos={mostrarOnboardingModulos}
            onboardingModulosVistos={onboarding.vistos}
          >
            <BillingBlockedScreen
              planNombre={access.plan.nombre}
              planActualId={access.plan.id}
              vencioISO={access.suscripcionFinPeriodo?.toISOString() ?? null}
              eliminaISO={access.suscripcionFechaEliminacion?.toISOString() ?? null}
              diasGraciaRestantes={access.suscripcionDiasGraciaRestantes}
            />
          </RestauranteShell>
        </ToastProvider>
      </SessionProvider>
    );
  }

  const permitidos = modulosPermitidos(access);

  return (
    <SessionProvider>
      <ToastProvider>
        <RestauranteShell
          nombreEmpresa={nombreEmpresa}
          nombreUsuario={user.nombre}
          planNombre={access.plan.nombre}
          planActualId={access.plan.id}
          suscripcionEstado={access.suscripcionEstado}
          suscripcionFinISO={access.suscripcionFinPeriodo?.toISOString() ?? null}
          suscripcionBloqueada={access.suscripcionBloqueada}
          esDemo={access.plan.id === "demo"}
          modulosPermitidos={permitidos}
          sucursalScope={sucursalScope}
          mostrarOnboardingModulos={mostrarOnboardingModulos}
          onboardingModulosVistos={onboarding.vistos}
        >
          {children}
        </RestauranteShell>
      </ToastProvider>
    </SessionProvider>
  );
}
