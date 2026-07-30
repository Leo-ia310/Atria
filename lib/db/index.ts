import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL ?? "";

if (!connectionString) {
  throw new Error("DATABASE_URL no está configurada");
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
});

export const db = drizzle(client, { schema });
export { schema };
