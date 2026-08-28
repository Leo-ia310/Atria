import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Compara el header `Authorization: Bearer <secret>` en tiempo constante para
 * no filtrar el secreto vía timing side-channel. Devuelve `false` ante header
 * ausente o longitud distinta (timingSafeEqual exige buffers del mismo tamaño).
 */
export function bearerValido(header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const recibido = Buffer.from(header);
  const esperado = Buffer.from(`Bearer ${secret}`);
  if (recibido.length !== esperado.length) return false;
  return timingSafeEqual(recibido, esperado);
}
