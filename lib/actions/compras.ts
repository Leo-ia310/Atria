"use server";

import { revalidatePath } from "next/cache";
import { invalidarModulos } from "@/lib/redis/cache";
import { MODULOS } from "@/lib/redis/keys";
import { and, eq, inArray, sql } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import {
  compras,
  compraDetalle,
  movimientosInventario,
  existencias,
  cuentasPorPagar,
  productos,
  almacenes,
} from "@/lib/db/schema";
import { procesarCompraSchema } from "@/lib/validations/compras";
import { requireSession } from "@/lib/actions/session-helpers";
import { validarAccion } from "@/lib/server-access";
import { registrarCompra } from "@/lib/contabilidad/motor-asientos";
import { siguienteNumero, dinero, aDecimalStr } from "@/lib/contabilidad/helpers";

type Resultado =
  | { ok: true; compraId: string; asientoId: string }
  | { ok: false; error: string };

export async function procesarCompra(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { modulo: "compras", permisos: "compras.crear" });
  if (!acceso.ok) return acceso;
  const parsed = procesarCompraSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  if (!data.esCredito && !data.cuentaFinancieraId) {
    return { ok: false, error: "Compra de contado requiere cuenta financiera" };
  }

  const [almacen] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({ id: almacenes.id, sucursalId: almacenes.sucursalId })
      .from(almacenes)
      .where(
        and(
          eq(almacenes.id, data.almacenId),
          eq(almacenes.empresaId, user.empresaId),
          eq(almacenes.activo, true),
        ),
      )
      .limit(1),
  );
  if (!almacen) {
    return { ok: false, error: "Almacen no valido para esta empresa" };
  }

  const subtotal = dinero(
    ...data.items.map((i) => dinero(i.cantidad * i.costoUnitario)),
  );
  const impuesto = dinero(...data.items.map((i) => i.impuesto));
  const total = dinero(subtotal + impuesto);

  try {
    const fecha = new Date(data.fecha);
    const fechaVencimiento = data.esCredito
      ? new Date(fecha.getTime() + data.diasCredito * 24 * 3600 * 1000)
      : null;

    const compraResult = await dbConEmpresa(user.empresaId, async (tx) => {
      const numeroAuto = await siguienteNumero(tx, {
        empresaId: user.empresaId,
        prefijo: "C",
        fecha,
        tabla: compras as never,
        columnaNumero: compras.numeroFactura as never,
      });
      void numeroAuto;

      const [compra] = await tx
        .insert(compras)
        .values({
          empresaId: user.empresaId,
          sucursalId: almacen.sucursalId,
          almacenId: data.almacenId,
          proveedorId: data.proveedorId,
          numeroFactura: data.numeroFactura || null,
          fecha: data.fecha,
          estado: "recibida",
          esCredito: data.esCredito,
          diasCredito: data.diasCredito,
          fechaVencimiento: fechaVencimiento?.toISOString().slice(0, 10) ?? null,
          subtotal: aDecimalStr(subtotal),
          impuesto: aDecimalStr(impuesto),
          total: aDecimalStr(total),
          notas: data.notas || null,
          usuarioId: user.id,
        })
        .returning({ id: compras.id });

      await tx.insert(compraDetalle).values(
        data.items.map((it) => ({
          compraId: compra.id,
          productoId: it.productoId,
          cantidad: aDecimalStr(it.cantidad),
          costoUnitario: aDecimalStr(it.costoUnitario),
          impuesto: aDecimalStr(it.impuesto),
          subtotal: aDecimalStr(dinero(it.cantidad * it.costoUnitario)),
        })),
      );

      await tx.insert(movimientosInventario).values(
        data.items.map((it) => ({
          empresaId: user.empresaId,
          productoId: it.productoId,
          almacenId: data.almacenId,
          tipo: "entrada_compra" as const,
          cantidad: aDecimalStr(it.cantidad),
          costoUnitario: aDecimalStr(it.costoUnitario),
          referenciaTabla: "compras",
          referenciaId: compra.id,
          usuarioId: user.id,
        })),
      );

      const productoIds = [...new Set(data.items.map((item) => item.productoId))];
      const [existenciasRows, productosRows] = await Promise.all([
        tx
          .select({
            productoId: existencias.productoId,
            cantidad: existencias.cantidad,
          })
          .from(existencias)
          .where(
            and(
              eq(existencias.empresaId, user.empresaId),
              eq(existencias.almacenId, data.almacenId),
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
              eq(productos.empresaId, user.empresaId),
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

      for (const it of data.items) {
        const stock = stockPorProducto.get(it.productoId) ?? {
          cantidad: 0,
          existe: false,
        };

        if (stock.existe) {
          await tx
            .update(existencias)
            .set({
              cantidad: sql`${existencias.cantidad} + ${it.cantidad}`,
              actualizadoEn: new Date(),
            })
            .where(
              and(
                eq(existencias.empresaId, user.empresaId),
                eq(existencias.productoId, it.productoId),
                eq(existencias.almacenId, data.almacenId),
              ),
            );
        } else {
          await tx.insert(existencias).values({
            empresaId: user.empresaId,
            productoId: it.productoId,
            almacenId: data.almacenId,
            cantidad: aDecimalStr(it.cantidad),
          });
        }

        const prod = costeoPorProducto.get(it.productoId);
        if (prod?.metodoCosteo === "promedio") {
          const nuevoCosto = dinero(
            (stock.cantidad * prod.costoActual + it.cantidad * it.costoUnitario) /
              (stock.cantidad + it.cantidad),
          );
          await tx
            .update(productos)
            .set({ costoPromedio: aDecimalStr(nuevoCosto), actualizadoEn: new Date() })
            .where(
              and(
                eq(productos.id, it.productoId),
                eq(productos.empresaId, user.empresaId),
              ),
            );
          prod.costoActual = nuevoCosto;
        }

        stock.cantidad += it.cantidad;
        stock.existe = true;
        stockPorProducto.set(it.productoId, stock);
      }

      if (data.esCredito) {
        await tx.insert(cuentasPorPagar).values({
          empresaId: user.empresaId,
          proveedorId: data.proveedorId,
          compraId: compra.id,
          fechaEmision: data.fecha,
          fechaVencimiento: fechaVencimiento!.toISOString().slice(0, 10),
          monto: aDecimalStr(total),
          saldo: aDecimalStr(total),
          estado: "pendiente",
        });
      }

      return compra;
    });

    const asientoId = await registrarCompra({
      empresaId: user.empresaId,
      usuarioId: user.id,
      compraId: compraResult.id,
      fecha,
      numeroFactura: data.numeroFactura ?? null,
      subtotal,
      impuesto,
      total,
      esCredito: data.esCredito,
      cuentaFinancieraId: data.cuentaFinancieraId || undefined,
    });

    await dbConEmpresa(user.empresaId, (tx) =>
      tx
        .update(compras)
        .set({ asientoId })
        .where(
          and(
            eq(compras.id, compraResult.id),
            eq(compras.empresaId, user.empresaId),
          ),
        ),
    );

    revalidatePath("/compras");
    revalidatePath("/inventario");
    await invalidarModulos(user.empresaId, [MODULOS.REPORTES, MODULOS.CONTABILIDAD]);

    return { ok: true, compraId: compraResult.id, asientoId };
  } catch (err) {
    console.error("[procesarCompra]", err);
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: `No pudimos procesar la compra: ${msg}` };
  }
}
