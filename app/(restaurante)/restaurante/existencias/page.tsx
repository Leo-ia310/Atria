import type { Metadata } from "next";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Boxes, PackageCheck, TriangleAlert } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  almacenes,
  existencias,
  lotes,
  productos,
  restauranteProductos,
  sucursales,
  unidadesMedida,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import {
  RestaurantCoreModulePage,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";
import { cantidad, estadoTone, labelEstado, numero } from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "Existencias Restaurante | ARCA",
  description: "Stock por almacen, lote y producto usando inventario core de ARCA.",
};

export default async function RestauranteExistenciasPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-inventario");
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sucursalIds = selectedSucursalIds(scope);

  const rows = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({
        productoId: productos.id,
        sku: productos.sku,
        nombre: productos.nombre,
        tipo: restauranteProductos.tipo,
        unidad: unidadesMedida.codigo,
        stockMinimo: productos.stockMinimo,
        costoPromedio: productos.costoPromedio,
        stock: sql<string>`COALESCE(SUM(${existencias.cantidad}), 0)`,
        reservado: sql<string>`COALESCE(SUM(${existencias.cantidadReservada}), 0)`,
        almacen: almacenes.nombre,
        sucursal: sucursales.nombre,
        lote: lotes.numero,
        vence: lotes.fechaVencimiento,
      })
      .from(restauranteProductos)
      .innerJoin(productos, eq(productos.id, restauranteProductos.productoId))
      .leftJoin(unidadesMedida, eq(unidadesMedida.id, productos.unidadBaseId))
      .leftJoin(existencias, eq(existencias.productoId, productos.id))
      .leftJoin(almacenes, eq(almacenes.id, existencias.almacenId))
      .leftJoin(sucursales, eq(sucursales.id, almacenes.sucursalId))
      .leftJoin(lotes, eq(lotes.id, existencias.loteId))
      .where(
        and(
          eq(restauranteProductos.empresaId, user.empresaId),
          eq(productos.empresaId, user.empresaId),
          isNull(productos.eliminadoEn),
          sucursalIds ? inArray(almacenes.sucursalId, sucursalIds) : undefined,
        ),
      )
      .groupBy(
        productos.id,
        restauranteProductos.tipo,
        unidadesMedida.codigo,
        almacenes.nombre,
        sucursales.nombre,
        lotes.numero,
        lotes.fechaVencimiento,
      )
      .orderBy(asc(productos.nombre), asc(almacenes.nombre))
      .limit(400),
  );

  const valorInventario = rows.reduce(
    (total, row) => total + numero(row.stock) * numero(row.costoPromedio),
    0,
  );
  const stockBajo = rows.filter(
    (row) => numero(row.stockMinimo) > 0 && numero(row.stock) <= numero(row.stockMinimo),
  );
  const hoy = new Date().toISOString().slice(0, 10);
  const limite = new Date();
  limite.setDate(limite.getDate() + 30);
  const limiteIso = limite.toISOString().slice(0, 10);
  const vencimientos = rows.filter((row) => row.vence && row.vence >= hoy && row.vence <= limiteIso);

  return (
    <RestaurantCoreModulePage
      eyebrow={scope.visible ? scope.etiqueta : "Inventario restaurante"}
      title="Existencias"
      subtitle="Stock por sucursal, almacen y lote usando el kardex de ARCA Core."
      actions={[
        { href: "/restaurante/inventario", label: "Insumos", icon: Boxes },
        { href: "/restaurante/movimientos", label: "Movimientos", icon: PackageCheck },
      ]}
      kpis={[
        { label: "Valor inventario", value: formatearMoneda(valorInventario, pais), icon: Boxes },
        { label: "Productos visibles", value: String(rows.length), hint: "Clasificados para restaurante" },
        { label: "Stock bajo", value: String(stockBajo.length), hint: "Igual o menor al minimo", icon: TriangleAlert },
        { label: "Vencen pronto", value: String(vencimientos.length), hint: "Proximos 30 dias" },
      ]}
    >
      <RestaurantModuleList
        title="Stock operativo"
        subtitle="Los platillos bajo demanda se controlan por receta; aqui ves insumos, directos y preparaciones."
        empty="Aun no hay existencias registradas para productos restaurante."
        items={rows.map((row) => {
          const stock = numero(row.stock);
          const bajo = numero(row.stockMinimo) > 0 && stock <= numero(row.stockMinimo);
          return {
            id: `${row.productoId}:${row.almacen ?? "sin-almacen"}:${row.lote ?? "sin-lote"}`,
            title: row.nombre,
            subtitle: `${row.sucursal ?? "Sin sucursal"} / ${row.almacen ?? "Sin almacen"} / ${row.lote ? `Lote ${row.lote}` : "Sin lote"}`,
            meta: `${row.sku} / ${labelEstado(row.tipo)} / Reservado ${cantidad(row.reservado)} ${row.unidad ?? ""}`,
            value: `${cantidad(stock)} ${row.unidad ?? ""}`,
            badge: bajo ? "Stock minimo" : row.vence ? `Vence ${row.vence}` : labelEstado(row.tipo),
            tone: bajo ? "warning" : estadoTone(row.tipo),
          };
        })}
      />
    </RestaurantCoreModulePage>
  );
}
