# @atria/api

API NestJS 11 multi-tenant que potencia Atria — el SaaS de ERP/POS/inventario/contabilidad para Latinoamérica.

> Esta es la capa de dominio + datos. El frontend Next.js vive en [`../web`](../web). Los contratos compartidos en [`../../packages/contracts`](../../packages/contracts).

## Stack

- **NestJS 11** (Express adapter)
- **Prisma 6** + **PostgreSQL 16**
- **JWT custom** (access + refresh + CSRF) con cookies `httpOnly`, hashing argon2
- **BullMQ + Redis** para colas (reports, uploads)
- **Socket.IO** vía `RealtimeGateway`
- **Helmet + Throttler** + `SanitizeInputPipe` global + `AuditInterceptor`
- **Swagger** en `/api/docs`

## Modo `API_ENABLED=false`

Por defecto la API responde **`503 Service Unavailable`** a todo. Esto permite desarrollar el frontend sin tocar Postgres/Redis. Para activarla:

```bash
echo "API_ENABLED=true" >> .env
npm run start:dev
```

## Estructura

```
src/
├── main.ts                      Bootstrap + Swagger + CORS + helmet
├── app.module.ts                Cablea TODOS los módulos + guards globales
├── config/env.schema.ts         Validación de env con Zod
├── common/
│   ├── decorators/              @CurrentUser · @Permissions · @Public
│   ├── guards/                  AccessTokenGuard · CsrfGuard · PermissionsGuard
│   ├── interceptors/            AuditInterceptor
│   ├── middleware/              RequestContextMiddleware
│   ├── pipes/                   SanitizeInputPipe (XSS)
│   ├── filters/                 GlobalExceptionFilter
│   └── utils/request.utils.ts   cookieNames · extractTenantSlug
├── infrastructure/
│   ├── prisma/                  PrismaService
│   ├── redis/                   RedisService
│   ├── queue/                   BullMQ processors (report, upload)
│   └── logger/                  Pino structured
├── auth/                        register · login · refresh · logout · me · sessions
├── tenancy/                     OrganizationProvisioningService
├── audit/                       AuditLog automático
├── mailer/                      nodemailer + plantillas
├── onboarding/                  Wizard post-registro
├── dashboard/                   KPIs + serie + stock crítico + top vendedores
├── branches/                    CRUD sucursales + analytics
├── inventory/                   Productos + alerts + movements
├── pos/                         Catálogo + checkout idempotente
├── sales/                       Ventas + customers + quotations + analytics
├── accounting/                  Plan de cuentas + asientos + summary
├── employees/                   Perfiles + asistencia + actividad
├── reports/                     Catálogo + exports (encolados)
├── settings/                    CompanySetting + security
├── billing/                     Suscripción + change-plan + facturas
├── uploads/                     FileAsset + MIME validation + scan queue
├── realtime/                    Socket.IO gateway
└── health/                      /health
```

## Endpoints clave

Todos bajo `/api/v1/`. Auth requerida salvo lo marcado como público.

### Autenticación

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/register` | público | Crea tenant + usuario admin + sucursal principal en transacción |
| POST | `/auth/login` | público | Cookies `atria_access` + `atria_refresh` + `atria_csrf` |
| POST | `/auth/refresh` | público (cookie) | Rota refresh token |
| POST | `/auth/logout` | sesión | Revoca refresh token |
| POST | `/auth/forgot-password` | público | Envía email de reset |
| POST | `/auth/reset-password` | público | Aplica nueva password con token |
| POST | `/auth/verify-email` | público | Verifica email con token |
| GET | `/auth/me` | sesión | Datos de la sesión activa |
| GET | `/auth/sessions` | sesión | Lista dispositivos del usuario |
| POST | `/auth/revoke-session` | sesión | Cierra sesión específica |

### Operación

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/dashboard/overview` | KPIs + serie 14d + stock crítico + top vendedores |
| GET | `/onboarding/state` | Estado del wizard inicial |
| POST | `/onboarding/complete` | Completa el wizard |
| GET POST | `/branches` | Lista / crea sucursal |
| GET | `/branches/analytics` | Ventas + inventario por sucursal |
| GET POST | `/inventory/products` | Lista / crea producto |
| GET | `/inventory/alerts` | Stock bajo + lotes por vencer |
| GET | `/inventory/movements` | Últimos 50 movimientos |
| GET POST | `/pos/catalog` `/pos/checkout` | Catálogo + procesar venta (asiento auto) |
| GET | `/pos/suspended` | Ventas pausadas |
| GET POST | `/sales` `/sales/:id` | Lista / detalle (con asiento) |
| GET | `/sales/analytics` | Revenue + ticket promedio + top clientes |
| GET POST | `/sales/customers` | CRUD clientes |
| GET POST | `/sales/quotations` | CRUD cotizaciones |
| GET | `/accounting/summary` | CxC + CxP + flujo de caja + gastos |
| GET | `/accounting/accounts` | Plan de cuentas |
| GET POST | `/accounting/entries` | Libro diario + asiento manual (valida balance) |
| GET POST | `/employees` | Lista / crea empleado (con membership) |
| GET | `/employees/attendance` `/employees/activity` | Asistencia + actividad |
| GET POST | `/reports/exports` | Lista + encola exportación en BullMQ |
| GET | `/reports/catalog` | Tipos de reporte disponibles |
| GET PATCH | `/settings/company` | Empresa + facturación + POS |
| GET | `/settings/security` | Dispositivos + políticas password |
| GET | `/billing/overview` | Suscripción + usage + facturas |
| POST | `/billing/change-plan` | Cambiar BUSINESS ↔ ENTERPRISE |
| GET | `/health` | Liveness |

Documentación completa interactiva: **http://localhost:4000/api/docs** (con `API_ENABLED=true`).

## Seguridad

**5 guards globales** se aplican en orden:
1. `ThrottlerGuard` — rate-limit por IP (180 req/min).
2. `AccessTokenGuard` — valida cookie `atria_access` o `Authorization: Bearer`. Excepción: rutas `@Public()`.
3. `CsrfGuard` — exige header `x-csrf-token` que coincida con la cookie `atria_csrf` en mutaciones.
4. `PermissionsGuard` — valida `@Permissions('key')` contra los permisos del rol del usuario.
5. `AuditInterceptor` — registra cada mutación con quién/qué/cuándo en `AuditLog`.

**Cookies**:
- `atria_access` (httpOnly, sameSite=lax, secure en prod) — JWT 15m
- `atria_refresh` (httpOnly, sameSite=lax, secure en prod) — JWT 30d, rotación en cada `/refresh`
- `atria_csrf` (NO httpOnly) — token de doble submit replicado en header

**Multi-tenant**: cada service filtra por `user.organizationId` derivado del JWT. **Nunca** se acepta `organizationId` del body. Para la red de seguridad opcional con RLS, ver skill `atria-rls-policies`.

## Cómo correr

```bash
# Desde raíz del monorepo:
npm install
cp apps/api/.env.example apps/api/.env
# Editar JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, API_ENABLED=true

docker compose up -d postgres redis
npm run db:generate     # prisma generate
npm run db:migrate      # prisma migrate dev
npm run db:seed         # poblar org demo "Acero Norte"
npm run dev:api         # arranca en http://localhost:4000
```

Credenciales del seed:
- Email: `owner@acero.test` / Password: `Atria2026!`
- Tenant slug: `acero-norte`

## Tests

```bash
npm run test              # unit
npm run test:e2e          # integración
npm run test:cov          # cobertura
```

> Actualmente 0 specs. Prioridad alta para `AccountingModule` (motor contable) y `AuthModule` (flujos de JWT + CSRF).

## Variables de entorno relevantes

```env
NODE_ENV=development|production
API_ENABLED=true|false      # false → 503 a todo
PORT=4000
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
APP_URL=http://localhost:3000
API_URL=http://localhost:4000
COOKIE_DOMAIN=localhost
SECURE_COOKIES=false        # true en prod
CORS_ORIGINS=http://localhost:3000
SMTP_HOST= SMTP_PORT= SMTP_USER= SMTP_PASS=
SMTP_FROM=no-reply@atria.local
UPLOAD_MAX_BYTES=10485760
REPORT_EXPORT_PATH=./exports
```

## Reglas innegociables

Ver [`../../CLAUDE.md`](../../CLAUDE.md) sección 4. En resumen:

1. **Multi-tenant por `organizationId`** del JWT, jamás del body.
2. **Dinero en `Decimal`**, nunca `Float`.
3. **`StockMovement` y `JournalEntryLine` son APPEND-ONLY**. Para corregir → contramovimiento o asiento reverso.
4. **El motor contable es sagrado.** Cada operación que toca dinero/stock pasa por `AccountingService`.
5. **Asientos siempre cuadran** (`Σ debit === Σ credit`).
6. **Períodos cerrados son intocables.**
7. **CSRF obligatorio en mutaciones.**
