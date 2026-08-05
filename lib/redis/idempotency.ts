import "server-only";

import { getRedis } from "./client";
import { keys, TTL } from "./keys";

/**
 * Idempotencia para procesos que pueden repetirse (webhooks, notificaciones
 * salientes, reintentos). Devuelve `true` la PRIMERA vez que se ve `eventoId`
 * y `false` en repeticiones dentro de la ventana TTL.
 *
 * Usa SET NX: la reserva de la clave es atómica.
 *
 * FAIL-OPEN: si Redis no está disponible, devuelve `true` (se procesa). No se
 * debe perder un evento real por una caída de Redis; la deduplicación es una
 * optimización, no la fuente de verdad.
 */
export async function marcarPrimeraVez(
  proveedor: string,
  eventoId: string,
  ttlSegundos: number = TTL.IDEMPOTENCIA,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;

  const key = keys.idempotencia(proveedor, eventoId);
  try {
    const reservado = await redis.set(key, Date.now(), { nx: true, ex: ttlSegundos });
    return reservado === "OK";
  } catch (error) {
    console.error("[redis] Chequeo de idempotencia falló, se procesa igual.", error);
    return true;
  }
}
