import { redirect } from "next/navigation";
import { requireSession } from "@/lib/actions/session-helpers";
import { getAccessContext } from "@/lib/server-access";
import { modulosPermitidos, type ModuloAcceso } from "@/lib/access-control";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope } from "@/lib/sucursal-scope";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { RestauranteShell } from "@/components/restaurante/RestauranteShell";
import { BillingBlockedScreen } from "@/components/layout/BillingBlockedScreen";

export default async function RestauranteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();
  const [access, empresa, sucursalScope] = await Promise.all([
    getAccessContext(user),
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);

  if (access.verticalEmpresa !== "restaurante" && access.tipoEmpresa !== "restaurante") {
    redirect("/dashboard?acceso=denegado");
  }

  const nombreEmpresa = empresa?.nombreComercial || empresa?.razonSocial || "Empresa";
  if (access.suscripcionBloqueada) {
    const permitidosBloqueo: ModuloAcceso[] = ["mi-cuenta", "restaurante-plan"];
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
            modulosPermitidos={permitidosBloqueo}
            sucursalScope={sucursalScope}
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
        >
          {children}
        </RestauranteShell>
      </ToastProvider>
    </SessionProvider>
  );
}
