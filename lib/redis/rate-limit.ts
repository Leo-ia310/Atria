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
 * Fallback en memoria (por proceso) para cuando Redis no está disponible.
 *
 * En serverless cada instancia tiene su propia memoria y los cold-starts la
 * reinician, así que es una defensa más débil que Redis; pero evita el
 * FAIL-OPEN total (protección anti-fuerza-bruta desapareciendo en silencio si
 * Redis se cae o no está configurado). Ventana fija con limpieza oportunista.
 */
const memoria = new Map<string, { conteo: number; expira: number }>();

function rateLimitEnMemoria(
  key: string,
  limite: number,
  ventanaSeg: number,
): ResultadoRateLimit {
  const ahora = Date.now();
  const actual = memoria.get(key);
  if (!actual || actual.expira <= ahora) {
    if (memoria.size > 10_000) {
      for (const [k, v] of memoria) if (v.expira <= ahora) memoria.delete(k);
    }
    memoria.set(key, { conteo: 1, expira: ahora + ventanaSeg * 1000 });
    return { permitido: 1 <= limite, restantes: Math.max(0, limite - 1), limite };
  }
  actual.conteo += 1;
  return {
    permitido: actual.conteo <= limite,
    restantes: Math.max(0, limite - actual.conteo),
    limite,
  };
}

/**
 * Rate limiting por ventana fija con INCR + EXPIRE en Redis.
 *
 * Si Redis no está disponible o falla, degrada a un limitador en MEMORIA
 * (`rateLimitEnMemoria`) en lugar de permitir todo. La autorización real sigue
 * viviendo en Postgres/NextAuth; esto solo frena abuso por volumen.
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
  const key = keys.rateLimit(accion, identificador);
  const redis = getRedis();
  if (!redis) {
    return rateLimitEnMemoria(key, limite, ventanaSeg);
  }

  try {
    const contador = await redis.incr(key);
    if (contador === 1) {
      await redis.expire(key, ventanaSeg);
    }
    const restantes = Math.max(0, limite - contador);
    return { permitido: contador <= limite, restantes, limite };
  } catch (error) {
    console.error("[redis] Rate limit falló, se usa el limitador en memoria.", error);
    return rateLimitEnMemoria(key, limite, ventanaSeg);
  }
}
