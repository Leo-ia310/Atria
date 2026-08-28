import "server-only";

import { getRedis } from "./client";
import { empresaPrefix, keys } from "./keys";

/**
 * Caché-aside genérico.
 *
 * 1. Consulta Redis.
 * 2. Si hay dato, lo devuelve.
 * 3. Si no, ejecuta `cargar()` (PostgreSQL) y guarda el resultado con TTL.
 * 4. Devuelve el resultado.
 *
 * Si Redis no está disponible o falla, SIEMPRE cae a `cargar()`: PostgreSQL
 * es la fuente de verdad. Nunca se guardan valores `null`/`undefined` en caché.
 */
export async function cacheAside<T>(
  key: string,
  ttlSegundos: number,
  cargar: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();

  if (redis) {
    try {
      const cacheado = await redis.get<T>(key);
      if (cacheado !== null && cacheado !== undefined) {
        return cacheado;
      }
    } catch (error) {
      console.error("[redis] Lectura de caché falló, se consulta Postgres.", error);
    }
  }

  const fresco = await cargar();

  if (redis && fresco !== null && fresco !== undefined) {
    try {
      await redis.set(key, fresco, { ex: ttlSegundos });
    } catch (error) {
      console.error("[redis] Escritura de caché falló (dato ya obtenido de DB).", error);
    }
  }

  return fresco;
}

/**
 * Caché-aside scopeado por empresa y módulo. La `variante` distingue vistas
 * (p. ej. alcance de sucursal o rango de fechas). La empresa va SIEMPRE en la
 * clave, evitando que datos de un tenant se sirvan a otro.
 */
export function cacheModulo<T>(
  empresaId: string,
  modulo: string,
  variante: string,
  ttlSegundos: number,
  cargar: () => Promise<T>,
): Promise<T> {
  return cacheAside(keys.modulo(empresaId, modulo, variante), ttlSegundos, cargar);
}

/**
 * Invalida en bloque todos los módulos indicados de una empresa. Se llama
 * DESPUÉS de confirmar la escritura en Postgres (fuente de verdad). No lanza.
 */
export async function invalidarModulos(
  empresaId: string,
  modulos: string[],
): Promise<void> {
  if (!getRedis()) return;
  await Promise.all(
    modulos.map((m) => invalidarPrefijo(`${empresaPrefix(empresaId)}:${m}`)),
  );
}

/** Invalida una o varias claves exactas. No lanza si Redis falla. */
async function invalidarClaves(...claves: string[]): Promise<void> {
  if (claves.length === 0) return;
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(...claves);
  } catch (error) {
    console.error("[redis] No se pudieron invalidar claves.", error);
  }
}

/**
 * Invalida todas las claves bajo un prefijo (p. ej. todo lo de una empresa).
 * Usa SCAN para no bloquear Redis con KEYS. No lanza si falla.
 */
export async function invalidarPrefijo(prefijo: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    let cursor = "0";
    do {
      const [siguiente, lote] = await redis.scan(cursor, {
        match: `${prefijo}*`,
        count: 100,
      });
      cursor = siguiente;
      if (lote.length > 0) {
        await redis.del(...lote);
      }
    } while (cursor !== "0");
  } catch (error) {
    console.error("[redis] No se pudo invalidar el prefijo.", error);
  }
}
