import fs from "node:fs";
import assert from "node:assert/strict";
import postgres from "postgres";

// Validate every raw bootstrap query against the configured schema. EXPLAIN
// without ANALYZE in a READ ONLY transaction does not fetch business rows.
const source = fs.readFileSync(new URL("../lib/desktop-bootstrap.ts", import.meta.url), "utf8");
const queries = [...source.matchAll(/query\("[^"]+",\s*sql`([\s\S]*?)`\)/g)].map((match) => match[1]
  .replaceAll("${user.empresaId}", "'00000000-0000-0000-0000-000000000000'")
  .replaceAll("${branches}", "ARRAY[]::uuid[]")
  .replaceAll("${!previous}", "true")
  .replaceAll("${JSON.stringify(changes.inventario_base ?? [])}", "'[]'"));
assert.ok(queries.length >= 10);
assert.ok(queries.every((query) => !query.includes("${")));
const connection = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL;
assert.ok(connection, "Database URL missing");
const client = postgres(connection, { prepare: false, max: 1, connect_timeout: 15, onnotice: () => {} });
try {
  await client.begin("read only", async (tx) => {
    for (let index = 0; index < queries.length; index++) {
      try { await tx.unsafe(`EXPLAIN ${queries[index]}`); }
      catch (error) { throw new Error(`Bootstrap query ${index + 1} failed (SQLSTATE ${error.code || "unknown"}): ${error.message}`); }
    }
  });
  console.log(`${queries.length} bootstrap queries validated against PostgreSQL; no business data read or written.`);
} finally { await client.end({ timeout: 5 }); }
