import { sql } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import { requireSession } from "@/lib/actions/session-helpers";
import { WebCommercial } from "@/components/commercial/WebCommercial";
export default async function Page() {
  const user = await requireSession();
  const rows = await dbConEmpresa(user.empresaId, (tx) =>
    tx.execute(
      sql`select s.id,s.nombre from sucursales s where s.empresa_id=${user.empresaId}::uuid and s.activa and s.eliminado_en is null and (not exists(select 1 from usuario_sucursales us join sucursales a on a.id=us.sucursal_id where us.usuario_id=${user.id}::uuid and a.empresa_id=s.empresa_id) or exists(select 1 from usuario_sucursales us where us.usuario_id=${user.id}::uuid and us.sucursal_id=s.id)) order by s.nombre`,
    ),
  );
  return (
    <WebCommercial
      contextId={`${user.empresaId}:${user.id}`}
      kind="cotizacion"
      branches={rows as unknown as Array<{ id: string; nombre: string }>}
    />
  );
}
