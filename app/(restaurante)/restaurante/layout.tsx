import { redirect } from "next/navigation";
import { requireSession } from "@/lib/actions/session-helpers";
import { getAccessContext, requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
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
  const [access, empresa] = await Promise.all([
    getAccessContext(user),
    getEmpresaMetadata(user.empresaId),
  ]);

  if (access.verticalEmpresa !== "restaurante" && access.tipoEmpresa !== "restaurante") {
    redirect("/dashboard?acceso=denegado");
  }

  const nombreEmpresa = empresa?.nombreComercial || empresa?.razonSocial || "Empresa";
  if (access.suscripcionBloqueada) {
    return (
      <SessionProvider>
        <ToastProvider>
          <RestauranteShell
            nombreEmpresa={nombreEmpresa}
            nombreUsuario={user.nombre}
            planNombre={access.plan.nombre}
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

  await requireModulo(user, "restaurante-dashboard");

  return (
    <SessionProvider>
      <ToastProvider>
        <RestauranteShell
          nombreEmpresa={nombreEmpresa}
          nombreUsuario={user.nombre}
          planNombre={access.plan.nombre}
        >
          {children}
        </RestauranteShell>
      </ToastProvider>
    </SessionProvider>
  );
}
