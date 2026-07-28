import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { sucursales } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";

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
  const scope = await getSucursalScope(user);
  const sucursalIds = selectedSucursalIds(scope);

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
    .where(
      and(
        eq(sucursales.empresaId, user.empresaId),
        isNull(sucursales.eliminadoEn),
        sucursalIds ? inArray(sucursales.id, sucursalIds) : undefined,
      ),
    );

  const columnas: Columna<Fila>[] = [
    {
      key: "codigo",
      header: "Código",
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
    { key: "direccion", header: "Dirección", cell: (r) => r.direccion ?? "—" },
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
        subtitle={`${filas.length} sucursales · plan actual limita las disponibles${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
      />
      <DataTable data={filas} columns={columnas} rowKey={(r) => r.id} />
    </div>
  );
}
