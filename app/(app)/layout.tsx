import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { empresas, suscripciones, planes } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
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
            <Header breadcrumb={[{ label: nombreEmpresa }]} />
            <main className="p-6">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
