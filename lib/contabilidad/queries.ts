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

export type SaldoCuenta = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: "activo" | "pasivo" | "patrimonio" | "ingreso" | "costo" | "gasto" | "orden";
  naturaleza: "deudora" | "acreedora";
  totalDebe: number;
  totalHaber: number;
  /** Saldo en su naturaleza natural. Positivo = saldo normal. Negativo = saldo invertido (anomalía). */
  saldo: number;
};

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
    .map((r) => {
      const debe = parseFloat(r.totalDebe);
      const haber = parseFloat(r.totalHaber);
      const saldo = r.naturaleza === "deudora" ? debe - haber : haber - debe;
      return {
        id: r.cuentaId,
        codigo: r.codigo,
        nombre: r.nombre,
        tipo: r.tipo,
        naturaleza: r.naturaleza,
        totalDebe: debe,
        totalHaber: haber,
        saldo,
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export type EstadoResultados = {
  ingresos: SaldoCuenta[];
  costos: SaldoCuenta[];
  gastos: SaldoCuenta[];
  totalIngresos: number;
  totalCostos: number;
  utilidadBruta: number;
  totalGastos: number;
  utilidadNeta: number;
};

export function calcularEstadoResultados(saldos: SaldoCuenta[]): EstadoResultados {
  const ingresos = saldos.filter((s) => s.tipo === "ingreso" && s.saldo !== 0);
  const costos = saldos.filter((s) => s.tipo === "costo" && s.saldo !== 0);
  const gastos = saldos.filter((s) => s.tipo === "gasto" && s.saldo !== 0);

  const totalIngresos = ingresos.reduce((a, c) => a + c.saldo, 0);
  const totalCostos = costos.reduce((a, c) => a + c.saldo, 0);
  const utilidadBruta = totalIngresos - totalCostos;
  const totalGastos = gastos.reduce((a, c) => a + c.saldo, 0);
  const utilidadNeta = utilidadBruta - totalGastos;

  return {
    ingresos,
    costos,
    gastos,
    totalIngresos,
    totalCostos,
    utilidadBruta,
    totalGastos,
    utilidadNeta,
  };
}

export type BalanceGeneral = {
  activos: SaldoCuenta[];
  pasivos: SaldoCuenta[];
  patrimonio: SaldoCuenta[];
  totalActivos: number;
  totalPasivos: number;
  totalPatrimonio: number;
  utilidadEjercicio: number;
  totalPasivoMasPatrimonio: number;
  balanceado: boolean;
};

export function calcularBalanceGeneral(saldos: SaldoCuenta[]): BalanceGeneral {
  const activos = saldos.filter((s) => s.tipo === "activo" && s.saldo !== 0);
  const pasivos = saldos.filter((s) => s.tipo === "pasivo" && s.saldo !== 0);
  const patrimonio = saldos.filter((s) => s.tipo === "patrimonio" && s.saldo !== 0);

  const er = calcularEstadoResultados(saldos);
  const utilidadEjercicio = er.utilidadNeta;

  const totalActivos = activos.reduce((a, c) => a + c.saldo, 0);
  const totalPasivos = pasivos.reduce((a, c) => a + c.saldo, 0);
  const totalPatrimonio = patrimonio.reduce((a, c) => a + c.saldo, 0) + utilidadEjercicio;

  const totalPasivoMasPatrimonio = totalPasivos + totalPatrimonio;
  const balanceado = Math.abs(totalActivos - totalPasivoMasPatrimonio) < 0.01;

  return {
    activos,
    pasivos,
    patrimonio,
    totalActivos,
    totalPasivos,
    totalPatrimonio,
    utilidadEjercicio,
    totalPasivoMasPatrimonio,
    balanceado,
  };
}
