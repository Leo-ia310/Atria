import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { roles, permisos, rolPermisos } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { RolesManager } from "@/components/configuracion/RolesManager";

export default async function RolesPage() {
  const user = await requireSession();

  const [rolesList, permisosList] = await Promise.all([
    db
      .select({
        id: roles.id,
        nombre: roles.nombre,
        descripcion: roles.descripcion,
        esBase: roles.esBase,
      })
      .from(roles)
      .where(eq(roles.empresaId, user.empresaId)),
    db
      .select({
        id: permisos.id,
        clave: permisos.clave,
        modulo: permisos.modulo,
        descripcion: permisos.descripcion,
      })
      .from(permisos),
  ]);

  const asignaciones =
    rolesList.length > 0
      ? await db
          .select({ rolId: rolPermisos.rolId, permisoId: rolPermisos.permisoId })
          .from(rolPermisos)
          .where(
            inArray(
              rolPermisos.rolId,
              rolesList.map((r) => r.id),
            ),
          )
      : [];

  const porRol = new Map<string, string[]>();
  for (const a of asignaciones) {
    const arr = porRol.get(a.rolId) ?? [];
    arr.push(a.permisoId);
    porRol.set(a.rolId, arr);
  }

  return (
    <div>
      <PageHeader
        title="Roles y permisos"
        subtitle={`${rolesList.length} roles · ${permisosList.length} permisos disponibles`}
      />
      <RolesManager
        roles={rolesList.map((r) => ({ ...r, permisoIds: porRol.get(r.id) ?? [] }))}
        permisos={permisosList}
      />
    </div>
  );
}
