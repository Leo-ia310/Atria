import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { almacenes, existencias, productoAdvertencias, productos } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatearMoneda, desdeDecimal } from "@/lib/utils";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { InventarioImportador } from "@/components/productos/InventarioImportador";
import { InventarioAdvertencias } from "@/components/productos/InventarioAdvertencias";

type Fila = {
  id: string;
  sku: string;
  nombre: string;
  precio: string;
  costo: string;
  existencia: number;
  stockMinimo: string;
  activo: boolean;
};

export default async function InventarioPage() {
  const user = await requireSession();
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const sucursalIds = selectedSucursalIds(scope);

  const stockRows = await db
    .select({
      productoId: existencias.productoId,
      existencia: sql<string>`COALESCE(SUM(${existencias.cantidad}), 0)`,
    })
    .from(existencias)
    .innerJoin(almacenes, eq(almacenes.id, existencias.almacenId))
    .where(
      and(
        eq(existencias.empresaId, user.empresaId),
        eq(almacenes.empresaId, user.empresaId),
        eq(almacenes.activo, true),
        sucursalIds ? inArray(almacenes.sucursalId, sucursalIds) : undefined,
      ),
    )
    .groupBy(existencias.productoId);
  const existenciaPorProducto = new Map(
    stockRows.map((row) => [row.productoId, parseFloat(row.existencia)]),
  );
  const productoIdsEnScope = sucursalIds ? stockRows.map((row) => row.productoId) : null;

  const productosRows =
    productoIdsEnScope && productoIdsEnScope.length === 0
      ? []
      : await db
          .select({
            id: productos.id,
            sku: productos.sku,
            nombre: productos.nombre,
            precio: productos.precioBase,
            costo: productos.costoPromedio,
            stockMinimo: productos.stockMinimo,
            activo: productos.activo,
          })
          .from(productos)
          .where(
            and(
              eq(productos.empresaId, user.empresaId),
              isNull(productos.eliminadoEn),
              productoIdsEnScope ? inArray(productos.id, productoIdsEnScope) : undefined,
            ),
          )
          .orderBy(desc(productos.creadoEn))
          .limit(200);
  const filas: Fila[] = productosRows.map((producto) => ({
    ...producto,
    existencia: existenciaPorProducto.get(producto.id) ?? 0,
  }));
  const advertencias = await db
    .select({
      id: productoAdvertencias.id,
      productoId: productoAdvertencias.productoId,
      producto: productos.nombre,
      sku: productos.sku,
      filaExcel: productoAdvertencias.filaExcel,
      campo: productoAdvertencias.campo,
      mensaje: productoAdvertencias.mensaje,
      valorOriginal: productoAdvertencias.valorOriginal,
    })
    .from(productoAdvertencias)
    .innerJoin(productos, eq(productos.id, productoAdvertencias.productoId))
    .where(
      and(
        eq(productoAdvertencias.empresaId, user.empresaId),
        eq(productoAdvertencias.resuelta, false),
        eq(productos.empresaId, user.empresaId),
        isNull(productos.eliminadoEn),
      ),
    )
    .orderBy(desc(productoAdvertencias.creadoEn))
    .limit(100);

  const columnas: Columna<Fila>[] = [
    { key: "sku", header: "SKU", cell: (r) => <span className="font-mono text-[12px]">{r.sku}</span>, width: "120px" },
    {
      key: "nombre",
      header: "Producto",
      cell: (r) => <span className="font-medium">{r.nombre}</span>,
    },
    {
      key: "precio",
      header: "Precio",
      align: "right",
      cell: (r) => formatearMoneda(desdeDecimal(r.precio), empresa?.pais ?? "NI"),
    },
    {
      key: "costo",
      header: "Costo prom.",
      align: "right",
      cell: (r) => (
        <span className="text-[color:var(--color-text-muted)]">
          {formatearMoneda(desdeDecimal(r.costo), empresa?.pais ?? "NI")}
        </span>
      ),
    },
    {
      key: "existencia",
      header: "Existencia",
      align: "right",
      cell: (r) => r.existencia.toFixed(2),
      width: "110px",
    },
    {
      key: "stockMinimo",
      header: "Stock mín.",
      align: "right",
      cell: (r) => desdeDecimal(r.stockMinimo).toFixed(0),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) =>
        r.activo ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="neutral">Inactivo</Badge>
        ),
      width: "100px",
    },
    {
      key: "accion",
      header: "",
      cell: (r) => (
        <Link
          href={`/inventario/${r.id}`}
          className="text-[color:var(--color-secondary)] hover:underline"
        >
          Editar →
        </Link>
      ),
      align: "right",
      width: "100px",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Inventario"
        subtitle={`${filas.length} productos en el catálogo${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <InventarioAdvertencias advertencias={advertencias} />
            <InventarioImportador pais={empresa?.pais ?? "NI"} />
            <Link href="/inventario/nuevo" className="arca-btn arca-btn-primary arca-btn-sm">
              <Plus size={14} /> Nuevo producto
            </Link>
          </div>
        }
      />

      <DataTable<Fila>
        data={filas}
        columns={columnas}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={Package}
            titulo={sucursalIds ? "Sin productos en esta sucursal" : "Aun no hay productos"}
            descripcion={
              sucursalIds
                ? "Registra compras o mueve inventario hacia las sucursales seleccionadas."
                : "Crea tu primer producto para empezar a vender."
            }
            accion={
              <Link href={sucursalIds ? "/compras/nueva" : "/inventario/nuevo"}>
                <Button size="sm">
                  <Plus size={14} /> {sucursalIds ? "Registrar compra" : "Crear primer producto"}
                </Button>
              </Link>
            }
          />
        }
      />
    </div>
  );
}
