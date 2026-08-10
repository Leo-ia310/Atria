import "server-only";

import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { dbSuperAdmin } from "@/lib/db";
import {
  asientosContables,
  clientes,
  compras,
  empleados,
  empresas,
  facturas,
  gastos,
  gastosPlataforma,
  menusVirtuales,
  movimientosInventario,
  pagosSuscripcion,
  planes,
  productos,
  sucursales,
  suscripciones,
  usuarios,
  ventas,
} from "@/lib/db/schema";
import { getPlan, type PlanId } from "@/lib/pricing";
import { suscripcionVigente } from "@/lib/suscripciones/expiracion";

export type SuperAdminCliente = {
  id: string;
  razonSocial: string;
  nombreComercial: string | null;
  pais: string;
  moneda: string;
  email: string | null;
  telefono: string | null;
  activa: boolean;
  creadoEn: Date;
  planCodigo: PlanId | null;
  planNombre: string;
  suscripcionEstado: string | null;
  ciclo: "mensual" | "anual" | null;
  inicioPeriodo: Date | null;
  finPeriodo: Date | null;
  operativo: "activo" | "trial" | "bloqueado" | "suspendido" | "cancelado" | "sin_plan";
  usuarios: number;
  sucursales: number;
  productos: number;
  clientes: number;
  ventas: number;
  facturas: number;
  compras: number;
  gastos: number;
  empleados: number;
  storageBytes: number;
  storageLabel: string;
  ventasTotales: number;
  pagosTotales: number;
  pagosMes: number;
};

export type SuperAdminResumen = {
  totalClientes: number;
  clientesActivos: number;
  clientesBloqueados: number;
  clientesSuspendidos: number;
  trials: number;
  mrrEstimado: number;
  pagosMes: number;
  gastosMes: number;
  utilidadMes: number;
  storageTotalBytes: number;
  storageTotalLabel: string;
};

export type GastoPlataformaItem = {
  id: string;
  fecha: string;
  categoria: string;
  proveedor: string | null;
  descripcion: string;
  monto: number;
  moneda: string;
  metodoPago: string | null;
  recurrente: boolean;
  notas: string | null;
  creadoEn: Date;
};

export async function obtenerClientesSuperAdmin(): Promise<SuperAdminCliente[]> {
  return dbSuperAdmin(async (tx) => {
    const inicioMes = inicioDelMes();
    const [
      empresasRows,
      suscripcionesRows,
      usuariosRows,
      sucursalesRows,
      productosRows,
      clientesRows,
      ventasRows,
      facturasRows,
      comprasRows,
      gastosRows,
      empleadosRows,
      movimientosRows,
      asientosRows,
      menusRows,
      ventasTotalesRows,
      pagosTotalesRows,
      pagosMesRows,
    ] = await Promise.all([
      tx
        .select({
          id: empresas.id,
          razonSocial: empresas.razonSocial,
          nombreComercial: empresas.nombreComercial,
          pais: empresas.pais,
          moneda: empresas.moneda,
          email: empresas.email,
          telefono: empresas.telefono,
          activa: empresas.activa,
          creadoEn: empresas.creadoEn,
        })
        .from(empresas)
        .orderBy(desc(empresas.creadoEn)),
      tx
        .select({
          empresaId: suscripciones.empresaId,
          planCodigo: planes.codigo,
          planNombre: planes.nombre,
          estado: suscripciones.estado,
          ciclo: suscripciones.ciclo,
          inicioPeriodo: suscripciones.inicioPeriodo,
          finPeriodo: suscripciones.finPeriodo,
          creadoEn: suscripciones.creadoEn,
        })
        .from(suscripciones)
        .innerJoin(planes, eq(planes.id, suscripciones.planId))
        .orderBy(desc(suscripciones.creadoEn)),
      tx.select({ empresaId: usuarios.empresaId, n: count() }).from(usuarios).groupBy(usuarios.empresaId),
      tx.select({ empresaId: sucursales.empresaId, n: count() }).from(sucursales).groupBy(sucursales.empresaId),
      tx.select({ empresaId: productos.empresaId, n: count() }).from(productos).groupBy(productos.empresaId),
      tx.select({ empresaId: clientes.empresaId, n: count() }).from(clientes).groupBy(clientes.empresaId),
      tx.select({ empresaId: ventas.empresaId, n: count() }).from(ventas).groupBy(ventas.empresaId),
      tx.select({ empresaId: facturas.empresaId, n: count() }).from(facturas).groupBy(facturas.empresaId),
      tx.select({ empresaId: compras.empresaId, n: count() }).from(compras).groupBy(compras.empresaId),
      tx.select({ empresaId: gastos.empresaId, n: count() }).from(gastos).groupBy(gastos.empresaId),
      tx.select({ empresaId: empleados.empresaId, n: count() }).from(empleados).groupBy(empleados.empresaId),
      tx
        .select({ empresaId: movimientosInventario.empresaId, n: count() })
        .from(movimientosInventario)
        .groupBy(movimientosInventario.empresaId),
      tx
        .select({ empresaId: asientosContables.empresaId, n: count() })
        .from(asientosContables)
        .groupBy(asientosContables.empresaId),
      tx
        .select({ empresaId: menusVirtuales.empresaId, n: count() })
        .from(menusVirtuales)
        .groupBy(menusVirtuales.empresaId),
      tx
        .select({
          empresaId: ventas.empresaId,
          total: sql<string>`COALESCE(SUM(${ventas.total}), 0)`,
        })
        .from(ventas)
        .where(eq(ventas.estado, "completada"))
        .groupBy(ventas.empresaId),
      tx
        .select({
          empresaId: pagosSuscripcion.empresaId,
          total: sql<string>`COALESCE(SUM(${pagosSuscripcion.monto}), 0)`,
        })
        .from(pagosSuscripcion)
        .where(eq(pagosSuscripcion.estado, "completado"))
        .groupBy(pagosSuscripcion.empresaId),
      tx
        .select({
          empresaId: pagosSuscripcion.empresaId,
          total: sql<string>`COALESCE(SUM(${pagosSuscripcion.monto}), 0)`,
        })
        .from(pagosSuscripcion)
        .where(
          and(
            eq(pagosSuscripcion.estado, "completado"),
            gte(pagosSuscripcion.completadoEn, inicioMes),
          ),
        )
        .groupBy(pagosSuscripcion.empresaId),
    ]);

    const latest = new Map<string, (typeof suscripcionesRows)[number]>();
    for (const row of suscripcionesRows) {
      if (!latest.has(row.empresaId)) latest.set(row.empresaId, row);
    }

    const mapas = {
      usuarios: numberMap(usuariosRows),
      sucursales: numberMap(sucursalesRows),
      productos: numberMap(productosRows),
      clientes: numberMap(clientesRows),
      ventas: numberMap(ventasRows),
      facturas: numberMap(facturasRows),
      compras: numberMap(comprasRows),
      gastos: numberMap(gastosRows),
      empleados: numberMap(empleadosRows),
      movimientos: numberMap(movimientosRows),
      asientos: numberMap(asientosRows),
      menus: numberMap(menusRows),
      ventasTotales: moneyMap(ventasTotalesRows),
      pagosTotales: moneyMap(pagosTotalesRows),
      pagosMes: moneyMap(pagosMesRows),
    };

    return empresasRows.map((empresa) => {
      const suscripcion = latest.get(empresa.id);
      const planCodigo = (suscripcion?.planCodigo as PlanId | undefined) ?? null;
      const planBase = getPlan(planCodigo ?? "demo");
      const vigente = suscripcion
        ? suscripcionVigente(suscripcion.estado, suscripcion.finPeriodo)
        : false;
      const operativo = estadoOperativo({
        empresaActiva: empresa.activa,
        estado: suscripcion?.estado ?? null,
        vigente,
        planCodigo,
      });
      const uso = {
        usuarios: mapas.usuarios.get(empresa.id) ?? 0,
        sucursales: mapas.sucursales.get(empresa.id) ?? 0,
        productos: mapas.productos.get(empresa.id) ?? 0,
        clientes: mapas.clientes.get(empresa.id) ?? 0,
        ventas: mapas.ventas.get(empresa.id) ?? 0,
        facturas: mapas.facturas.get(empresa.id) ?? 0,
        compras: mapas.compras.get(empresa.id) ?? 0,
        gastos: mapas.gastos.get(empresa.id) ?? 0,
        empleados: mapas.empleados.get(empresa.id) ?? 0,
        movimientos: mapas.movimientos.get(empresa.id) ?? 0,
        asientos: mapas.asientos.get(empresa.id) ?? 0,
        menus: mapas.menus.get(empresa.id) ?? 0,
      };
      const storageBytes = estimarStorageBytes(uso);

      return {
        id: empresa.id,
        razonSocial: empresa.razonSocial,
        nombreComercial: empresa.nombreComercial,
        pais: empresa.pais,
        moneda: empresa.moneda,
        email: empresa.email,
        telefono: empresa.telefono,
        activa: empresa.activa,
        creadoEn: empresa.creadoEn,
        planCodigo,
        planNombre: suscripcion?.planNombre ?? planBase.nombre,
        suscripcionEstado: suscripcion?.estado ?? null,
        ciclo: suscripcion?.ciclo ?? null,
        inicioPeriodo: suscripcion?.inicioPeriodo ?? null,
        finPeriodo: suscripcion?.finPeriodo ?? null,
        operativo,
        usuarios: uso.usuarios,
        sucursales: uso.sucursales,
        productos: uso.productos,
        clientes: uso.clientes,
        ventas: uso.ventas,
        facturas: uso.facturas,
        compras: uso.compras,
        gastos: uso.gastos,
        empleados: uso.empleados,
        storageBytes,
        storageLabel: formatearBytes(storageBytes),
        ventasTotales: mapas.ventasTotales.get(empresa.id) ?? 0,
        pagosTotales: mapas.pagosTotales.get(empresa.id) ?? 0,
        pagosMes: mapas.pagosMes.get(empresa.id) ?? 0,
      };
    });
  });
}

export async function obtenerResumenSuperAdmin(): Promise<SuperAdminResumen> {
  const [clientes, gastosMes] = await Promise.all([
    obtenerClientesSuperAdmin(),
    obtenerGastosMesPlataforma(),
  ]);

  const mrrEstimado = clientes.reduce((total, cliente) => {
    if (cliente.operativo !== "activo" || !cliente.planCodigo) return total;
    if (cliente.planCodigo === "demo") return total;
    return total + getPlan(cliente.planCodigo).precioMensual;
  }, 0);
  const pagosMes = clientes.reduce((total, cliente) => total + cliente.pagosMes, 0);
  const storageTotalBytes = clientes.reduce((total, cliente) => total + cliente.storageBytes, 0);

  return {
    totalClientes: clientes.length,
    clientesActivos: clientes.filter((c) => c.operativo === "activo").length,
    clientesBloqueados: clientes.filter((c) => c.operativo === "bloqueado").length,
    clientesSuspendidos: clientes.filter((c) => c.operativo === "suspendido").length,
    trials: clientes.filter((c) => c.operativo === "trial").length,
    mrrEstimado,
    pagosMes,
    gastosMes,
    utilidadMes: pagosMes - gastosMes,
    storageTotalBytes,
    storageTotalLabel: formatearBytes(storageTotalBytes),
  };
}

export async function obtenerGastosPlataforma(): Promise<{
  gastos: GastoPlataformaItem[];
  totalMes: number;
  totalAnio: number;
}> {
  return dbSuperAdmin(async (tx) => {
    const inicioMes = inicioDelMes();
    const inicioAnio = new Date(new Date().getFullYear(), 0, 1);
    const [gastosRows, [mes], [anio]] = await Promise.all([
      tx
        .select()
        .from(gastosPlataforma)
        .orderBy(desc(gastosPlataforma.fecha), desc(gastosPlataforma.creadoEn))
        .limit(100),
      tx
        .select({ total: sql<string>`COALESCE(SUM(${gastosPlataforma.monto}), 0)` })
        .from(gastosPlataforma)
        .where(gte(gastosPlataforma.fecha, fechaSql(inicioMes))),
      tx
        .select({ total: sql<string>`COALESCE(SUM(${gastosPlataforma.monto}), 0)` })
        .from(gastosPlataforma)
        .where(gte(gastosPlataforma.fecha, fechaSql(inicioAnio))),
    ]);

    return {
      gastos: gastosRows.map((g) => ({
        id: g.id,
        fecha: g.fecha,
        categoria: g.categoria,
        proveedor: g.proveedor,
        descripcion: g.descripcion,
        monto: Number(g.monto),
        moneda: g.moneda,
        metodoPago: g.metodoPago,
        recurrente: g.recurrente,
        notas: g.notas,
        creadoEn: g.creadoEn,
      })),
      totalMes: Number(mes?.total ?? 0),
      totalAnio: Number(anio?.total ?? 0),
    };
  });
}

function obtenerGastosMesPlataforma(): Promise<number> {
  return dbSuperAdmin(async (tx) => {
    const [row] = await tx
      .select({ total: sql<string>`COALESCE(SUM(${gastosPlataforma.monto}), 0)` })
      .from(gastosPlataforma)
      .where(gte(gastosPlataforma.fecha, fechaSql(inicioDelMes())));
    return Number(row?.total ?? 0);
  });
}

function numberMap(rows: { empresaId: string; n: number }[]): Map<string, number> {
  return new Map(rows.map((row) => [row.empresaId, row.n]));
}

function moneyMap(rows: { empresaId: string; total: string }[]): Map<string, number> {
  return new Map(rows.map((row) => [row.empresaId, Number(row.total)]));
}

function estadoOperativo(input: {
  empresaActiva: boolean;
  estado: string | null;
  vigente: boolean;
  planCodigo: PlanId | null;
}): SuperAdminCliente["operativo"] {
  if (!input.empresaActiva || input.estado === "suspendida") return "suspendido";
  if (!input.estado) return "sin_plan";
  if (input.estado === "cancelada") return "cancelado";
  if (input.estado === "trial" && input.vigente) return "trial";
  if (input.estado === "activa" && input.vigente) return "activo";
  if ((input.planCodigo === "pro" || input.planCodigo === "enterprise") && !input.vigente) {
    return "bloqueado";
  }
  return input.estado === "trial" ? "trial" : "sin_plan";
}

function estimarStorageBytes(uso: {
  usuarios: number;
  sucursales: number;
  productos: number;
  clientes: number;
  ventas: number;
  facturas: number;
  compras: number;
  gastos: number;
  empleados: number;
  movimientos: number;
  asientos: number;
  menus: number;
}): number {
  return (
    uso.usuarios * 700 +
    uso.sucursales * 650 +
    uso.productos * 1500 +
    uso.clientes * 900 +
    uso.ventas * 1800 +
    uso.facturas * 3200 +
    uso.compras * 1700 +
    uso.gastos * 1100 +
    uso.empleados * 1300 +
    uso.movimientos * 1200 +
    uso.asientos * 1600 +
    uso.menus * 2500
  );
}

export function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const unidades = ["KB", "MB", "GB", "TB"];
  let valor = bytes / 1024;
  let unidad = unidades[0];
  for (let i = 1; i < unidades.length && valor >= 1024; i += 1) {
    valor /= 1024;
    unidad = unidades[i];
  }
  return `${valor.toFixed(valor >= 10 ? 1 : 2)} ${unidad}`;
}

function inicioDelMes(): Date {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), 1);
}

function fechaSql(date: Date): string {
  return date.toISOString().slice(0, 10);
}
