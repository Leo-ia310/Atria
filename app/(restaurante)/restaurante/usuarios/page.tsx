import type { Metadata } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { usuarios, roles } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo, getAccessContext } from "@/lib/server-access";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { CrearUsuarioForm } from "@/components/configuracion/CrearUsuarioForm";
import { UsuarioAcciones } from "@/components/configuracion/UsuarioAcciones";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";
import { formatearFechaHora } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Usuarios Restaurante | ARCA",
  description: "Gestion de usuarios con acceso a ARCA Restaurante.",
};

type Fila = {
  id: string;
  nombre: string;
  email: string;
  rolId: string | null;
  rol: string | null;
  activo: boolean;
  ultimoLogin: Date | null;
};

export default async function RestauranteUsuariosPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-configuracion");

  const [access, filas, rolesList] = await Promise.all([
    getAccessContext(user),
    db
      .select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        email: usuarios.email,
        rolId: usuarios.rolId,
        rol: roles.nombre,
        activo: usuarios.activo,
        ultimoLogin: usuarios.ultimoLogin,
      })
      .from(usuarios)
      .leftJoin(roles, eq(roles.id, usuarios.rolId))
      .where(and(eq(usuarios.empresaId, user.empresaId), isNull(usuarios.eliminadoEn))),
    db
      .select({ id: roles.id, nombre: roles.nombre })
      .from(roles)
      .where(eq(roles.empresaId, user.empresaId)),
  ]);

  const rolesOptions = rolesList.map((r) => ({ value: r.id, label: r.nombre }));
  const usuariosActivos = filas.filter((f) => f.activo).length;
  const limiteUsuarios =
    access.plan.maxUsuarios === null ? null : access.plan.maxUsuarios + access.usuariosExtra;
  const puedeCrearUsuario = limiteUsuarios === null || usuariosActivos < limiteUsuarios;
  const limiteTexto =
    limiteUsuarios === null
      ? undefined
      : `Tu plan ${access.plan.nombre} permite ${limiteUsuarios} usuarios activos. Ya tienes ${usuariosActivos}.`;

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
      header: "Ultimo acceso",
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
    {
      key: "acciones",
      header: "",
      cell: (r) =>
        rolesOptions.length > 0 ? (
          <UsuarioAcciones
            usuario={{
              id: r.id,
              nombre: r.nombre,
              email: r.email,
              rolId: r.rolId ?? rolesOptions[0].value,
              activo: r.activo,
            }}
            roles={rolesOptions}
          />
        ) : (
          <span className="text-[color:var(--color-text-muted)]">Sin rol</span>
        ),
      align: "right",
      width: "120px",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle={`${filas.length} usuarios con acceso al restaurante`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportarExcel recurso="usuarios" />
            <CrearUsuarioForm
              roles={rolesOptions}
              puedeCrear={puedeCrearUsuario}
              limiteTexto={limiteTexto}
            />
          </div>
        }
      />
      <DataTable data={filas} columns={columnas} rowKey={(r) => r.id} />
    </div>
  );
}
