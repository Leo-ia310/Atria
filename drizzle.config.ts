import { defineConfig } from "drizzle-kit";
import "dotenv/config";

// Las migraciones y operaciones administrativas SIEMPRE usan la conexión
// directa a Postgres (puerto 5432), no el Transaction Pooler: el pooler de
// transacciones no soporta sentencias multi-statement ni prepared statements
// como los que emite drizzle-kit. `DIRECT_URL` es el nombre canónico; se
// mantiene `DATABASE_URL` como fallback por compatibilidad con el entorno
// existente, donde `DATABASE_URL` ya apunta a la conexión directa.
const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: directUrl!,
  },
  verbose: true,
  strict: true,
});
