/**
 * Helpers compartidos por todas las funciones del motor contable.
 */

import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  asientosContables,
  catalogoCuentas,
  configuraciones,
  periodosContables,
  ventas,
} from "@/lib/db/schema";
import { CUENTAS_CLAVE } from "@/lib/paises";

export class PeriodoCerradoError extends Error {
  constructor(public fecha: string) {
    super(`No se puede registrar en período cerrado (fecha=${fecha})`);
    this.name = "PeriodoCerradoError";
  }
}

export class CuentaClaveNoEncontradaError extends Error {
  constructor(public clave: string, public codigo: string) {
    super(`Cuenta clave no encontrada: ${clave} (código ${codigo})`);
    this.name = "CuentaClaveNoEncontradaError";
  }
}

type TX = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Devuelve { CAJA: "uuid", VENTAS: "uuid", ... } para esta empresa.
 * Respeta override en configuraciones.cuentas_clave si la empresa renombró cuentas.
 */
export async function resolverCuentasClave<K extends keyof typeof CUENTAS_CLAVE>(
  tx: TX | typeof db,
  empresaId: string,
  claves: K[],
): Promise<Record<K, string>> {
  const [conf] = await tx
    .select({ valor: configuraciones.valor })
    .from(configuraciones)
    .where(
      and(
        eq(configuraciones.empresaId, empresaId),
        eq(configuraciones.clave, "cuentas_clave"),
      ),
    )
    .limit(1);

  const mapeo = (conf?.valor as Record<string, string>) ?? CUENTAS_CLAVE;
  const codigos = claves.map((k) => mapeo[k]);

  const cuentas = await tx
    .select({ id: catalogoCuentas.id, codigo: catalogoCuentas.codigo })
    .from(catalogoCuentas)
    .where(
      and(
        eq(catalogoCuentas.empresaId, empresaId),
        inArray(catalogoCuentas.codigo, codigos),
      ),
    );

  const porCodigo = new Map(cuentas.map((c) => [c.codigo, c.id]));
  const resultado = {} as Record<K, string>;
  for (const clave of claves) {
    const codigo = mapeo[clave];
    const id = porCodigo.get(codigo);
    if (!id) throw new CuentaClaveNoEncontradaError(clave, codigo);
    resultado[clave] = id;
  }
  return resultado;
}

/**
 * Busca el periodo abierto al que pertenece `fecha`. Lanza PeriodoCerradoError
 * si el periodo está cerrado o no existe.
 */
export async function obtenerPeriodoAbierto(
  tx: TX | typeof db,
  empresaId: string,
  fecha: Date,
): Promise<string> {
  const anio = fecha.getFullYear();
  const mes = fecha.getMonth() + 1;
  const [periodo] = await tx
    .select({ id: periodosContables.id, estado: periodosContables.estado })
    .from(periodosContables)
    .where(
      and(
        eq(periodosContables.empresaId, empresaId),
        eq(periodosContables.anio, anio),
        eq(periodosContables.mes, mes),
      ),
    )
    .limit(1);

  if (!periodo) {
    const fechaStr = fecha.toISOString().slice(0, 10);
    throw new PeriodoCerradoError(`${fechaStr} (período inexistente)`);
  }
  if (periodo.estado === "cerrado") {
    throw new PeriodoCerradoError(fecha.toISOString().slice(0, 10));
  }
  return periodo.id;
}

/**
 * Genera el siguiente número de asiento con formato AS-YYYY-NNNNNN.
 * Correlativo por empresa y año.
 */
export async function siguienteNumeroAsiento(
  tx: TX | typeof db,
  empresaId: string,
  fecha: Date,
): Promise<string> {
  const anio = fecha.getFullYear();
  const prefijo = `AS-${anio}-`;
  const [ultimo] = await tx
    .select({ numero: asientosContables.numero })
    .from(asientosContables)
    .where(
      and(
        eq(asientosContables.empresaId, empresaId),
        like(asientosContables.numero, `${prefijo}%`),
      ),
    )
    .orderBy(desc(asientosContables.numero))
    .limit(1);

  const siguiente = ultimo
    ? parseInt(ultimo.numero.split("-").pop()!, 10) + 1
    : 1;
  return prefijo + String(siguiente).padStart(6, "0");
}

/**
 * Genera siguiente número correlativo para una entidad de negocio (venta, compra, etc.)
 * Patrón general: PREFIJO-YYYY-NNNNNN por empresa y año.
 */
export async function siguienteNumero(
  tx: TX | typeof db,
  opciones: {
    empresaId: string;
    prefijo: string;
    fecha: Date;
    tabla: typeof ventas;
    columnaNumero: typeof ventas.numero;
  },
): Promise<string> {
  const anio = opciones.fecha.getFullYear();
  const pref = `${opciones.prefijo}-${anio}-`;
  const [ultimo] = await tx
    .select({ numero: opciones.columnaNumero })
    .from(opciones.tabla)
    .where(
      and(
        eq(opciones.tabla.empresaId, opciones.empresaId),
        like(opciones.columnaNumero, `${pref}%`),
      ),
    )
    .orderBy(desc(opciones.columnaNumero))
    .limit(1);

  const siguiente = ultimo
    ? parseInt(ultimo.numero.split("-").pop()!, 10) + 1
    : 1;
  return pref + String(siguiente).padStart(6, "0");
}

/**
 * Helper para sumar/restar dinero respetando precisión decimal.
 * El schema usa numeric(18,4) — postgres-js devuelve string. Esta función
 * normaliza a number con 4 decimales máximo.
 */
export function dinero(...montos: (string | number | null | undefined)[]): number {
  let total = 0;
  for (const m of montos) {
    if (m === null || m === undefined) continue;
    const n = typeof m === "string" ? parseFloat(m) : m;
    if (!Number.isNaN(n)) total += n;
  }
  return Math.round(total * 10000) / 10000;
}

/** Convierte number a string con 4 decimales para insertar en numeric(18,4). */
export function aDecimalStr(n: number): string {
  return n.toFixed(4);
}

export type { TX };
