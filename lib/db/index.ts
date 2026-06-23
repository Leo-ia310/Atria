import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL ?? "";

if (!connectionString) {
  throw new Error("DATABASE_URL no está configurada");
}

const client = postgres(connectionString, {
  prepare: false,
  max: process.env.NODE_ENV === "production" ? 1 : 10,
});

export const db = drizzle(client, { schema });
export { schema };
