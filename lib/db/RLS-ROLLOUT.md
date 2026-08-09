# Rollout de Row-Level Security (RLS)

RLS es la **segunda línea de defensa** del aislamiento multi-tenant: aunque una
query olvide `where empresa_id = ...`, Postgres no devuelve filas de otra
empresa. El filtro en código sigue siendo la primera línea — RLS no lo
reemplaza, lo respalda.

## Qué se entregó

- `lib/db/policies.sql` — políticas para las 66 tablas con datos de tenant
  (65 con `empresa_id` directo + `empresas` + 15 tablas hijas por JOIN al padre).
  Idempotente. `planes` y `permisos` quedan fuera (catálogos globales).
- `lib/db/index.ts` — helpers `dbConEmpresa(empresaId, fn)` y `dbSuperAdmin(fn)`
  que fijan `app.empresa_id` / `app.bypass_rls` **a nivel de transacción**.
- `lib/db/apply-policies.ts` + `npm run db:rls` — aplicador con guarda `--confirm`.

## Por qué NO está activado todavía

Con `FORCE ROW LEVEL SECURITY`, toda conexión que no haya hecho
`set_config('app.empresa_id', ...)` ve **0 filas** y sus INSERT fallan. Hoy las
server actions y lecturas usan `db.*` directo (sin fijar el tenant). Activar RLS
antes de migrarlas deja la app sin datos. Por eso el rollout es por fases.

## Fases

1. **Staging primero.** Clona datos a un entorno de staging y aplica:
   `npm run db:rls -- --confirm`. Verifica que la app se cae como se espera
   (0 filas) — confirma que RLS está activo.

2. **Migrar por módulo.** Reemplaza `db.select/insert/update/...` por
   `dbConEmpresa(user.empresaId, (tx) => tx.select()...)` en cada archivo de
   `lib/actions/*` y en los helpers de lectura (`lib/*-data.ts`, `queries.ts`,
   `server-access.ts`, layouts que consultan). Un módulo a la vez, verificando
   en staging.

   ```ts
   // antes
   const filas = await db.select().from(clientes)
     .where(eq(clientes.empresaId, user.empresaId));

   // después (RLS ya filtra por empresa; el where explícito se mantiene como
   // primera línea de defensa)
   const filas = await dbConEmpresa(user.empresaId, (tx) =>
     tx.select().from(clientes).where(eq(clientes.empresaId, user.empresaId)),
   );
   ```

3. **Panel super-admin y crons.** Las consultas cross-tenant legítimas
   (`app/(superadmin)/*`, `lib/suscripciones/expiracion.ts`,
   `lib/tesoreria/gastos-recurrentes.ts`) usan `dbSuperAdmin(fn)`. Los crons
   procesan varias empresas: envuelven cada empresa en su `dbConEmpresa`, o usan
   `dbSuperAdmin` si de verdad operan global.

4. **Registro de empresa.** `lib/actions/registro.ts` crea la empresa y su
   primer usuario **antes** de que exista sesión: ese bootstrap corre en
   `dbSuperAdmin(fn)` (o antes de activar RLS en esas tablas).

5. **Activar en producción** solo cuando todos los módulos estén migrados y
   verdes en staging. Reaplicar `npm run db:rls -- --confirm` tras cada
   `db:push` que agregue tablas (añadir la tabla nueva a `policies.sql`).

## Test de aislamiento (recomendado antes de activar en prod)

```ts
// Empresa A no ve datos de empresa B
const visibles = await dbConEmpresa(empresaA, (tx) =>
  tx.select().from(productos).where(eq(productos.id, productoDeB)),
);
expect(visibles).toHaveLength(0);

// No se puede insertar con empresa_id ajeno (WITH CHECK lo bloquea)
await expect(
  dbConEmpresa(empresaA, (tx) =>
    tx.insert(productos).values({ empresaId: empresaB, /* ... */ }),
  ),
).rejects.toThrow();
```

## Checklist al agregar una tabla nueva con `empresa_id`

- [ ] Añadir el nombre a `tablas[]` (o a `specs[]` si es hija) en `policies.sql`.
- [ ] `npm run db:push && npm run db:rls -- --confirm`.
- [ ] La server action usa `dbConEmpresa()`.
