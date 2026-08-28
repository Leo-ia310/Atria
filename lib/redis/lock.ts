import "server-only";

import crypto from "node:crypto";
import { getRedis } from "./client";
import { keys, TTL } from "./keys";

/**
 * Lock temporal (mutex) para evitar ejecución simultánea de un proceso, p. ej.
 * un cron que dispara dos veces o corre solapado en dos instancias serverless.
 *
 * Semántica:
 * - Se adquiere con SET NX PX (expira solo, evita locks huérfanos).
 * - Se libera comparando el token (no borra un lock ajeno) vía script Lua.
 * - Si Redis no está disponible, `withLock` ejecuta la tarea SIN lock
 *   (fail-open): la protección contra solapamiento es best-effort y la lógica
 *   subyacente debe ser idempotente/segura de todos modos.
 *
 * Devuelve `null` si otro proceso ya tiene el lock; en caso contrario el
 * resultado de `tarea()`.
 */
const LIBERAR_LUA =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

export async function withLock<T>(
  nombre: string,
  tarea: () => Promise<T>,
  ttlSegundos: number = TTL.LOCK,
): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return tarea();

  const key = keys.lock(nombre);
  const token = crypto.randomBytes(32).toString("base64url");

  let adquirido = false;
  try {
    const res = await redis.set(key, token, { nx: true, px: ttlSegundos * 1000 });
    adquirido = res === "OK";
  } catch (error) {
    console.error("[redis] No se pudo adquirir lock, se ejecuta sin él.", error);
    return tarea();
  }

  if (!adquirido) return null;

  try {
    return await tarea();
  } finally {
    try {
      await redis.eval(LIBERAR_LUA, [key], [token]);
    } catch (error) {
      console.error("[redis] No se pudo liberar el lock (expirará solo).", error);
    }
  }
}
