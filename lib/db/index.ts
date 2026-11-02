import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";
import { currentBusinessContext } from "../business-context";

// La app en ejecución usa el Transaction Pooler de Supabase (Supavisor, 6543).
// Orden de resolución (el primero definido gana), compatible con ambas
// convenciones de nombres:
//   - DATABASE_POOL_URL → pooler (nombre usado históricamente en este proyecto)
//   - DATABASE_URL      → pooler (nombre canónico del Transaction Pooler)
// La conexión directa (DIRECT_URL) queda reservada para migraciones y tareas
// administrativas (ver drizzle.config.ts), nunca para el runtime serverless.
const connectionString =
  process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL ?? "";

if (!connectionString) {
  throw new Error("DATABASE_URL (o DATABASE_POOL_URL) no está configurada");
}

// Usamos el pooler de transacciones de Supabase (pgBouncer, puerto 6543), por eso
// `prepare: false`. Con `max: 1` las queries en Promise.all se serializan sobre una
// sola conexión y la paralelización no sirve; el pooler está hecho para varias
// conexiones, así que permitimos concurrencia real dentro de cada request.
const client = postgres(connectionString, {
  prepare: false,
  max: process.env.NODE_ENV === "production" ? 5 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: process.env.NODE_ENV === "test" ? () => {} : undefined,
});

export async function disconnectIsolatedTestDatabase(): Promise<void> {
  const value = process.env.ARCA_TEST_DATABASE_URL;
  if (!value || connectionString !== value || new URL(value).hostname !== "127.0.0.1") throw new Error("Solo se puede cerrar la conexión aislada de pruebas.");
  await client.end({ timeout: 5 });
}

const connection = drizzle(client, { schema });
/** Existing services join the active command transaction, including db.* users. */
export const db = new Proxy(connection, {
  get(target, property) {
    const active = currentBusinessContext()?.tx ?? target;
    const value: unknown = Reflect.get(active, property);
    return typeof value === "function" ? value.bind(active) : value;
  },
});
export { schema };

/** Transacción de Drizzle (el `tx` que recibe `db.transaction`). */
export type Tx = Parameters<Parameters<typeof connection.transaction>[0]>[0];

/**
 * Ejecuta `fn` dentro de una transacción con el tenant fijado a nivel LOCAL
 * (`set_config(..., true)`), de modo que las políticas RLS de `policies.sql`
 * dejen ver/escribir solo filas de esa empresa.
 *
 * El scope LOCAL es OBLIGATORIO: el pooler reutiliza conexiones y un scope de
 * sesión filtraría el `empresa_id` a la siguiente request (fuga entre tenants).
 *
 * Usar en server actions y lecturas en lugar de `db.*` directo a medida que se
 * migra cada módulo (ver RLS-ROLLOUT.md).
 */
export async function dbConEmpresa<T>(
  empresaId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const active = currentBusinessContext();
  if (active) {
    if (active.user.empresaId !== empresaId) throw new Error("La operación intentó cambiar de empresa.");
    return fn(active.tx);
  }
  return connection.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.empresa_id', ${empresaId}, true)`);
    return fn(tx);
  });
}

/**
 * Bypass controlado de RLS para el panel de super-admin (consultas cross-tenant
 * legítimas). También LOCAL a la transacción.
 */
export async function dbSuperAdmin<T>(fn: (tx: Tx) => Promise<T>, options?: { isolationLevel: "repeatable read" | "read committed" | "serializable" }): Promise<T> {
  const active = currentBusinessContext();
  // Nested services keep the command tenant; they cannot enable bypass in it.
  if (active) return fn(active.tx);
  return connection.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.bypass_rls', 'true', true)`);
    return fn(tx);
  }, options);
}
