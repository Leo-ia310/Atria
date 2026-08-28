import type { Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import { History, PackageCheck } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  almacenes,
  movimientosInventario,
  productos,
  restauranteProductos,
  sucursales,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { formatearFechaHora, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import {
  RestaurantCoreModulePage,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";
import { cantidad, estadoTone, labelEstado, numero } from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "Movimientos Restaurante | ARCA",
  description: "Kardex append-only de inventario restaurante en ARCA.",
};

export default async function RestauranteMovimientosPage() {
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
        id: movimientosInventario.id,
        tipo: movimientosInventario.tipo,
        cantidad: movimientosInventario.cantidad,
        costoUnitario: movimientosInventario.costoUnitario,
        referenciaTabla: movimientosInventario.referenciaTabla,
        notas: movimientosInventario.notas,
        creadoEn: movimientosInventario.creadoEn,
        producto: productos.nombre,
        almacen: almacenes.nombre,
        sucursal: sucursales.nombre,
      })
      .from(movimientosInventario)
      .innerJoin(productos, eq(productos.id, movimientosInventario.productoId))
      .innerJoin(restauranteProductos, eq(restauranteProductos.productoId, productos.id))
      .innerJoin(almacenes, eq(almacenes.id, movimientosInventario.almacenId))
      .leftJoin(sucursales, eq(sucursales.id, almacenes.sucursalId))
      .where(
        and(
          eq(movimientosInventario.empresaId, user.empresaId),
          eq(productos.empresaId, user.empresaId),
          eq(restauranteProductos.empresaId, user.empresaId),
          sucursalIds ? inArray(almacenes.sucursalId, sucursalIds) : undefined,
        ),
      )
      .orderBy(desc(movimientosInventario.creadoEn))
      .limit(150),
  );

  const entradas = rows.filter((row) => numero(row.cantidad) > 0).length;
  const salidas = rows.filter((row) => numero(row.cantidad) < 0).length;
  const valorMovido = rows.reduce(
    (total, row) => total + Math.abs(numero(row.cantidad) * numero(row.costoUnitario)),
    0,
  );

  return (
    <RestaurantCoreModulePage
      eyebrow={scope.visible ? scope.etiqueta : "Kardex restaurante"}
      title="Movimientos de inventario"
      subtitle="Historial append-only: entradas, salidas, mermas, ventas y transferencias."
      actions={[
        { href: "/restaurante/existencias", label: "Existencias", icon: PackageCheck },
        { href: "/restaurante/transferencias", label: "Transferencias", icon: History },
      ]}
      kpis={[
        { label: "Movimientos", value: String(rows.length), hint: "Ultimos registros", icon: History },
        { label: "Entradas", value: String(entradas), hint: "Compras, ajustes o transferencias" },
        { label: "Salidas", value: String(salidas), hint: "Ventas, mermas o ajustes" },
        { label: "Valor movido", value: formatearMoneda(valorMovido, pais) },
      ]}
    >
      <RestaurantModuleList
        title="Kardex reciente"
        subtitle="No se edita ni elimina; una correccion debe ser otro movimiento."
        empty="Aun no hay movimientos de inventario para restaurante."
        items={rows.map((row) => ({
          id: row.id,
          title: row.producto,
          subtitle: `${row.sucursal ?? "Sin sucursal"} / ${row.almacen} / ${formatearFechaHora(row.creadoEn, pais, empresa?.zonaHoraria)}`,
          meta: `${labelEstado(row.tipo)}${row.referenciaTabla ? ` / ${row.referenciaTabla}` : ""}${row.notas ? ` / ${row.notas}` : ""}`,
          value: `${cantidad(row.cantidad)} x ${formatearMoneda(row.costoUnitario, pais)}`,
          badge: numero(row.cantidad) >= 0 ? "Entrada" : "Salida",
          tone: numero(row.cantidad) >= 0 ? "success" : estadoTone(row.tipo),
        }))}
      />
    </RestaurantCoreModulePage>
  );
}
