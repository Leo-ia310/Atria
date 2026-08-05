import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { usuarios, roles, empresas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PerfilForm, PasswordForm } from "@/components/configuracion/MiCuentaForms";

export default async function MiCuentaPage() {
  const user = await requireSession();

  const [info] = await db
    .select({
      nombre: usuarios.nombre,
      email: usuarios.email,
      telefono: usuarios.telefono,
      rol: roles.nombre,
      empresa: empresas.razonSocial,
      empresaComercial: empresas.nombreComercial,
    })
    .from(usuarios)
    .leftJoin(roles, eq(roles.id, usuarios.rolId))
    .leftJoin(empresas, eq(empresas.id, usuarios.empresaId))
    .where(eq(usuarios.id, user.id))
    .limit(1);

  const nombre = info?.nombre ?? user.nombre;
  const empresaNombre = info?.empresaComercial || info?.empresa || "";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Mi cuenta" subtitle="Gestiona tu perfil y seguridad" />

      <Card>
        <CardBody className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-tertiary)]/20 text-lg font-semibold uppercase text-[color:var(--color-primary)]">
            {iniciales(nombre)}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold">{nombre}</div>
            <div className="text-small text-[color:var(--color-text-muted)]">
              {info?.email}
            </div>
            <div className="mt-1 flex items-center gap-2">
              {info?.rol && <Badge variant="info">{info.rol}</Badge>}
              {empresaNombre && (
                <span className="text-[12px] text-[color:var(--color-text-muted)]">
                  {empresaNombre}
                </span>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <PerfilForm
        nombreInicial={nombre}
        emailInicial={info?.email ?? user.email ?? ""}
        telefonoInicial={info?.telefono ?? ""}
      />

      <PasswordForm />
    </div>
  );
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}
