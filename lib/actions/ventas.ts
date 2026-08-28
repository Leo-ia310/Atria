"use server";

import { revalidatePath } from "next/cache";
import { and, eq, desc, inArray, isNull, sql } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import {
  ventas,
  ventaDetalle,
  pagosVenta,
  movimientosInventario,
  existencias,
  cuentasPorCobrar,
  formasPago as formasPagoTable,
  clientes,
  empresas,
  sesionesCaja,
  cajas,
  almacenes,
  productos,
  facturas,
  pedidosCocina,
  pedidoCocinaItems,
} from "@/lib/db/schema";
import { procesarVentaSchema } from "@/lib/validations/ventas";
import { requireSession } from "@/lib/actions/session-helpers";
import { validarAccion, validarLimitePlan } from "@/lib/server-access";
import { registrarVenta } from "@/lib/contabilidad/motor-asientos";
import { siguienteNumero, dinero, aDecimalStr } from "@/lib/contabilidad/helpers";
import { invalidarModulos } from "@/lib/redis/cache";
import { MODULOS } from "@/lib/redis/keys";
import { getPoliticasNegocio } from "@/lib/politicas-negocio";
import { fechaISOEnZona, fechaMediodiaUTC, horaMinutoEnZona, sumarDiasISO } from "@/lib/dates";

type Resultado =
  | { ok: true; ventaId: string; numero: string; asientoId: string }
  | { ok: false; error: string };

export async function procesarVenta(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { modulo: "pos", permisos: "ventas.crear" });
  if (!acceso.ok) return acceso;
  const parsed = procesarVentaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const [limiteTransacciones, limiteFacturas] = await Promise.all([
    validarLimitePlan(
      acceso.access,
      user.empresaId,
      "transacciones_mes",
    ),
    validarLimitePlan(
      acceso.access,
      user.empresaId,
      "facturas_mes",
    ),
  ]);
  if (!limiteTransacciones.ok) return limiteTransacciones;
  if (!limiteFacturas.ok) return limiteFacturas;
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

  let diasCreditoVenta = data.esCredito ? data.diasCredito : 0;

  if (data.esCredito) {
    if (!data.clienteId) {
      return { ok: false, error: "Venta al crédito requiere cliente" };
    }
    const clienteId = data.clienteId;
    const [cliente] = await dbConEmpresa(user.empresaId, (tx) =>
      tx
        .select({ limite: clientes.limiteCredito, dias: clientes.diasCredito })
        .from(clientes)
        .where(
          and(
            eq(clientes.id, clienteId),
            eq(clientes.empresaId, user.empresaId),
            isNull(clientes.eliminadoEn),
          ),
        )
        .limit(1),
    );
    if (!cliente) return { ok: false, error: "Cliente no encontrado" };
    if (parseFloat(cliente.limite) <= 0) {
      return { ok: false, error: "Cliente no tiene crédito habilitado" };
    }
    if (diasCreditoVenta <= 0) {
      const politicas = await getPoliticasNegocio(user.empresaId);
      diasCreditoVenta =
        cliente.dias > 0
          ? cliente.dias
          : politicas.diasCreditoClienteDefault;
    }
  }

  let clientePedidoNombre = "Consumidor final";
  if (data.clienteId) {
    const clienteId = data.clienteId;
    const [clientePedido] = await dbConEmpresa(user.empresaId, (tx) =>
      tx
        .select({ nombre: clientes.nombre })
        .from(clientes)
        .where(and(eq(clientes.id, clienteId), eq(clientes.empresaId, user.empresaId)))
        .limit(1),
    );
    clientePedidoNombre = clientePedido?.nombre ?? clientePedidoNombre;
  }

  // Enlazar la venta a la sesión de caja abierta (se resuelve en el servidor,
  // nunca se acepta del cliente). Se prioriza la sesión del propio cajero.
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
  if (almacen.sucursalId !== data.sucursalId) {
    return { ok: false, error: "La caja y el almacen deben pertenecer a la misma sucursal" };
  }

  const productoIds = [...new Set(data.items.map((item) => item.productoId))];
  const [productosVenta, stockRows, sesionesAbiertas, empresaRows] = await dbConEmpresa(
    user.empresaId,
    (tx) =>
      Promise.all([
        tx
          .select({ id: productos.id, tipo: productos.tipo, nombre: productos.nombre })
          .from(productos)
          .where(
            and(
              eq(productos.empresaId, user.empresaId),
              eq(productos.activo, true),
              isNull(productos.eliminadoEn),
              inArray(productos.id, productoIds),
            ),
          ),
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
          .select({ id: sesionesCaja.id, usuarioId: sesionesCaja.usuarioId })
          .from(sesionesCaja)
          .innerJoin(cajas, eq(cajas.id, sesionesCaja.cajaId))
          .where(
            and(
              eq(sesionesCaja.empresaId, user.empresaId),
              eq(sesionesCaja.estado, "abierta"),
              eq(cajas.empresaId, user.empresaId),
              eq(cajas.sucursalId, data.sucursalId),
            ),
          )
          .orderBy(desc(sesionesCaja.abiertaEn)),
        tx
          .select({ tipoEmpresa: empresas.tipoEmpresa, zonaHoraria: empresas.zonaHoraria })
          .from(empresas)
          .where(eq(empresas.id, user.empresaId))
          .limit(1),
      ]),
  );
  if (productosVenta.length !== productoIds.length) {
    return { ok: false, error: "Uno o mas productos no son validos" };
  }
  const tipoPorProducto = new Map(productosVenta.map((producto) => [producto.id, producto.tipo]));
  const nombrePorProducto = new Map(productosVenta.map((producto) => [producto.id, producto.nombre]));
  const esRestaurante = empresaRows[0]?.tipoEmpresa === "restaurante";
  const zonaHoraria = empresaRows[0]?.zonaHoraria ?? "America/Managua";
  const stockPorProducto = new Map(
    stockRows.map((row) => [row.productoId, parseFloat(row.cantidad)]),
  );
  for (const item of data.items) {
    if (tipoPorProducto.get(item.productoId) === "servicio") continue;
    const disponible = stockPorProducto.get(item.productoId) ?? 0;
    if (disponible < item.cantidad) {
      return { ok: false, error: "No hay stock suficiente en la sucursal seleccionada" };
    }
  }

  const sesionCajaId =
    sesionesAbiertas.find((s) => s.usuarioId === user.id)?.id ??
    sesionesAbiertas[0]?.id ??
    null;

  // Sin caja abierta no se registran ventas ni se genera factura.
  if (!sesionCajaId) {
    return {
      ok: false,
      error: "No hay una caja abierta. Abre una caja para registrar ventas.",
    };
  }

  try {
    const fechaVenta = new Date();
    const fechaLocalVenta = fechaISOEnZona(fechaVenta, zonaHoraria);
    const fechaContable = fechaMediodiaUTC(fechaLocalVenta);
    const fechaVencimiento = data.esCredito
      ? sumarDiasISO(fechaLocalVenta, diasCreditoVenta)
      : null;

    const resultado = await dbConEmpresa(user.empresaId, async (tx) => {
      const numero = await siguienteNumero(tx, {
        empresaId: user.empresaId,
        prefijo: "V",
        fecha: fechaContable,
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
          diasCredito: diasCreditoVenta,
          fechaVencimiento,
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

      if (esRestaurante) {
        const [pedido] = await tx
          .insert(pedidosCocina)
          .values({
            empresaId: user.empresaId,
            sucursalId: data.sucursalId,
            ventaId: venta.id,
            numero: `P-${numero}`,
            origen: "pos",
            clienteNombre: clientePedidoNombre,
            estado: "nuevo",
            notas: data.notas || null,
            creadoPor: user.id,
          })
          .returning({ id: pedidosCocina.id });

        await tx.insert(pedidoCocinaItems).values(
          data.items.map((it) => ({
            pedidoId: pedido.id,
            productoId: it.productoId,
            nombre: nombrePorProducto.get(it.productoId) ?? "Producto",
            cantidad: aDecimalStr(it.cantidad),
          })),
        );
      }

      const itemsInventario = data.items.filter(
        (it) => tipoPorProducto.get(it.productoId) !== "servicio",
      );
      if (itemsInventario.length > 0) {
        await tx.insert(movimientosInventario).values(
          itemsInventario.map((it) => ({
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
      }

      const cantidadPorProducto = new Map<string, number>();
      for (const item of itemsInventario) {
        cantidadPorProducto.set(
          item.productoId,
          (cantidadPorProducto.get(item.productoId) ?? 0) + item.cantidad,
        );
      }
      await Promise.all(
        [...cantidadPorProducto].map(([productoId, cantidad]) =>
          tx
            .update(existencias)
            .set({
              cantidad: sql`${existencias.cantidad} - ${cantidad}`,
              actualizadoEn: new Date(),
            })
            .where(
              and(
                eq(existencias.empresaId, user.empresaId),
                eq(existencias.productoId, productoId),
                eq(existencias.almacenId, data.almacenId),
              ),
            ),
        ),
      );

      if (data.esCredito && data.clienteId) {
        await tx.insert(cuentasPorCobrar).values({
          empresaId: user.empresaId,
          clienteId: data.clienteId,
          ventaId: venta.id,
          fechaEmision: fechaLocalVenta,
          fechaVencimiento: fechaVencimiento!,
          monto: aDecimalStr(total),
          saldo: aDecimalStr(total),
          estado: "pendiente",
        });
      }

      return venta;
    });

    const formaPagos = await dbConEmpresa(user.empresaId, (tx) =>
      tx
        .select({
          id: formasPagoTable.id,
          nombre: formasPagoTable.nombre,
          cuentaFinancieraId: formasPagoTable.cuentaFinancieraId,
        })
        .from(formasPagoTable)
        .where(eq(formasPagoTable.empresaId, user.empresaId)),
    );
    const mapaFormas = new Map(formaPagos.map((f) => [f.id, f.cuentaFinancieraId]));
    const mapaFormasNombre = new Map(formaPagos.map((f) => [f.id, f.nombre]));

    const pagosContables = data.esCredito
      ? undefined
      : data.pagos.reduce<{ cuentaFinancieraId: string; monto: number }[]>((acc, p) => {
          const cuentaFinancieraId = mapaFormas.get(p.formaPagoId);
          if (cuentaFinancieraId) {
            acc.push({ cuentaFinancieraId, monto: p.monto });
          }
          return acc;
        }, []);

    const asientoId = await registrarVenta({
      empresaId: user.empresaId,
      usuarioId: user.id,
      ventaId: resultado.id,
      fecha: fechaContable,
      numero: resultado.numero,
      subtotal,
      impuesto: impuestoTotal,
      total,
      costoTotal,
      esCredito: data.esCredito,
      sucursalId: data.sucursalId,
      pagos: pagosContables,
    });

    await dbConEmpresa(user.empresaId, (tx) =>
      tx
        .update(ventas)
        .set({ asientoId })
        .where(
          and(
            eq(ventas.id, resultado.id),
            eq(ventas.empresaId, user.empresaId),
          ),
        ),
    );

    // Guardar la factura (snapshot JSON) para el repositorio de facturas y la
    // reconstrucción del documento desde plantilla. No debe tumbar la venta.
    try {
      const idsProductos = [...new Set(data.items.map((i) => i.productoId))];
      const prods = idsProductos.length
        ? await dbConEmpresa(user.empresaId, (tx) =>
            tx
              .select({ id: productos.id, nombre: productos.nombre, sku: productos.sku })
              .from(productos)
              .where(
                and(
                  eq(productos.empresaId, user.empresaId),
                  inArray(productos.id, idsProductos),
                ),
              ),
          )
        : [];
      const mapaProd = new Map(prods.map((p) => [p.id, p]));

      let clienteNombre = "Consumidor final";
      if (data.clienteId) {
        const clienteId = data.clienteId;
        const [c] = await dbConEmpresa(user.empresaId, (tx) =>
          tx
            .select({ nombre: clientes.nombre })
            .from(clientes)
            .where(
              and(
                eq(clientes.id, clienteId),
                eq(clientes.empresaId, user.empresaId),
              ),
            )
            .limit(1),
        );
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
        fechaLocal: fechaLocalVenta,
        horaLocal: horaMinutoEnZona(fechaVenta, zonaHoraria),
        zonaHoraria,
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

      await dbConEmpresa(user.empresaId, (tx) =>
        tx
          .insert(facturas)
          .values({
            empresaId: user.empresaId,
            ventaId: resultado.id,
            numero: resultado.numero,
            fecha: fechaVenta,
            vendedorId: user.id,
            vendedorNombre: user.nombre,
            clienteNombre,
            formasPago: data.esCredito ? "Credito" : nombresFormas.join(", "),
          esCredito: data.esCredito,
          total: aDecimalStr(total),
          snapshot,
        })
          .onConflictDoUpdate({
            target: facturas.ventaId,
            set: {
              numero: resultado.numero,
              fecha: fechaVenta,
              vendedorId: user.id,
              vendedorNombre: user.nombre,
              clienteNombre,
              formasPago: data.esCredito ? "Credito" : nombresFormas.join(", "),
              esCredito: data.esCredito,
              total: aDecimalStr(total),
              snapshot,
            },
          }),
      );
    } catch (errFactura) {
      console.error("[procesarVenta:factura]", errFactura);
    }

    revalidatePath("/ventas");
    revalidatePath("/facturas");
    revalidatePath(data.esCredito ? "/facturas/credito" : "/facturas/cobradas");
    revalidatePath("/dashboard");

    // La venta ya está confirmada en Postgres (fuente de verdad); ahora
    // invalidamos la caché de esta empresa afectada por la venta: KPIs del
    // dashboard, reportes (ventas/inventario/rentabilidad) y saldos contables.
    await invalidarModulos(user.empresaId, [
      MODULOS.DASHBOARD,
      MODULOS.REPORTES,
      MODULOS.CONTABILIDAD,
    ]);

    return { ok: true, ventaId: resultado.id, numero: resultado.numero, asientoId };
  } catch (err) {
    console.error("[procesarVenta]", err);
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: `No pudimos procesar la venta: ${msg}` };
  }
}
