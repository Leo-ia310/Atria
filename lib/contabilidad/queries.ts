/**
 * Queries de reportes financieros. Todo se calcula al vuelo desde
 * asiento_partidas — nunca persistido en columnas.
 */

import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  asientoPartidas,
  asientosContables,
  catalogoCuentas,
} from "@/lib/db/schema";
import { cacheModulo } from "@/lib/redis/cache";
import { MODULOS, TTL } from "@/lib/redis/keys";

import { mapSaldoCuenta, type SaldoCuenta } from "./report-core";
export { calcularEstadoResultados, calcularBalanceGeneral } from "./report-core";
export type { SaldoCuenta, EstadoResultados, BalanceGeneral } from "./report-core";

export function saldosPorCuenta(
  empresaId: string,
  hasta?: Date,
  sucursalIds?: string[] | null,
): Promise<SaldoCuenta[]> {
  const sucursales = sucursalIds?.length ? [...sucursalIds].sort() : null;
  const variante = [
    "saldos",
    hasta ? hasta.toISOString().slice(0, 10) : "all",
    sucursales ? `suc:${sucursales.join(",")}` : "todas",
  ].join(":");
  return cacheModulo(empresaId, MODULOS.CONTABILIDAD, variante, TTL.CONTABILIDAD, () =>
    calcularSaldosPorCuenta(empresaId, hasta, sucursales),
  );
}

async function calcularSaldosPorCuenta(
  empresaId: string,
  hasta?: Date,
  sucursalIds?: string[] | null,
): Promise<SaldoCuenta[]> {
  const filtros: SQL[] = [
    eq(asientosContables.empresaId, empresaId),
    eq(asientosContables.estado, "registrado"),
  ];
  if (hasta) {
    filtros.push(sql`${asientosContables.fecha} <= ${hasta.toISOString().slice(0, 10)}`);
  }
  if (sucursalIds?.length) {
    filtros.push(inArray(asientosContables.sucursalId, sucursalIds));
  }

  const rows = await db
    .select({
      cuentaId: asientoPartidas.cuentaId,
      codigo: catalogoCuentas.codigo,
      nombre: catalogoCuentas.nombre,
      tipo: catalogoCuentas.tipo,
      naturaleza: catalogoCuentas.naturaleza,
      totalDebe: sql<string>`COALESCE(SUM(${asientoPartidas.debe}), 0)`,
      totalHaber: sql<string>`COALESCE(SUM(${asientoPartidas.haber}), 0)`,
    })
    .from(asientoPartidas)
    .innerJoin(asientosContables, eq(asientosContables.id, asientoPartidas.asientoId))
    .innerJoin(catalogoCuentas, eq(catalogoCuentas.id, asientoPartidas.cuentaId))
    .where(and(...filtros))
    .groupBy(
      asientoPartidas.cuentaId,
      catalogoCuentas.codigo,
      catalogoCuentas.nombre,
      catalogoCuentas.tipo,
      catalogoCuentas.naturaleza,
    );

  return rows
    .map((r) => mapSaldoCuenta({...r,id:r.cuentaId}))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}
