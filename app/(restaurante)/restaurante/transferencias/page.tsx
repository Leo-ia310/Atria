import type { Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Repeat2, Truck } from "lucide-react";
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
import { cantidad, estadoTone } from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "Transferencias Restaurante | ARCA",
  description: "Transferencias de inventario restaurante entre almacenes.",
};

export default async function RestauranteTransferenciasPage() {
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
        referenciaId: movimientosInventario.referenciaId,
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
          eq(restauranteProductos.empresaId, user.empresaId),
          inArray(movimientosInventario.tipo, ["transferencia_entrada", "transferencia_salida"]),
          sucursalIds ? inArray(almacenes.sucursalId, sucursalIds) : undefined,
        ),
      )
      .orderBy(desc(movimientosInventario.creadoEn))
      .limit(120),
  );

  const entradas = rows.filter((row) => row.tipo === "transferencia_entrada").length;
  const salidas = rows.filter((row) => row.tipo === "transferencia_salida").length;

  return (
    <RestaurantCoreModulePage
      eyebrow={scope.visible ? scope.etiqueta : "Inventario multi-sucursal"}
      title="Transferencias"
      subtitle="Movimientos de traslado registrados como entrada y salida append-only."
      actions={[
        { href: "/restaurante/existencias", label: "Existencias", icon: Truck },
        { href: "/restaurante/movimientos", label: "Movimientos", icon: Repeat2 },
      ]}
      kpis={[
        { label: "Transferencias", value: String(rows.length), icon: Repeat2 },
        { label: "Entradas", value: String(entradas), hint: "Recepciones por traslado" },
        { label: "Salidas", value: String(salidas), hint: "Envios a otra ubicacion" },
        { label: "Almacenes tocados", value: String(new Set(rows.map((row) => row.almacen)).size) },
      ]}
    >
      <RestaurantModuleList
        title="Traslados recientes"
        subtitle="Cada linea conserva su referencia para reconstruir el traslado completo."
        empty="Aun no hay transferencias de inventario restaurante."
        items={rows.map((row) => ({
          id: row.id,
          title: row.producto,
          subtitle: `${row.sucursal ?? "Sin sucursal"} / ${row.almacen}`,
          meta: `${formatearFechaHora(row.creadoEn, pais, empresa?.zonaHoraria)}${row.notas ? ` / ${row.notas}` : ""}`,
          value: `${cantidad(row.cantidad)} - ${formatearMoneda(row.costoUnitario, pais)}`,
          badge: row.tipo === "transferencia_entrada" ? "Entrada" : "Salida",
          tone: estadoTone(row.tipo),
        }))}
      />
    </RestaurantCoreModulePage>
  );
}
