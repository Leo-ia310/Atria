import Link from "next/link";
import { Truck, Plus, FileText } from "lucide-react";
import { count, desc, eq } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import {
  FiltrosListado,
  PaginacionListado,
} from "@/components/ui/FiltrosListado";
import { purchaseListWhere } from "@/lib/list-query";
import {
  hasListFilters,
  LIST_PAGE_SIZE,
  parseListFilters,
  type ListSearchParams,
} from "@/lib/list-filters";
import { compras, proveedores, sucursales } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatearMoneda, formatearFecha } from "@/lib/utils";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";

type Fila = {
  id: string;
  numeroFactura: string | null;
  fecha: string;
  proveedor: string;
  sucursal: string | null;
  total: string;
  esCredito: boolean;
  estado: string;
};

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>;
}) {
  const [user, sp] = await Promise.all([requireSession(), searchParams]);
  const filters = parseListFilters(sp, "compras");
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const sucursalIds = selectedSucursalIds(scope);

  const where = purchaseListWhere(user.empresaId, sucursalIds, filters);
  const { filas, total, pagina } = await dbConEmpresa(
    user.empresaId,
    async (tx) => {
      const [{ total }] = await tx
        .select({ total: count() })
        .from(compras)
        .innerJoin(proveedores, eq(proveedores.id, compras.proveedorId))
        .where(where);
      const pagina = Math.min(
        filters.pagina,
        Math.max(1, Math.ceil(total / LIST_PAGE_SIZE)),
      );
      const filas: Fila[] = await tx
        .select({
          id: compras.id,
          numeroFactura: compras.numeroFactura,
          fecha: compras.fecha,
          proveedor: proveedores.razonSocial,
          sucursal: sucursales.nombre,
          total: compras.total,
          esCredito: compras.esCredito,
          estado: compras.estado,
        })
        .from(compras)
        .innerJoin(proveedores, eq(proveedores.id, compras.proveedorId))
        .leftJoin(sucursales, eq(sucursales.id, compras.sucursalId))
        .where(where)
        .orderBy(desc(compras.fecha), desc(compras.creadoEn), desc(compras.id))
        .limit(LIST_PAGE_SIZE)
        .offset((pagina - 1) * LIST_PAGE_SIZE);
      return { filas, total, pagina };
    },
  );
  filters.pagina = pagina;

  const columnas: Columna<Fila>[] = [
    {
      key: "fecha",
      header: "Fecha",
      cell: (r) => formatearFecha(r.fecha, empresa?.pais ?? "NI"),
      width: "120px",
    },
    {
      key: "factura",
      header: "Factura",
      cell: (r) => r.numeroFactura ?? "—",
    },
    {
      key: "proveedor",
      header: "Proveedor",
      cell: (r) => <span className="font-medium">{r.proveedor}</span>,
    },
    ...(scope.visible
      ? [
          {
            key: "sucursal",
            header: "Sucursal",
            cell: (r: Fila) => r.sucursal ?? "Sin sucursal",
            width: "150px",
          } satisfies Columna<Fila>,
        ]
      : []),
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (r) => formatearMoneda(parseFloat(r.total), empresa?.pais ?? "NI"),
    },
    {
      key: "tipo",
      header: "Tipo",
      cell: (r) =>
        r.esCredito ? (
          <Badge variant="warning">Crédito</Badge>
        ) : (
          <Badge variant="neutral">Contado</Badge>
        ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) =>
        r.estado === "anulada" ? (
          <Badge variant="error">Anulada</Badge>
        ) : (
          <Badge variant="success">{r.estado}</Badge>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Compras"
        subtitle={`${total} compras${hasListFilters(filters) ? " encontradas" : " registradas"}${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
        actions={
          <div className="flex gap-2">
            <BotonExportarExcel recurso="compras" />
            <Link
              href="/compras/proveedores"
              className="arca-btn arca-btn-secondary arca-btn-sm"
            >
              <Truck size={14} /> Proveedores
            </Link>
            <Link
              href="/compras/nueva"
              className="arca-btn arca-btn-primary arca-btn-sm"
            >
              <Plus size={14} /> Nueva compra
            </Link>
          </div>
        }
      />
      <FiltrosListado kind="compras" path="/compras" value={filters} />
      <DataTable
        data={filas}
        columns={columnas}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={FileText}
            titulo={
              hasListFilters(filters)
                ? "No hay compras con estos filtros"
                : "Aún no hay compras"
            }
            descripcion={
              hasListFilters(filters)
                ? "Prueba otra búsqueda o limpia los filtros."
                : "Registra tu primera compra para alimentar inventario y CxP."
            }
            accion={
              <Link href="/compras/nueva">
                <Button size="sm">
                  <Plus size={14} /> Registrar primera compra
                </Button>
              </Link>
            }
          />
        }
      />
      <PaginacionListado path="/compras" value={filters} total={total} />
    </div>
  );
}
