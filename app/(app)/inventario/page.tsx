import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { almacenes, categorias, existencias, productoAdvertencias, productos } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { desdeDecimal } from "@/lib/utils";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { InventarioImportador } from "@/components/productos/InventarioImportador";
import { InventarioAdvertencias } from "@/components/productos/InventarioAdvertencias";
import { InventarioLectorBarras } from "@/components/productos/InventarioLectorBarras";
import { AsistenteProductoIA } from "@/components/productos/AsistenteProductoIA";
import { InventarioBuscador } from "@/components/productos/InventarioBuscador";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";

type Fila = {
  id: string;
  sku: string;
  nombre: string;
  categoria: string;
  codigoBarras: string;
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

  const [almacenEntrada] = await db
    .select({ id: almacenes.id, nombre: almacenes.nombre })
    .from(almacenes)
    .where(
      and(
        eq(almacenes.empresaId, user.empresaId),
        eq(almacenes.activo, true),
        sucursalIds ? inArray(almacenes.sucursalId, sucursalIds) : undefined,
      ),
    )
    .orderBy(desc(almacenes.esPrincipal), almacenes.nombre)
    .limit(1);

  const productosLector = await db
    .select({
      id: productos.id,
      sku: productos.sku,
      codigoBarras: productos.codigoBarras,
      nombre: productos.nombre,
      precioBase: productos.precioBase,
      costoPromedio: productos.costoPromedio,
    })
    .from(productos)
    .where(
      and(
        eq(productos.empresaId, user.empresaId),
        eq(productos.activo, true),
        isNull(productos.eliminadoEn),
        sql<boolean>`${productos.codigoBarras} IS NOT NULL AND ${productos.codigoBarras} <> ''`,
      ),
    )
    .limit(5000);

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
            categoria: categorias.nombre,
            codigoBarras: productos.codigoBarras,
            precio: productos.precioBase,
            costo: productos.costoPromedio,
            stockMinimo: productos.stockMinimo,
            activo: productos.activo,
          })
          .from(productos)
          .leftJoin(
            categorias,
            and(
              eq(categorias.id, productos.categoriaId),
              eq(categorias.empresaId, user.empresaId),
            ),
          )
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
    categoria: producto.categoria ?? "",
    codigoBarras: producto.codigoBarras ?? "",
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

  return (
    <div>
      <PageHeader
        title="Inventario"
        subtitle={`${filas.length} productos en el catálogo${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportarExcel recurso="inventario" />
            <InventarioAdvertencias advertencias={advertencias} />
            <InventarioLectorBarras
              pais={empresa?.pais ?? "NI"}
              almacen={almacenEntrada}
              productos={productosLector.map((p) => ({
                id: p.id,
                sku: p.sku,
                codigoBarras: p.codigoBarras ?? "",
                nombre: p.nombre,
                precioBase: desdeDecimal(p.precioBase),
                costoPromedio: desdeDecimal(p.costoPromedio),
              }))}
            />
            <AsistenteProductoIA />
            <InventarioImportador pais={empresa?.pais ?? "NI"} />
            <Link href="/inventario/nuevo" className="arca-btn arca-btn-primary arca-btn-sm">
              <Plus size={14} /> Nuevo producto
            </Link>
          </div>
        }
      />

      {filas.length === 0 ? (
        <div className="arca-card p-8">
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
        </div>
      ) : (
        <InventarioBuscador filas={filas} pais={empresa?.pais ?? "NI"} />
      )}
    </div>
  );
}
