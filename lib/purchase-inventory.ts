import { and, eq, inArray, sql } from "drizzle-orm";
import { movimientosInventario, existencias, productos } from "./db/schema";
import { dinero, aDecimalStr, type TX } from "./contabilidad/helpers";
/** Existing purchase inventory effect shared by immediate purchases and confirmed receiving. */
export async function applyPurchaseInventory(
  tx: TX,
  input: {
    empresaId: string;
    usuarioId: string;
    almacenId: string;
    referenciaTabla: string;
    referenciaId: string;
    tipo?: "entrada_compra" | "devolucion_proveedor";
    items: Array<{
      productoId: string;
      cantidad: number;
      costoUnitario: number;
    }>;
  },
) {
  await tx.insert(movimientosInventario).values(
    input.items.map((it) => ({
      empresaId: input.empresaId,
      productoId: it.productoId,
      almacenId: input.almacenId,
      tipo: input.tipo ?? "entrada_compra",
      cantidad: aDecimalStr(it.cantidad),
      costoUnitario: aDecimalStr(it.costoUnitario),
      referenciaTabla: input.referenciaTabla,
      referenciaId: input.referenciaId,
      usuarioId: input.usuarioId,
    })),
  );

  const productoIds = [...new Set(input.items.map((item) => item.productoId))];
  const [existenciasRows, productosRows] = await Promise.all([
    tx
      .select({
        productoId: existencias.productoId,
        cantidad: existencias.cantidad,
      })
      .from(existencias)
      .where(
        and(
          eq(existencias.empresaId, input.empresaId),
          eq(existencias.almacenId, input.almacenId),
          inArray(existencias.productoId, productoIds),
        ),
      ),
    tx
      .select({
        id: productos.id,
        costoActual: productos.costoPromedio,
        metodoCosteo: productos.metodoCosteo,
      })
      .from(productos)
      .where(
        and(
          eq(productos.empresaId, input.empresaId),
          inArray(productos.id, productoIds),
        ),
      ),
  ]);
  const stockPorProducto = new Map(
    existenciasRows.map((row) => [
      row.productoId,
      { cantidad: parseFloat(row.cantidad), existe: true },
    ]),
  );
  const costeoPorProducto = new Map(
    productosRows.map((producto) => [
      producto.id,
      {
        costoActual: parseFloat(producto.costoActual),
        metodoCosteo: producto.metodoCosteo,
      },
    ]),
  );

  const entradasPorProducto = new Map<
    string,
    { cantidad: number; costoTotal: number }
  >();
  for (const it of input.items) {
    const entrada = entradasPorProducto.get(it.productoId) ?? {
      cantidad: 0,
      costoTotal: 0,
    };
    entrada.cantidad += it.cantidad;
    entrada.costoTotal += it.cantidad * it.costoUnitario;
    entradasPorProducto.set(it.productoId, entrada);
  }

  await Promise.all(
    [...entradasPorProducto.entries()].map(async ([productoId, entrada]) => {
      const stock = stockPorProducto.get(productoId) ?? {
        cantidad: 0,
        existe: false,
      };

      if (stock.existe) {
        await tx
          .update(existencias)
          .set({
            cantidad: sql`${existencias.cantidad} + ${entrada.cantidad}`,
            actualizadoEn: new Date(),
          })
          .where(
            and(
              eq(existencias.empresaId, input.empresaId),
              eq(existencias.productoId, productoId),
              eq(existencias.almacenId, input.almacenId),
            ),
          );
      } else {
        await tx.insert(existencias).values({
          empresaId: input.empresaId,
          productoId,
          almacenId: input.almacenId,
          cantidad: aDecimalStr(entrada.cantidad),
        });
      }

      const prod = costeoPorProducto.get(productoId);
      if (
        prod?.metodoCosteo === "promedio" &&
        entrada.cantidad > 0 &&
        stock.cantidad + entrada.cantidad > 0
      ) {
        const nuevoCosto = dinero(
          (stock.cantidad * prod.costoActual + entrada.costoTotal) /
            (stock.cantidad + entrada.cantidad),
        );
        await tx
          .update(productos)
          .set({
            costoPromedio: aDecimalStr(nuevoCosto),
            actualizadoEn: new Date(),
          })
          .where(
            and(
              eq(productos.id, productoId),
              eq(productos.empresaId, input.empresaId),
            ),
          );
      }
    }),
  );
}
