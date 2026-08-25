import { redirect } from "next/navigation";
import { requireSession } from "@/lib/actions/session-helpers";
import { getAccessContext, requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { RestauranteShell } from "@/components/restaurante/RestauranteShell";

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
  await requireModulo(user, "restaurante-dashboard");

  const nombreEmpresa = empresa?.nombreComercial || empresa?.razonSocial || "Empresa";

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
