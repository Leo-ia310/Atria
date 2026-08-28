import type { Metadata } from "next";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { ClipboardList, PackageSearch, Truck, WalletCards } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  almacenes,
  compras,
  existencias,
  ordenesCompra,
  productos,
  proveedores,
  restauranteProductos,
  sucursales,
  unidadesMedida,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { formatearFecha, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import {
  RestaurantCoreModulePage,
  RestaurantModuleGrid,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";
import { cantidad, estadoTone, labelEstado, numero } from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "Compras Restaurante | ARCA",
  description: "Compras, ordenes y reabastecimiento de restaurante sobre ARCA Core.",
};

type SugerenciaCompra = {
  id: string;
  nombre: string;
  sku: string;
  tipo: string;
  unidad: string | null;
  stock: number;
  minimo: number;
  sugerido: number;
};

export default async function RestauranteComprasPage() {
  const user = await requireSession();
  await requireModulo(user, "compras");
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sucursalIds = selectedSucursalIds(scope);

  const [filas, ordenes, stockRows] = await dbConEmpresa(user.empresaId, (tx) =>
    Promise.all([
      tx
        .select({
          id: compras.id,
          fecha: compras.fecha,
          numeroFactura: compras.numeroFactura,
          estado: compras.estado,
          esCredito: compras.esCredito,
          fechaVencimiento: compras.fechaVencimiento,
          impuesto: compras.impuesto,
          total: compras.total,
          proveedor: proveedores.razonSocial,
          sucursal: sucursales.nombre,
          almacen: almacenes.nombre,
        })
        .from(compras)
        .innerJoin(proveedores, eq(proveedores.id, compras.proveedorId))
        .innerJoin(almacenes, eq(almacenes.id, compras.almacenId))
        .leftJoin(sucursales, eq(sucursales.id, compras.sucursalId))
        .where(
          and(
            eq(compras.empresaId, user.empresaId),
            eq(proveedores.empresaId, user.empresaId),
            eq(almacenes.empresaId, user.empresaId),
            sucursalIds ? inArray(compras.sucursalId, sucursalIds) : undefined,
          ),
        )
        .orderBy(desc(compras.fecha), desc(compras.creadoEn))
        .limit(120),
      tx
        .select({
          estado: ordenesCompra.estado,
          cantidad: count(ordenesCompra.id),
          total: sql<string>`COALESCE(SUM(${ordenesCompra.total}), 0)`,
        })
        .from(ordenesCompra)
        .where(
          and(
            eq(ordenesCompra.empresaId, user.empresaId),
            sucursalIds ? inArray(ordenesCompra.sucursalId, sucursalIds) : undefined,
          ),
        )
        .groupBy(ordenesCompra.estado),
      tx
        .select({
          id: productos.id,
          nombre: productos.nombre,
          sku: productos.sku,
          tipo: restauranteProductos.tipo,
          unidad: unidadesMedida.codigo,
          stockMinimo: productos.stockMinimo,
          costoPromedio: productos.costoPromedio,
          stock: sql<string>`COALESCE(SUM(${existencias.cantidad}), 0)`,
        })
        .from(restauranteProductos)
        .innerJoin(productos, eq(productos.id, restauranteProductos.productoId))
        .leftJoin(unidadesMedida, eq(unidadesMedida.id, productos.unidadBaseId))
        .leftJoin(existencias, eq(existencias.productoId, productos.id))
        .leftJoin(almacenes, eq(almacenes.id, existencias.almacenId))
        .where(
          and(
            eq(restauranteProductos.empresaId, user.empresaId),
            eq(productos.empresaId, user.empresaId),
            isNull(productos.eliminadoEn),
            inArray(restauranteProductos.tipo, ["insumo", "preparacion", "producto_directo"]),
            sucursalIds ? inArray(almacenes.sucursalId, sucursalIds) : undefined,
          ),
        )
        .groupBy(productos.id, restauranteProductos.tipo, unidadesMedida.codigo)
        .orderBy(asc(productos.nombre))
        .limit(160),
    ]),
  );

  const totalCompras = filas.reduce((total, row) => total + numero(row.total), 0);
  const totalCredito = filas
    .filter((row) => row.esCredito && row.estado !== "anulada")
    .reduce((total, row) => total + numero(row.total), 0);
  const ordenesAbiertas = ordenes
    .filter((row) => row.estado !== "recibida" && row.estado !== "cancelada")
    .reduce((total, row) => total + row.cantidad, 0);
  const sugerencias = stockRows
    .reduce<SugerenciaCompra[]>((acc, row) => {
      const stock = numero(row.stock);
      const minimo = numero(row.stockMinimo);
      const sugerido = Math.max(minimo * 2 - stock, 0);
      if (minimo > 0 && stock <= minimo * 1.25) {
        acc.push({
          id: row.id,
          nombre: row.nombre,
          sku: row.sku,
          tipo: row.tipo,
          unidad: row.unidad,
          stock,
          minimo,
          sugerido,
        });
      }
      return acc;
    }, [])
    .sort((a, b) => b.sugerido - a.sugerido)
    .slice(0, 12);

  return (
    <RestaurantCoreModulePage
      eyebrow={scope.visible ? scope.etiqueta : "Compras restaurante"}
      title="Compras restaurante"
      subtitle="Proveedor, orden, recepcion, inventario, impuestos, CxP y contabilidad usando ARCA Core."
      actions={[
        { href: "/restaurante/proveedores", label: "Proveedores", icon: Truck },
        { href: "/restaurante/cxp", label: "CxP", icon: WalletCards },
        { href: "/restaurante/existencias", label: "Existencias", icon: PackageSearch },
      ]}
      kpis={[
        { label: "Compras recientes", value: String(filas.length), icon: ClipboardList },
        { label: "Total comprado", value: formatearMoneda(totalCompras, pais) },
        { label: "Compras a credito", value: formatearMoneda(totalCredito, pais) },
        { label: "OC abiertas", value: String(ordenesAbiertas), hint: "Borrador, enviadas o parciales" },
      ]}
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RestaurantModuleList
          title="Historial de compras"
          subtitle="Cada compra confirmada alimenta inventario, impuestos, CxP y asiento contable desde el core."
          empty="Aun no hay compras registradas para esta empresa."
          items={filas.map((row) => ({
            id: row.id,
            title: row.numeroFactura ? `Factura ${row.numeroFactura}` : row.proveedor,
            subtitle: `${row.proveedor} / ${row.sucursal ?? "Sin sucursal"} / ${row.almacen}`,
            meta: `${formatearFecha(row.fecha, pais)} / IVA ${formatearMoneda(row.impuesto, pais)}${row.fechaVencimiento ? ` / vence ${formatearFecha(row.fechaVencimiento, pais)}` : ""}`,
            value: formatearMoneda(row.total, pais),
            badge: row.esCredito ? "Credito" : labelEstado(row.estado),
            tone: row.esCredito ? "warning" : estadoTone(row.estado),
          }))}
        />
        <div className="space-y-4">
          <RestaurantModuleList
            title="Compras sugeridas"
            subtitle="Basadas en stock actual y minimo configurado. No generan obligaciones sin revision humana."
            empty="No hay sugerencias; el stock operativo esta sobre minimo."
            items={sugerencias.map((row) => ({
              id: row.id,
              title: row.nombre,
              subtitle: `${row.sku} / ${labelEstado(row.tipo)} / minimo ${cantidad(row.minimo)} ${row.unidad ?? ""}`,
              meta: `Stock actual ${cantidad(row.stock)} ${row.unidad ?? ""}`,
              value: `${cantidad(row.sugerido)} ${row.unidad ?? ""}`,
              badge: "Revisar compra",
              tone: "warning",
            }))}
          />
          <RestaurantModuleGrid
            title="Flujo conectado"
            subtitle="Entradas al mismo nucleo empresarial."
            actions={[
              { href: "/restaurante/compras", label: "Historial y recepciones" },
              { href: "/restaurante/proveedores", label: "Condiciones de proveedor" },
              { href: "/restaurante/cxp", label: "Cuentas por pagar" },
              { href: "/restaurante/contabilidad", label: "Asientos contables" },
            ]}
          />
        </div>
      </section>
    </RestaurantCoreModulePage>
  );
}
