---
name: atria-rls-policies
description: Use this skill when applying or modifying PostgreSQL Row-Level Security policies to enforce multi-tenant isolation by empresa_id, when writing or editing lib/db/policies.sql, when adding a new table to the schema and you need to define its RLS policies, when debugging "row was not found" issues that might be RLS-related, when wiring app.empresa_id session variable on database connections, or when auditing tenant data isolation. Triggers on mentions of "RLS", "row-level security", "policies", "multi-tenant isolation", "policy", "set_config", "current_setting", "app.empresa_id", or any task in lib/db/policies.sql.
---

# Row-Level Security para ATRIA — Aislamiento multi-tenant

ATRIA es multi-tenant por `empresa_id`. El código en server actions ya filtra por `empresa_id` leído de `auth()`, pero RLS en Postgres es la **segunda línea de defensa**: si un bug se cuela y olvida el filtro, la base de datos rechaza la fila.

## Modelo

1. Cada request del servidor abre conexión a Postgres y ejecuta `SET LOCAL app.empresa_id = '<uuid>'` derivado de la sesión.
2. Cada tabla de negocio tiene policies que comparan `empresa_id` contra `current_setting('app.empresa_id', true)::uuid`.
3. El super-admin tiene un bypass controlado vía `app.bypass_rls = 'true'`.

## Archivo: `lib/db/policies.sql`

Vive en el repo, se aplica con `npm run db:rls` (script a agregar). Idempotente — usar `DROP POLICY IF EXISTS` antes de `CREATE POLICY`.

```sql
-- =============================================================
-- ATRIA — Row-Level Security
-- Idempotente. Aplicar después de db:push.
-- =============================================================

-- Función helper: obtiene empresa_id del session var, NULL si no está
CREATE OR REPLACE FUNCTION atria_empresa_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.empresa_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION atria_bypass() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.bypass_rls', true), 'false') = 'true'
$$;

-- =============================================================
-- Plantilla: aplicar a toda tabla con empresa_id
-- =============================================================

-- Ejemplo para tabla `productos`. Repetir el bloque para CADA tabla de negocio.
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos FORCE ROW LEVEL SECURITY;  -- aplica también a owners

DROP POLICY IF EXISTS productos_tenant_isolation ON productos;
CREATE POLICY productos_tenant_isolation ON productos
  USING (atria_bypass() OR empresa_id = atria_empresa_id())
  WITH CHECK (atria_bypass() OR empresa_id = atria_empresa_id());

-- =============================================================
-- Tablas globales (sin empresa_id) — NO aplicar RLS
-- =============================================================
-- planes, permisos: lectura libre, escritura solo super-admin (manejado en código)
```

### Lista exhaustiva de tablas que requieren RLS

Todas las que tienen columna `empresa_id`:

```
empresas (caso especial: comparar id en lugar de empresa_id)
suscripciones, sucursales, roles, usuarios, auditoria, configuraciones, tipos_cambio
categorias, marcas, unidades_medida, impuestos, productos, listas_precios,
  almacenes, lotes, existencias, movimientos_inventario, conteos_inventario
proveedores, ordenes_compra, compras, cuentas_por_pagar, pagos_proveedor
clientes, cajas, sesiones_caja, formas_pago, ventas, notas_credito,
  cuentas_por_cobrar, abonos_cliente, cotizaciones
tipos_documento, secuencias_fiscales, documentos_fiscales
catalogo_cuentas, centros_costo, periodos_contables, asientos_contables
cuentas_financieras, movimientos_tesoreria, categorias_gasto, gastos
```

**Caso especial `empresas`:** la policy compara `id` en vez de `empresa_id`:
```sql
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresas_tenant_isolation ON empresas;
CREATE POLICY empresas_tenant_isolation ON empresas
  USING (atria_bypass() OR id = atria_empresa_id())
  WITH CHECK (atria_bypass() OR id = atria_empresa_id());
```

**Tablas hijas sin `empresa_id` directo** (ej. `venta_detalle`, `compra_detalle`, `asiento_partidas`): hacen JOIN con su padre que sí tiene `empresa_id`. La policy lo refleja:
```sql
ALTER TABLE venta_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_detalle FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS venta_detalle_tenant_isolation ON venta_detalle;
CREATE POLICY venta_detalle_tenant_isolation ON venta_detalle
  USING (atria_bypass() OR EXISTS (
    SELECT 1 FROM ventas v
    WHERE v.id = venta_detalle.venta_id
      AND v.empresa_id = atria_empresa_id()
  ));
```

Equivalente para: `venta_detalle`, `pagos_venta`, `nota_credito_detalle`,
`compra_detalle`, `orden_compra_detalle`, `cotizacion_detalle`,
`asiento_partidas`, `conteo_detalle`, `producto_unidades`, `producto_componentes`,
`precios`, `rol_permisos`, `usuario_sucursales`.

## Wireup en el cliente Drizzle

`lib/db/index.ts` necesita una variante "tenant-scoped":

```ts
import { sql } from "drizzle-orm";
import { db } from "./index";

export async function dbConEmpresa<T>(
  empresaId: string,
  fn: (tx: typeof db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.empresa_id', ${empresaId}, true)`);
    return fn(tx);
  });
}

export async function dbSuperAdmin<T>(
  fn: (tx: typeof db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.bypass_rls', 'true', true)`);
    return fn(tx);
  });
}
```

Server actions deben usar `dbConEmpresa(user.empresaId, async (tx) => {...})` en vez de `db.*` directo. Migrar progresivamente.

**`set_config(_, _, true)`** — el tercer parámetro `true` hace que el setting sea LOCAL a la transacción. Sin él, persiste en la conexión y contamina la próxima request (Vercel pool de conexiones).

## Pool de conexiones — cuidado

En Vercel + Supabase pgbouncer, las conexiones se reutilizan. Por eso `set_config(_, _, true)` (LOCAL) es obligatorio. Si usas `true=false` (SESSION), un usuario A puede heredar el `empresa_id` de B en una request posterior. Catástrofe de seguridad.

**Checklist de configuración del cliente postgres-js:**
```ts
postgres(connectionString, {
  prepare: false,       // pgbouncer transaction mode no soporta prepared statements
  max: 1,               // en serverless, 1 por instance
});
```

## Testing de RLS

Escribir tests que prueban explícitamente:

```ts
// __tests__/rls.test.ts
test("usuario de empresa A no puede ver productos de empresa B", async () => {
  const productoB = await dbSuperAdmin(async (tx) => {
    return tx.insert(productos).values({
      empresaId: empresaB.id, sku: "TEST", nombre: "Producto B", ...
    }).returning();
  });

  const visibles = await dbConEmpresa(empresaA.id, async (tx) => {
    return tx.select().from(productos).where(eq(productos.id, productoB[0].id));
  });

  expect(visibles).toHaveLength(0);
});

test("intento de INSERT con empresa_id ajeno falla", async () => {
  await expect(
    dbConEmpresa(empresaA.id, async (tx) => {
      return tx.insert(productos).values({
        empresaId: empresaB.id, sku: "HACK", ...  // empresa_id mentido
      });
    }),
  ).rejects.toThrow();  // WITH CHECK lo bloquea
});
```

## Script de aplicación

Agregar a `package.json`:
```json
"scripts": {
  "db:rls": "tsx lib/db/apply-policies.ts"
}
```

```ts
// lib/db/apply-policies.ts
import fs from "node:fs";
import postgres from "postgres";
import "dotenv/config";

const sql = postgres(process.env.DATABASE_URL!);
const policies = fs.readFileSync("./lib/db/policies.sql", "utf-8");

await sql.unsafe(policies);
console.log("✓ RLS policies aplicadas");
await sql.end();
```

Correr después de cada `db:push` cuando se agreguen tablas nuevas.

## Errores comunes y debugging

| Síntoma | Causa probable | Fix |
|---|---|---|
| `SELECT` devuelve 0 filas pero sé que existen | Olvidaste `set_config('app.empresa_id', ...)` antes del query | Usar `dbConEmpresa()` |
| `INSERT` falla con `new row violates row-level security policy` | El `empresa_id` insertado no coincide con `atria_empresa_id()` | Verificar que el insert usa `user.empresaId` correcto |
| RLS funciona en local pero no en Vercel | Pool reusa conexiones; setting global persistió | Asegurar `set_config(_, _, true)` (LOCAL) |
| Super-admin no ve datos cross-tenant | Olvidaste activar bypass | Usar `dbSuperAdmin()` para queries del panel |
| Performance lenta con RLS | Las policies usan subqueries no indexadas | Verificar índice en `empresa_id` (ya está en todas las tablas del schema) |

## Lo que NO debe pasar

- ❌ Server action que use `db.*` directo sin scope de empresa (rompe defense-in-depth)
- ❌ Policy `USING (true)` o `USING (empresa_id IS NOT NULL)` (no aísla nada)
- ❌ `set_config(_, _, false)` en producción (contamina pool)
- ❌ Aplicar RLS a `planes` o `permisos` (son tablas globales)
- ❌ Confiar SOLO en RLS sin filtrar también en código (RLS es la red de seguridad, no el filtro primario)

## Checklist al agregar una tabla nueva

- [ ] La tabla tiene `empresa_id uuid NOT NULL` con FK a `empresas` ON DELETE CASCADE
- [ ] Hay índice en `empresa_id` (Drizzle: `index("X_empresa_idx").on(t.empresaId)`)
- [ ] Agregado bloque RLS en `lib/db/policies.sql` (5 líneas: ALTER, FORCE, DROP, CREATE)
- [ ] Si es tabla hija sin `empresa_id` directo, la policy hace JOIN al padre
- [ ] Corrido `npm run db:push && npm run db:rls`
- [ ] Test de aislamiento pasa
