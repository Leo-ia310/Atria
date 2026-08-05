import "server-only";

/**
 * Construcción centralizada de claves Redis.
 *
 * Reglas:
 * - Toda clave lleva el prefijo `app:`.
 * - Toda clave que represente datos de un tenant DEBE incluir `empresa:{id}`
 *   para impedir que datos de distintas empresas se mezclen en caché.
 * - Todo dato cacheado tiene un TTL (ver `TTL`). No hay claves eternas.
 */

const PREFIJO = "app";

/** TTL en segundos por tipo de dato. */
export const TTL = {
  /** KPIs / dashboard: tolera segundos de desfase, se invalida al escribir. */
  DASHBOARD: 30,
  /** Reportes de negocio (ventas, inventario, rentabilidad). */
  REPORTES: 60,
  /** Reportes contables (saldos, balances, estado de resultados). */
  CONTABILIDAD: 60,
  /** Metadatos de empresa (país, moneda, razón social): cambian rara vez. */
  EMPRESA: 300,
  /** Ventana de rate-limiting. */
  RATE_LIMIT: 300,
  /** Idempotencia de webhooks / notificaciones salientes. */
  IDEMPOTENCIA: 60 * 60 * 24,
  /** Locks temporales para procesos que no deben solaparse. */
  LOCK: 60,
} as const;

/**
 * Nombres de módulo cacheables por empresa. Cada uno es un sub-prefijo bajo
 * `app:empresa:{id}:` que se puede invalidar en bloque cuando el módulo cambia.
 */
export const MODULOS = {
  DASHBOARD: "dashboard",
  REPORTES: "reportes",
  CONTABILIDAD: "contabilidad",
} as const;

export type Modulo = (typeof MODULOS)[keyof typeof MODULOS];

function sanea(segmento: string | number): string {
  return String(segmento).replace(/[^a-zA-Z0-9_.:-]/g, "_");
}

/** Prefijo scopeado por empresa. Base para invalidación por tenant. */
export function empresaPrefix(empresaId: string): string {
  return `${PREFIJO}:empresa:${sanea(empresaId)}`;
}

export const keys = {
  dashboard(empresaId: string, sucursalScope: string): string {
    return `${empresaPrefix(empresaId)}:dashboard:${sanea(sucursalScope)}`;
  },
  modulo(empresaId: string, modulo: string, variante: string): string {
    return `${empresaPrefix(empresaId)}:${sanea(modulo)}:${sanea(variante)}`;
  },
  empresaMetadata(empresaId: string): string {
    return `${empresaPrefix(empresaId)}:metadata`;
  },
  rateLimit(accion: string, identificador: string): string {
    return `${PREFIJO}:rate-limit:${sanea(accion)}:${sanea(identificador)}`;
  },
  idempotencia(proveedor: string, eventoId: string): string {
    return `${PREFIJO}:idempotency:${sanea(proveedor)}:${sanea(eventoId)}`;
  },
  lock(nombre: string): string {
    return `${PREFIJO}:lock:${sanea(nombre)}`;
  },
} as const;
