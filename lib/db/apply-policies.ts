/**
 * Aplica lib/db/policies.sql (Row-Level Security) sobre la conexión DIRECTA.
 *
 * ⚠️  Activar RLS rompe cualquier query que no fije `app.empresa_id`. Antes de
 *     correrlo en un entorno con tráfico, migrar las server actions y lecturas
 *     a `dbConEmpresa()` / `dbSuperAdmin()`. Ver RLS-ROLLOUT.md.
 *
 * Uso:
 *   npm run db:rls -- --confirm         (aplica)
 *   npm run db:rls                      (dry-run: solo informa)
 */
import path from "node:path";
import postgres from "postgres";
import "dotenv/config";

// DDL multi-statement (DO blocks) requiere la conexión directa (5432), no el
// Transaction Pooler.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("✗ Falta DIRECT_URL (o DATABASE_URL) en el entorno.");
  process.exit(1);
}

const confirmado =
  process.argv.includes("--confirm") || process.env.RLS_CONFIRM === "1";

const archivo = path.join(process.cwd(), "lib", "db", "policies.sql");

if (!confirmado) {
  console.log(
    [
      "DRY-RUN — no se aplicó nada.",
      "",
      "Esto ACTIVA Row-Level Security con FORCE en todas las tablas de negocio.",
      "Cualquier query que no use dbConEmpresa()/dbSuperAdmin() verá 0 filas.",
      "",
      "Para aplicar de verdad (hazlo primero en staging):",
      "  npm run db:rls -- --confirm",
    ].join("\n"),
  );
  process.exit(0);
}

const sql = postgres(url, { max: 1 });

try {
  await sql.file(archivo);
  console.log("✓ RLS policies aplicadas.");
} catch (error) {
  console.error("✗ Falló la aplicación de policies:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
