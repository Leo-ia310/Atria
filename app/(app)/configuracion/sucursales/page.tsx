import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { sucursales } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { CrearSucursalButton } from "@/components/configuracion/CrearSucursalButton";
import { getAccessContext } from "@/lib/server-access";

type Fila = {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string | null;
  esPrincipal: boolean;
  activa: boolean;
};

export default async function SucursalesPage() {
  const user = await requireSession();
  const access = await getAccessContext(user);

  const filas: Fila[] = await db
    .select({
      id: sucursales.id,
      codigo: sucursales.codigo,
      nombre: sucursales.nombre,
      direccion: sucursales.direccion,
      esPrincipal: sucursales.esPrincipal,
      activa: sucursales.activa,
    })
    .from(sucursales)
    .where(and(eq(sucursales.empresaId, user.empresaId), isNull(sucursales.eliminadoEn)));

  const activas = filas.filter((fila) => fila.activa).length;
  const limite =
    access.plan.maxSucursales === null
      ? null
      : access.plan.maxSucursales + access.sucursalesExtra;
  const limiteAlcanzado = limite !== null && activas >= limite;
  const limiteTexto =
    limite === null
      ? `${activas} sucursales activas - plan ${access.plan.nombre} sin limite`
      : `${activas}/${limite} sucursales activas - plan ${access.plan.nombre}`;

  const columnas: Columna<Fila>[] = [
    {
      key: "codigo",
      header: "Codigo",
      cell: (r) => <span className="font-mono text-[12px]">{r.codigo}</span>,
      width: "100px",
    },
    {
      key: "nombre",
      header: "Nombre",
      cell: (r) => (
        <span className="flex items-center gap-2">
          <span className="font-medium">{r.nombre}</span>
          {r.esPrincipal && <Badge variant="info">Principal</Badge>}
        </span>
      ),
    },
    { key: "direccion", header: "Direccion", cell: (r) => r.direccion ?? "-" },
    {
      key: "estado",
      header: "Estado",
      cell: (r) =>
        r.activa ? <Badge variant="success">Activa</Badge> : <Badge variant="neutral">Inactiva</Badge>,
      width: "100px",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Sucursales"
        subtitle={limiteTexto}
        actions={
          access.esAdminEmpresa ? (
            <CrearSucursalButton
              puedeCrear={!limiteAlcanzado}
              limiteTexto={
                limite === null
                  ? undefined
                  : `Tu plan ${access.plan.nombre} permite ${limite} sucursales activas. Ya tienes ${activas}.`
              }
            />
          ) : null
        }
      />
      <DataTable data={filas} columns={columnas} rowKey={(r) => r.id} />
    </div>
  );
}
