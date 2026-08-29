/**
 * scripts/pre-migrate.mjs
 *
 * Marca migraciones de Drizzle como "aplicadas" en la tabla __drizzle_migrations
 * sin volver a ejecutar su SQL, para los casos donde el schema ya existe en la DB
 * (aplicado previamente con `db:push`) pero el registro en la tabla de migraciones
 * no está. Esto evita errores tipo "type already exists" durante `db:migrate`.
 *
 * Uso: node --env-file=.env scripts/pre-migrate.mjs
 */

import postgres from "postgres";
import { readFileSync, readdirSync, existsSync } from "fs";
import { createHash } from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "../lib/db/migrations");
const JOURNAL_PATH = join(MIGRATIONS_DIR, "meta/_journal.json");

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function main() {
  console.log("🔍 Verificando estado de migraciones en la base de datos...");

  // Asegurar que el schema y tabla de drizzle existen
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  // Leer el journal de migraciones
  const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf-8"));

  // Obtener migraciones ya registradas en la DB
  const applied = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
  const appliedHashes = new Set(applied.map((r) => r.hash));

  let marked = 0;

  for (const entry of journal.entries) {
    const sqlFile = join(MIGRATIONS_DIR, `${entry.tag}.sql`);
    if (!existsSync(sqlFile)) continue;

    const sqlContent = readFileSync(sqlFile, "utf-8");
    // Drizzle usa el hash del contenido del archivo SQL
    const hash = createHash("sha256").update(sqlContent).digest("hex");

    if (appliedHashes.has(hash)) {
      // Ya está registrada, no hacer nada
      continue;
    }

    // Verificar si el schema ya existe revisando un objeto clave de esa migración
    // Para la migración 0018 (empresa_vertical type), verificamos si el tipo existe
    const schemaAlreadyApplied = await checkSchemaExists(entry.tag, sql);

    if (schemaAlreadyApplied) {
      // Marcar como aplicada sin correr el SQL
      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${hash}, ${entry.when})
        ON CONFLICT DO NOTHING
      `;
      console.log(`✅ Migración ${entry.tag} marcada como aplicada (schema ya existe)`);
      marked++;
    }
  }

  if (marked === 0) {
    console.log("ℹ️  No hay migraciones que marcar, todas están sincronizadas.");
  } else {
    console.log(`✅ ${marked} migración(es) marcada(s) como aplicadas.`);
  }

  await sql.end();
}

/**
 * Verifica si el schema de una migración ya fue aplicado en la DB
 * revisando objetos clave de cada migración.
 */
async function checkSchemaExists(tag, sql) {
  try {
    if (tag === "0018_square_richard_fisk") {
      // Verifica si el tipo empresa_vertical existe
      const res = await sql`
        SELECT 1 FROM pg_type WHERE typname = 'empresa_vertical' LIMIT 1
      `;
      return res.length > 0;
    }

    if (tag === "0019_usuario_onboarding_modulos") {
      const res = await sql`
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'usuario_onboarding_modulos' LIMIT 1
      `;
      return res.length > 0;
    }

    if (tag === "0020_bumpy_nomad") {
      // Verifica si el valor 'semestral' ya existe en el enum ciclo_facturacion
      const res = await sql`
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'ciclo_facturacion'
          AND e.enumlabel = 'semestral'
        LIMIT 1
      `;
      return res.length > 0;
    }

    // Para migraciones sin verificación específica, no marcar automáticamente
    return false;
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error("❌ Error en pre-migrate:", err);
  process.exit(1);
});
