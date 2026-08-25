import "server-only";

import { and, asc, count, desc, eq, gte, inArray, isNull, lt, ne, sql, sum } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import {
  existencias,
  productos,
  restauranteComandas,
  restauranteListaEspera,
  restauranteMesas,
  restauranteMermas,
  restauranteOrdenItems,
  restauranteOrdenes,
  restaurantePromociones,
  restauranteRecetas,
  restauranteReservaciones,
  restauranteProductos,
  ventas,
} from "@/lib/db/schema";
import { fechaISOEnZona } from "@/lib/dates";

export type DashboardRestauranteData = {
  ventasHoy: number;
  ventasAyer: number;
  ordenesHoy: number;
  ordenesAbiertas: number;
  ticketPromedio: number;
  comensalesAtendidos: number;
  mesas: Record<string, number>;
  reservacionesProximas: number;
  listaEspera: number;
  pedidosCocina: number;
  tiempoPromedioPreparacionMin: number;
  foodCostPct: number;
  margenBruto: number;
  mermasHoy: number;
  promocionesActivas: number;
  topPlatillos: Array<{ nombre: string; unidades: number; ingresos: number }>;
  insumosBajos: Array<{ id: string; nombre: string; stock: number; minimo: number }>;
  insumosVencen: Array<{ id: string; nombre: string; fecha: string }>;
};

export async function cargarDashboardRestaurante({
  empresaId,
  sucursalIds,
  zonaHoraria,
}: {
  empresaId: string;
  sucursalIds: string[] | null;
  zonaHoraria: string;
}): Promise<DashboardRestauranteData> {
  const hoy = fechaISOEnZona(new Date(), zonaHoraria);
  const ayerDate = new Date();
  ayerDate.setDate(ayerDate.getDate() - 1);
  const ayer = fechaISOEnZona(ayerDate, zonaHoraria);
  const filtroSucursalVenta = sucursalIds ? inArray(ventas.sucursalId, sucursalIds) : undefined;
  const filtroSucursalOrden = sucursalIds
    ? inArray(restauranteOrdenes.sucursalId, sucursalIds)
    : undefined;
  const filtroSucursalMesa = sucursalIds ? inArray(restauranteMesas.sucursalId, sucursalIds) : undefined;
  const filtroSucursalComanda = sucursalIds
    ? inArray(restauranteComandas.sucursalId, sucursalIds)
    : undefined;
  const filtroSucursalReserva = sucursalIds
    ? inArray(restauranteReservaciones.sucursalId, sucursalIds)
    : undefined;
  const filtroSucursalEspera = sucursalIds
    ? inArray(restauranteListaEspera.sucursalId, sucursalIds)
    : undefined;
  const filtroSucursalMerma = sucursalIds
    ? inArray(restauranteMermas.sucursalId, sucursalIds)
    : undefined;

  return dbConEmpresa(empresaId, async (tx) => {
    const [
      ventasHoyRows,
      ventasAyerRows,
      ordenesHoyRows,
      ordenesAbiertasRows,
      ticketRows,
      mesasRows,
      reservasRows,
      esperaRows,
      cocinaRows,
      prepRows,
      mermasRows,
      promosRows,
      topRows,
      stockRows,
      vencenRows,
    ] = await Promise.all([
      tx
        .select({ total: sum(ventas.total), costo: sum(ventas.costoTotal) })
        .from(ventas)
        .where(
          and(
            eq(ventas.empresaId, empresaId),
            isNull(ventas.anuladoEn),
            sql`(${ventas.fecha} AT TIME ZONE ${zonaHoraria})::date = ${hoy}`,
            filtroSucursalVenta,
          ),
        ),
      tx
        .select({ total: sum(ventas.total) })
        .from(ventas)
        .where(
          and(
            eq(ventas.empresaId, empresaId),
            isNull(ventas.anuladoEn),
            sql`(${ventas.fecha} AT TIME ZONE ${zonaHoraria})::date = ${ayer}`,
            filtroSucursalVenta,
          ),
        ),
      tx
        .select({ n: count() })
        .from(restauranteOrdenes)
        .where(
          and(
            eq(restauranteOrdenes.empresaId, empresaId),
            sql`(${restauranteOrdenes.abiertoEn} AT TIME ZONE ${zonaHoraria})::date = ${hoy}`,
            filtroSucursalOrden,
          ),
        ),
      tx
        .select({ n: count() })
        .from(restauranteOrdenes)
        .where(
          and(
            eq(restauranteOrdenes.empresaId, empresaId),
            inArray(restauranteOrdenes.estado, [
              "abierta",
              "borrador",
              "en_cocina",
              "cuenta_solicitada",
            ]),
            filtroSucursalOrden,
          ),
        ),
      tx
        .select({
          promedio: sql<string>`COALESCE(AVG(${restauranteOrdenes.total}), 0)`,
          personas: sql<string>`COALESCE(SUM(${restauranteOrdenes.personas}), 0)`,
        })
        .from(restauranteOrdenes)
        .where(
          and(
            eq(restauranteOrdenes.empresaId, empresaId),
            sql`(${restauranteOrdenes.abiertoEn} AT TIME ZONE ${zonaHoraria})::date = ${hoy}`,
            ne(restauranteOrdenes.estado, "cancelada"),
            filtroSucursalOrden,
          ),
        ),
      tx
        .select({ estado: restauranteMesas.estado, n: count() })
        .from(restauranteMesas)
        .where(and(eq(restauranteMesas.empresaId, empresaId), filtroSucursalMesa))
        .groupBy(restauranteMesas.estado),
      tx
        .select({ n: count() })
        .from(restauranteReservaciones)
        .where(
          and(
            eq(restauranteReservaciones.empresaId, empresaId),
            gte(restauranteReservaciones.fecha, hoy),
            inArray(restauranteReservaciones.estado, ["pendiente", "confirmada"]),
            filtroSucursalReserva,
          ),
        ),
      tx
        .select({ n: count() })
        .from(restauranteListaEspera)
        .where(
          and(
            eq(restauranteListaEspera.empresaId, empresaId),
            inArray(restauranteListaEspera.estado, ["esperando", "notificado"]),
            filtroSucursalEspera,
          ),
        ),
      tx
        .select({ n: count() })
        .from(restauranteComandas)
        .where(
          and(
            eq(restauranteComandas.empresaId, empresaId),
            inArray(restauranteComandas.estado, ["enviada", "recibida", "preparando"]),
            filtroSucursalComanda,
          ),
        ),
      tx
        .select({
          min: sql<string>`COALESCE(AVG(EXTRACT(EPOCH FROM (${restauranteComandas.listaEn} - ${restauranteComandas.enviadaEn})) / 60), 0)`,
        })
        .from(restauranteComandas)
        .where(
          and(
            eq(restauranteComandas.empresaId, empresaId),
            sql`${restauranteComandas.listaEn} IS NOT NULL`,
            filtroSucursalComanda,
          ),
        ),
      tx
        .select({ n: count() })
        .from(restauranteMermas)
        .where(
          and(
            eq(restauranteMermas.empresaId, empresaId),
            sql`(${restauranteMermas.fecha} AT TIME ZONE ${zonaHoraria})::date = ${hoy}`,
            filtroSucursalMerma,
          ),
        ),
      tx
        .select({ n: count() })
        .from(restaurantePromociones)
        .where(
          and(
            eq(restaurantePromociones.empresaId, empresaId),
            eq(restaurantePromociones.activa, true),
          ),
        ),
      tx
        .select({
          nombre: restauranteOrdenItems.nombreSnapshot,
          unidades: sql<string>`COALESCE(SUM(${restauranteOrdenItems.cantidad}), 0)`,
          ingresos: sql<string>`COALESCE(SUM(${restauranteOrdenItems.cantidad} * ${restauranteOrdenItems.precioUnitario}), 0)`,
        })
        .from(restauranteOrdenItems)
        .innerJoin(restauranteOrdenes, eq(restauranteOrdenes.id, restauranteOrdenItems.ordenId))
        .where(
          and(
            eq(restauranteOrdenItems.empresaId, empresaId),
            ne(restauranteOrdenItems.estado, "cancelado"),
            sql`${restauranteOrdenes.abiertoEn} >= NOW() - INTERVAL '30 days'`,
            filtroSucursalOrden,
          ),
        )
        .groupBy(restauranteOrdenItems.nombreSnapshot)
        .orderBy(desc(sql`SUM(${restauranteOrdenItems.cantidad})`))
        .limit(5),
      tx
        .select({
          id: productos.id,
          nombre: productos.nombre,
          stock: sql<string>`COALESCE(SUM(${existencias.cantidad}), 0)`,
          minimo: productos.stockMinimo,
        })
        .from(productos)
        .innerJoin(existencias, eq(existencias.productoId, productos.id))
        .innerJoin(restauranteProductos, eq(restauranteProductos.productoId, productos.id))
        .where(
          and(
            eq(productos.empresaId, empresaId),
            eq(restauranteProductos.empresaId, empresaId),
            eq(restauranteProductos.tipo, "insumo"),
            isNull(productos.eliminadoEn),
          ),
        )
        .groupBy(productos.id)
        .having(sql`COALESCE(SUM(${existencias.cantidad}), 0) <= ${productos.stockMinimo}`)
        .orderBy(asc(productos.nombre))
        .limit(8),
      tx
        .select({
          id: productos.id,
          nombre: productos.nombre,
          fecha: productos.fechaVencimiento,
        })
        .from(productos)
        .innerJoin(restauranteProductos, eq(restauranteProductos.productoId, productos.id))
        .where(
          and(
            eq(productos.empresaId, empresaId),
            eq(restauranteProductos.empresaId, empresaId),
            eq(restauranteProductos.tipo, "insumo"),
            sql`${productos.fechaVencimiento} IS NOT NULL`,
            gte(productos.fechaVencimiento, hoy),
            lt(productos.fechaVencimiento, sql`${hoy}::date + INTERVAL '14 days'`),
            isNull(productos.eliminadoEn),
          ),
        )
        .orderBy(asc(productos.fechaVencimiento))
        .limit(8),
    ]);

    const ventasHoy = parseFloat(ventasHoyRows[0]?.total ?? "0");
    const costoHoy = parseFloat(ventasHoyRows[0]?.costo ?? "0");
    const margenBruto = ventasHoy - costoHoy;

    return {
      ventasHoy,
      ventasAyer: parseFloat(ventasAyerRows[0]?.total ?? "0"),
      ordenesHoy: ordenesHoyRows[0]?.n ?? 0,
      ordenesAbiertas: ordenesAbiertasRows[0]?.n ?? 0,
      ticketPromedio: parseFloat(ticketRows[0]?.promedio ?? "0"),
      comensalesAtendidos: parseFloat(ticketRows[0]?.personas ?? "0"),
      mesas: Object.fromEntries(mesasRows.map((row) => [row.estado, row.n])),
      reservacionesProximas: reservasRows[0]?.n ?? 0,
      listaEspera: esperaRows[0]?.n ?? 0,
      pedidosCocina: cocinaRows[0]?.n ?? 0,
      tiempoPromedioPreparacionMin: parseFloat(prepRows[0]?.min ?? "0"),
      foodCostPct: ventasHoy > 0 ? Math.round((costoHoy / ventasHoy) * 10000) / 100 : 0,
      margenBruto,
      mermasHoy: mermasRows[0]?.n ?? 0,
      promocionesActivas: promosRows[0]?.n ?? 0,
      topPlatillos: topRows.map((row) => ({
        nombre: row.nombre,
        unidades: parseFloat(row.unidades),
        ingresos: parseFloat(row.ingresos),
      })),
      insumosBajos: stockRows.map((row) => ({
        id: row.id,
        nombre: row.nombre,
        stock: parseFloat(row.stock),
        minimo: parseFloat(row.minimo),
      })),
      insumosVencen: vencenRows
        .filter((row): row is { id: string; nombre: string; fecha: string } => Boolean(row.fecha))
        .map((row) => ({ id: row.id, nombre: row.nombre, fecha: row.fecha })),
    };
  });
}

export async function cargarResumenFoodCost({
  empresaId,
}: {
  empresaId: string;
}): Promise<
  Array<{
    id: string;
    nombre: string;
    costoPorPorcion: number;
    precioVenta: number;
    foodCostPct: number;
  }>
> {
  return dbConEmpresa(empresaId, async (tx) => {
    const rows = await tx
      .select({
        id: restauranteRecetas.id,
        nombre: restauranteRecetas.nombre,
        costoPorPorcion: restauranteRecetas.costoPorPorcion,
        precioVenta: restauranteRecetas.precioVenta,
        foodCostPct: restauranteRecetas.foodCostPct,
      })
      .from(restauranteRecetas)
      .where(and(eq(restauranteRecetas.empresaId, empresaId), eq(restauranteRecetas.activa, true)))
      .orderBy(desc(restauranteRecetas.foodCostPct))
      .limit(20);
    return rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      costoPorPorcion: parseFloat(row.costoPorPorcion),
      precioVenta: parseFloat(row.precioVenta),
      foodCostPct: parseFloat(row.foodCostPct),
    }));
  });
}
