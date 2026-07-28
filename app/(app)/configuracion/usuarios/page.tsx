import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { usuarios, roles } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { CrearUsuarioForm } from "@/components/configuracion/CrearUsuarioForm";
import { formatearFechaHora } from "@/lib/utils";

type Fila = {
  id: string;
  nombre: string;
  email: string;
  rol: string | null;
  activo: boolean;
  ultimoLogin: Date | null;
};

export default async function UsuariosPage() {
  const user = await requireSession();

  const filas: Fila[] = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol: roles.nombre,
      activo: usuarios.activo,
      ultimoLogin: usuarios.ultimoLogin,
    })
    .from(usuarios)
    .leftJoin(roles, eq(roles.id, usuarios.rolId))
    .where(and(eq(usuarios.empresaId, user.empresaId), isNull(usuarios.eliminadoEn)));

  const rolesList = await db
    .select({ id: roles.id, nombre: roles.nombre })
    .from(roles)
    .where(eq(roles.empresaId, user.empresaId));

  const columnas: Columna<Fila>[] = [
    {
      key: "nombre",
      header: "Usuario",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.nombre}</div>
          <div className="text-[11px] text-[color:var(--color-text-muted)]">{r.email}</div>
        </div>
      ),
    },
    {
      key: "rol",
      header: "Rol",
      cell: (r) => <Badge variant="info">{r.rol ?? "Sin rol"}</Badge>,
    },
    {
      key: "ultimoLogin",
      header: "Último acceso",
      cell: (r) =>
        r.ultimoLogin ? (
          formatearFechaHora(r.ultimoLogin)
        ) : (
          <span className="text-[color:var(--color-text-muted)]">Nunca</span>
        ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) =>
        r.activo ? <Badge variant="success">Activo</Badge> : <Badge variant="error">Inactivo</Badge>,
      width: "100px",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle={`${filas.length} usuarios con acceso`}
        actions={
          <CrearUsuarioForm
            roles={rolesList.map((r) => ({ value: r.id, label: r.nombre }))}
          />
        }
      />
      <DataTable data={filas} columns={columnas} rowKey={(r) => r.id} />
    </div>
  );
}
