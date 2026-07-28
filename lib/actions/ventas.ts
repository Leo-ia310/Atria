"use server";

import { revalidatePath } from "next/cache";
import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ventas,
  ventaDetalle,
  pagosVenta,
  movimientosInventario,
  existencias,
  cuentasPorCobrar,
  formasPago as formasPagoTable,
  clientes,
  sesionesCaja,
  productos,
  facturas,
} from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { procesarVentaSchema } from "@/lib/validations/ventas";
import { requireSession } from "@/lib/actions/session-helpers";
import { registrarVenta } from "@/lib/contabilidad/motor-asientos";
import { siguienteNumero, dinero, aDecimalStr } from "@/lib/contabilidad/helpers";

type Resultado =
  | { ok: true; ventaId: string; numero: string; asientoId: string }
  | { ok: false; error: string };

export async function procesarVenta(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const parsed = procesarVentaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const subtotal = dinero(
    ...data.items.map((i) => dinero(i.cantidad * i.precioUnitario - i.descuento)),
  );
  const impuestoTotal = dinero(...data.items.map((i) => i.impuesto));
  const descuentoTotal = dinero(
    ...data.items.map((i) => i.descuento),
    data.descuentoGlobal,
  );
  const total = dinero(subtotal + impuestoTotal - data.descuentoGlobal);
  const costoTotal = dinero(
    ...data.items.map((i) => dinero(i.cantidad * i.costoUnitario)),
  );

  const totalPagos = dinero(...data.pagos.map((p) => p.monto));
  if (!data.esCredito && Math.abs(totalPagos - total) > 0.01) {
    return {
      ok: false,
      error: `Los pagos (${totalPagos}) no cubren el total (${total})`,
    };
  }

  if (data.esCredito) {
    if (!data.clienteId) {
      return { ok: false, error: "Venta al crédito requiere cliente" };
    }
    const [cliente] = await db
      .select({ limite: clientes.limiteCredito, dias: clientes.diasCredito })
      .from(clientes)
      .where(eq(clientes.id, data.clienteId))
      .limit(1);
    if (!cliente) return { ok: false, error: "Cliente no encontrado" };
    if (parseFloat(cliente.limite) <= 0) {
      return { ok: false, error: "Cliente no tiene crédito habilitado" };
    }
  }

  // Enlazar la venta a la sesión de caja abierta (se resuelve en el servidor,
  // nunca se acepta del cliente). Se prioriza la sesión del propio cajero.
  const sesionesAbiertas = await db
    .select({ id: sesionesCaja.id, usuarioId: sesionesCaja.usuarioId })
    .from(sesionesCaja)
    .where(
      and(
        eq(sesionesCaja.empresaId, user.empresaId),
        eq(sesionesCaja.estado, "abierta"),
      ),
    )
    .orderBy(desc(sesionesCaja.abiertaEn));
  const sesionCajaId =
    sesionesAbiertas.find((s) => s.usuarioId === user.id)?.id ??
    sesionesAbiertas[0]?.id ??
    null;

  try {
    const fechaVenta = new Date();
    const fechaVencimiento = data.esCredito
      ? new Date(fechaVenta.getTime() + data.diasCredito * 24 * 3600 * 1000)
      : null;

    const resultado = await db.transaction(async (tx) => {
      const numero = await siguienteNumero(tx, {
        empresaId: user.empresaId,
        prefijo: "V",
        fecha: fechaVenta,
        tabla: ventas,
        columnaNumero: ventas.numero,
      });

      const [venta] = await tx
        .insert(ventas)
        .values({
          empresaId: user.empresaId,
          sucursalId: data.sucursalId,
          sesionCajaId,
          clienteId: data.clienteId || null,
          numero,
          fecha: fechaVenta,
          estado: "completada",
          esCredito: data.esCredito,
          diasCredito: data.diasCredito,
          fechaVencimiento: fechaVencimiento?.toISOString().slice(0, 10) ?? null,
          subtotal: aDecimalStr(subtotal),
          descuento: aDecimalStr(descuentoTotal),
          impuesto: aDecimalStr(impuestoTotal),
          total: aDecimalStr(total),
          costoTotal: aDecimalStr(costoTotal),
          notas: data.notas || null,
          usuarioId: user.id,
        })
        .returning({ id: ventas.id, numero: ventas.numero });

      await tx.insert(ventaDetalle).values(
        data.items.map((it) => ({
          ventaId: venta.id,
          productoId: it.productoId,
          cantidad: aDecimalStr(it.cantidad),
          precioUnitario: aDecimalStr(it.precioUnitario),
          descuento: aDecimalStr(it.descuento),
          impuesto: aDecimalStr(it.impuesto),
          costoUnitario: aDecimalStr(it.costoUnitario),
          subtotal: aDecimalStr(dinero(it.cantidad * it.precioUnitario - it.descuento)),
        })),
      );

      await tx.insert(pagosVenta).values(
        data.pagos.map((p) => ({
          ventaId: venta.id,
          formaPagoId: p.formaPagoId,
          monto: aDecimalStr(p.monto),
          referencia: p.referencia || null,
        })),
      );

      await tx.insert(movimientosInventario).values(
        data.items.map((it) => ({
          empresaId: user.empresaId,
          productoId: it.productoId,
          almacenId: data.almacenId,
          tipo: "salida_venta" as const,
          cantidad: aDecimalStr(-it.cantidad),
          costoUnitario: aDecimalStr(it.costoUnitario),
          referenciaTabla: "ventas",
          referenciaId: venta.id,
          usuarioId: user.id,
        })),
      );

      for (const it of data.items) {
        await tx
          .update(existencias)
          .set({
            cantidad: sql`${existencias.cantidad} - ${it.cantidad}`,
            actualizadoEn: new Date(),
          })
          .where(
            and(
              eq(existencias.productoId, it.productoId),
              eq(existencias.almacenId, data.almacenId),
            ),
          );
      }

      if (data.esCredito && data.clienteId) {
        await tx.insert(cuentasPorCobrar).values({
          empresaId: user.empresaId,
          clienteId: data.clienteId,
          ventaId: venta.id,
          fechaEmision: fechaVenta.toISOString().slice(0, 10),
          fechaVencimiento: fechaVencimiento!.toISOString().slice(0, 10),
          monto: aDecimalStr(total),
          saldo: aDecimalStr(total),
          estado: "pendiente",
        });
      }

      return venta;
    });

    const formaPagos = await db
      .select({
        id: formasPagoTable.id,
        nombre: formasPagoTable.nombre,
        cuentaFinancieraId: formasPagoTable.cuentaFinancieraId,
      })
      .from(formasPagoTable)
      .where(eq(formasPagoTable.empresaId, user.empresaId));
    const mapaFormas = new Map(formaPagos.map((f) => [f.id, f.cuentaFinancieraId]));
    const mapaFormasNombre = new Map(formaPagos.map((f) => [f.id, f.nombre]));

    const pagosContables = data.esCredito
      ? undefined
      : data.pagos
          .map((p) => ({
            cuentaFinancieraId: mapaFormas.get(p.formaPagoId)!,
            monto: p.monto,
          }))
          .filter((p) => p.cuentaFinancieraId);

    const asientoId = await registrarVenta({
      empresaId: user.empresaId,
      usuarioId: user.id,
      ventaId: resultado.id,
      fecha: fechaVenta,
      numero: resultado.numero,
      subtotal,
      impuesto: impuestoTotal,
      total,
      costoTotal,
      esCredito: data.esCredito,
      pagos: pagosContables,
    });

    await db
      .update(ventas)
      .set({ asientoId })
      .where(eq(ventas.id, resultado.id));

    // Guardar la factura (snapshot JSON) para el repositorio de facturas y la
    // reconstrucción del documento desde plantilla. No debe tumbar la venta.
    try {
      const idsProductos = [...new Set(data.items.map((i) => i.productoId))];
      const prods = idsProductos.length
        ? await db
            .select({ id: productos.id, nombre: productos.nombre, sku: productos.sku })
            .from(productos)
            .where(inArray(productos.id, idsProductos))
        : [];
      const mapaProd = new Map(prods.map((p) => [p.id, p]));

      let clienteNombre = "Consumidor final";
      if (data.clienteId) {
        const [c] = await db
          .select({ nombre: clientes.nombre })
          .from(clientes)
          .where(eq(clientes.id, data.clienteId))
          .limit(1);
        if (c) clienteNombre = c.nombre;
      }

      const nombresFormas = [
        ...new Set(
          data.pagos.map((p) => mapaFormasNombre.get(p.formaPagoId) ?? "Otro"),
        ),
      ];

      const snapshot = {
        numero: resultado.numero,
        fecha: fechaVenta.toISOString(),
        esCredito: data.esCredito,
        cliente: clienteNombre,
        cajero: user.nombre,
        items: data.items.map((it) => {
          const p = mapaProd.get(it.productoId);
          return {
            nombre: p?.nombre ?? "Producto",
            sku: p?.sku ?? "",
            cantidad: it.cantidad,
            precioUnitario: it.precioUnitario,
            descuento: it.descuento,
            impuesto: it.impuesto,
            subtotal: dinero(it.cantidad * it.precioUnitario - it.descuento),
          };
        }),
        pagos: data.pagos.map((p) => ({
          formaPago: mapaFormasNombre.get(p.formaPagoId) ?? "Otro",
          monto: p.monto,
          referencia: p.referencia || null,
        })),
        subtotal,
        descuento: descuentoTotal,
        impuesto: impuestoTotal,
        total,
      };

      await db
        .insert(facturas)
        .values({
          empresaId: user.empresaId,
          ventaId: resultado.id,
          numero: resultado.numero,
          fecha: fechaVenta,
          vendedorId: user.id,
          vendedorNombre: user.nombre,
          clienteNombre,
          formasPago: data.esCredito ? "Crédito" : nombresFormas.join(", "),
          esCredito: data.esCredito,
          total: aDecimalStr(total),
          snapshot,
        })
        .onConflictDoNothing();
    } catch (errFactura) {
      console.error("[procesarVenta:factura]", errFactura);
    }

    revalidatePath("/ventas");
    revalidatePath("/facturas");
    revalidatePath("/dashboard");

    return { ok: true, ventaId: resultado.id, numero: resultado.numero, asientoId };
  } catch (err) {
    console.error("[procesarVenta]", err);
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: `No pudimos procesar la venta: ${msg}` };
  }
}
