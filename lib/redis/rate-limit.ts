import "server-only";

import { getRedis } from "./client";
import { keys, TTL } from "./keys";

export type ResultadoRateLimit = {
  /** `true` si la solicitud está permitida. */
  permitido: boolean;
  /** Solicitudes restantes en la ventana actual. */
  restantes: number;
  /** Límite configurado. */
  limite: number;
};

/**
 * Rate limiting por ventana fija con INCR + EXPIRE.
 *
 * FAIL-OPEN: si Redis no está disponible o falla, se PERMITE la solicitud.
 * Rate limiting es una defensa auxiliar; no debe bloquear a usuarios legítimos
 * por una caída de Redis. La autorización real vive en Postgres/NextAuth.
 *
 * @param accion         etiqueta de la acción, p. ej. "login", "registro".
 * @param identificador  quién (email normalizado, IP, empresaId...).
 * @param limite         máximo de solicitudes por ventana.
 * @param ventanaSeg     tamaño de la ventana en segundos.
 */
export async function rateLimit(
  accion: string,
  identificador: string,
  limite: number,
  ventanaSeg: number = TTL.RATE_LIMIT,
): Promise<ResultadoRateLimit> {
  const redis = getRedis();
  if (!redis) {
    return { permitido: true, restantes: limite, limite };
  }

  const key = keys.rateLimit(accion, identificador);

  try {
    const contador = await redis.incr(key);
    if (contador === 1) {
      await redis.expire(key, ventanaSeg);
    }
    const restantes = Math.max(0, limite - contador);
    return { permitido: contador <= limite, restantes, limite };
  } catch (error) {
    console.error("[redis] Rate limit falló, se permite la solicitud.", error);
    return { permitido: true, restantes: limite, limite };
  }
}
