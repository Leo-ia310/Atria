import "server-only";

import { Redis } from "@upstash/redis";

/**
 * Cliente Redis centralizado (Upstash REST, compatible con serverless/edge).
 *
 * Redis es una capa AUXILIAR: caché, rate-limiting, idempotencia y locks.
 * La fuente de verdad siempre es PostgreSQL. Por eso `getRedis()` degrada de
 * forma segura: si las credenciales no están o el cliente no se puede crear,
 * devuelve `null` y el código que lo usa debe seguir funcionando contra Postgres.
 */

let cliente: Redis | null | undefined;
let avisoEmitido = false;

function credenciales(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

/**
 * Devuelve el singleton de Redis, o `null` si no está configurado.
 * Nunca lanza: un fallo de Redis jamás debe tumbar la app.
 */
export function getRedis(): Redis | null {
  if (cliente !== undefined) return cliente;

  const creds = credenciales();
  if (!creds) {
    if (!avisoEmitido && process.env.NODE_ENV !== "production") {
      console.warn(
        "[redis] UPSTASH_REDIS_REST_URL/TOKEN no configurados. " +
          "La app funciona sin caché; las consultas van directo a PostgreSQL.",
      );
      avisoEmitido = true;
    }
    cliente = null;
    return cliente;
  }

  try {
    cliente = new Redis({ url: creds.url, token: creds.token });
  } catch (error) {
    // No exponemos la URL/token en el log.
    console.error("[redis] No se pudo inicializar el cliente Upstash.", error);
    cliente = null;
  }

  return cliente;
}

/** `true` solo si hay credenciales presentes. Útil para gating condicional. */
function redisDisponible(): boolean {
  return credenciales() !== null;
}
