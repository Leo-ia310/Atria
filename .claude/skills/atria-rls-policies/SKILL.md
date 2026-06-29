---
name: atria-rls-policies
description: Use this skill when applying or modifying PostgreSQL Row-Level Security policies to enforce multi-tenant isolation by organizationId, when designing the SQL migration that adds RLS to a Prisma schema, when adding a new model with organizationId and you need to define its RLS policies, when debugging "row not found" issues that might be RLS-related, when wiring app.organization_id session variable on Prisma connections, or when auditing tenant data isolation. Triggers on mentions of "RLS", "row-level security", "policies", "multi-tenant isolation", "policy", "set_config", "current_setting", "app.organization_id", or any task related to tenant data isolation.
---

# Row-Level Security para Atria — Aislamiento multi-tenant

Atria es multi-tenant por `organizationId`. El backend NestJS filtra explícitamente en cada service con `where: { organizationId: user.organizationId }`, pero **RLS en Postgres es la segunda línea de defensa**: si un bug se cuela y olvida el filtro, la base de datos rechaza la fila.

**Estado actual:** Prisma no aplica RLS automáticamente. Hay que escribir migraciones SQL manuales con `prisma migrate dev --create-only` o aplicar policies vía un script post-migración.

## Modelo

1. El backend en cada request abre transacción Prisma y ejecuta `SET LOCAL app.organization_id = '<uuid>'` derivado del JWT.
2. Cada tabla de negocio tiene policies que comparan `organization_id` contra `current_setting('app.organization_id', true)::uuid`.
3. El super-admin (cuando se implemente) usa `app.bypass_rls = 'true'`.

## Archivo: `apps/api/prisma/migrations/<timestamp>_rls/migration.sql`

Crear con `npx prisma migrate dev --name rls --create-only` y editar el SQL manualmente. Idempotente — usar `DROP POLICY IF EXISTS` antes de `CREATE POLICY`.

```sql
-- =============================================================
-- Atria — Row-Level Security
-- Aplicar via prisma migrate. Idempotente.
-- =============================================================

CREATE OR REPLACE FUNCTION atria_organization_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION atria_bypass() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.bypass_rls', true), 'false') = 'true'
$$;

-- =============================================================
-- Plantilla: repetir para CADA tabla con organization_id
-- =============================================================

ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_tenant_isolation ON "Product";
CREATE POLICY product_tenant_isolation ON "Product"
  USING (atria_bypass() OR organization_id = atria_organization_id())
  WITH CHECK (atria_bypass() OR organization_id = atria_organization_id());
```

### Tablas que requieren RLS (con `organizationId`)

```
Organization (especial: usa "id" en lugar de organization_id)
Membership, User (cuidado: User es global, Membership es el join multi-tenant)
Role, Branch, Warehouse, Category, Brand, TaxRate
Product, ProductInventory, ProductBatch, ProductSerial, StockMovement
InventoryTransfer, InventoryTransferItem
Supplier, Customer
Sale, SaleItem, Payment, Quotation, QuotationItem, SalesReturn
Receivable, Payable, Expense
Account, JournalEntry, JournalEntryLine
Subscription, BillingInvoice
EmployeeProfile, AttendanceRecord
AuditLog, DeviceSession, EmailVerificationToken, PasswordResetToken
FileAsset, ReportExport, ApiCredential
CompanySetting, StoredPaymentMethod
```

**Caso especial `Organization`:**
```sql
DROP POLICY IF EXISTS organization_tenant_isolation ON "Organization";
CREATE POLICY organization_tenant_isolation ON "Organization"
  USING (atria_bypass() OR id = atria_organization_id())
  WITH CHECK (atria_bypass() OR id = atria_organization_id());
```

**Tablas hijas sin `organizationId` directo** (ej. `SaleItem`, `JournalEntryLine`): policy via subquery al padre:
```sql
ALTER TABLE "SaleItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sale_item_tenant_isolation ON "SaleItem";
CREATE POLICY sale_item_tenant_isolation ON "SaleItem"
  USING (atria_bypass() OR EXISTS (
    SELECT 1 FROM "Sale" s
    WHERE s.id = "SaleItem".sale_id
      AND s.organization_id = atria_organization_id()
  ));
```

## Wireup en PrismaService

`apps/api/src/infrastructure/prisma/prisma.service.ts` debe exponer un helper:

```ts
@Injectable()
export class PrismaService extends PrismaClient {
  async withOrganization<T>(
    organizationId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.organization_id', $1, true)`,
        organizationId,
      );
      return fn(tx);
    });
  }

  async withSuperAdminBypass<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'true', true)`);
      return fn(tx);
    });
  }
}
```

Cada service llama `prisma.withOrganization(user.organizationId, async (tx) => {...})` para queries multi-tenant.

**`set_config(_, _, true)`** — el tercer parámetro `true` hace que sea LOCAL a la transacción. Sin él, persiste en la conexión y contamina la siguiente request del pool.

## Pool de conexiones — cuidado crítico

En producción Postgres pooling (PgBouncer/Supavisor en transaction mode) reutiliza conexiones. Por eso `set_config(_, _, true)` (LOCAL) es OBLIGATORIO. Si usas `false` (SESSION), un usuario A puede heredar `organization_id` de B. Catástrofe de seguridad.

Prisma con PgBouncer transaction mode requiere `?pgbouncer=true&connection_limit=1` en `DATABASE_URL` y disable prepared statements.

## Testing de RLS

```ts
// apps/api/test/rls.e2e-spec.ts
describe('RLS', () => {
  it('usuario de org A no puede ver productos de org B', async () => {
    const productoB = await prisma.withSuperAdminBypass((tx) =>
      tx.product.create({ data: { organizationId: orgB.id, sku: 'TEST', ...} }),
    );
    const visibles = await prisma.withOrganization(orgA.id, (tx) =>
      tx.product.findMany({ where: { id: productoB.id } }),
    );
    expect(visibles).toHaveLength(0);
  });

  it('INSERT con organization_id ajeno falla', async () => {
    await expect(
      prisma.withOrganization(orgA.id, (tx) =>
        tx.product.create({ data: { organizationId: orgB.id, sku: 'HACK', ... } }),
      ),
    ).rejects.toThrow();  // WITH CHECK lo bloquea
  });
});
```

## Errores comunes

| Síntoma | Causa probable | Fix |
|---|---|---|
| `findMany` devuelve [] pero los datos existen | Olvidaste `withOrganization()` | Envolver la query |
| `create` falla con "row violates row-level security policy" | El `organizationId` del data no coincide con `atria_organization_id()` | Verificar que el service usa `user.organizationId` correcto |
| Funciona en local pero no en Vercel/Supabase prod | Pool reusa conexión; setting persistió | Asegurar `set_config(_, _, true)` LOCAL |
| Super-admin no ve cross-tenant | Falta bypass | `prisma.withSuperAdminBypass(...)` |

## Lo que NO debe pasar

- ❌ Service usando `this.prisma.product.*` directo en lugar de `prisma.withOrganization(...)`. Rompe defense-in-depth.
- ❌ Policy `USING (true)` — no aísla nada.
- ❌ `set_config(_, _, false)` (SESSION) en producción.
- ❌ Aplicar RLS a `Plan`, `Permission` (tablas globales) si las hubiera.
- ❌ Confiar SOLO en RLS sin filtrar en código — el filtro primario es del service, RLS es red de seguridad.

## Checklist al agregar un modelo Prisma nuevo

- [ ] Tiene `organizationId String` con `@@index([organizationId])` o relación a Organization
- [ ] Migración SQL agrega bloque RLS (5 líneas: ALTER, FORCE, DROP POLICY, CREATE POLICY)
- [ ] Si es modelo hijo sin `organizationId`, la policy hace EXISTS al padre
- [ ] El service correspondiente envuelve queries en `prisma.withOrganization(user.organizationId, ...)`
- [ ] Test de aislamiento pasa
