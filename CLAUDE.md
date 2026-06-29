# ATRIA — Contexto para Claude Code

> **Lee este archivo completo antes de tocar código.** Es la fuente de verdad sobre qué es Atria, cómo está estructurado y qué reglas son innegociables.

---

## 1. Qué es Atria

**Atria es un SaaS multi-tenant de gestión comercial** que reemplaza Excel + cuaderno de fiado + sistemas desconectados. Conecta **POS, inventario, contabilidad, empleados, reportes y facturación SaaS** en una sola plataforma.

**Idea central:** cada evento del negocio (venta, compra, gasto, ajuste) genera **automáticamente su asiento contable de partida doble**. El cajero ve "venta → cobrar → ticket". El contador ve el asiento en el libro diario. Nadie cuadra a mano.

**Usuarios objetivo:** ferreterías (`HARDWARE`), farmacias (`PHARMACY`), tiendas (`RETAIL`), distribuidoras (`DISTRIBUTOR`), suministros médicos (`MEDICAL_SUPPLY`) — pequeñas y medianas empresas de **Honduras, Nicaragua, Guatemala, Costa Rica y El Salvador**.

---

## 2. Arquitectura — Monorepo

```
atria/
├── apps/
│   ├── api/        NestJS 11 + Prisma 6 (Postgres) — backend completo
│   └── web/        Next.js 15 (App Router) — frontend operativo
├── packages/
│   └── contracts/  Tipos compartidos: navigation, permissions, plans
├── nginx/          Reverse proxy local y producción
├── docker-compose.yml
├── package.json    Workspaces npm
└── tsconfig.base.json
```

**Workspaces npm**: `apps/*` y `packages/*`. Para correr scripts en uno: `npm run dev --workspace @atria/web` (o `@atria/api`, `@atria/contracts`).

**Node ≥22, npm ≥11.**

---

## 3. Stack técnico (innegociable)

| Capa | apps/api (NestJS) | apps/web (Next.js) |
|---|---|---|
| Framework | **NestJS 11** | **Next.js 15** (App Router) |
| Lenguaje | TypeScript estricto | TypeScript estricto |
| ORM / DB | **Prisma 6** + PostgreSQL 16 | — (consume API) |
| Auth | JWT custom: access + refresh + CSRF, cookies httpOnly, argon2 | Cliente HTTP con cookies + CSRF auto-refresh en 401 |
| Validación | class-validator + class-transformer + Zod | Zod + react-hook-form + `@hookform/resolvers/zod` |
| Estilos | — | Tailwind v4 (CSS variables via `@theme`) |
| Realtime | Socket.IO via `RealtimeGateway` | (cliente WS por implementar) |
| Colas | BullMQ + Redis | — |
| Mail | nodemailer / Resend | — |
| Cache | Redis (ioredis) | TanStack Query |
| Tablas | — | TanStack Table v8 |
| Gráficas | — | Recharts |
| Íconos | — | Lucide React |
| Tests | Jest + supertest | — |
| Docs API | Swagger (`/api/docs`) | — |

**Deploy target:** Docker Compose (postgres, redis, api, web, nginx) — `docker-compose.yml` en la raíz.

---

## 4. Reglas de arquitectura innegociables

1. **Multi-tenant por `organizationId`.** Toda tabla de negocio en Prisma lo lleva. Service queries DEBEN filtrar por `organizationId` leído del JWT (`user.organizationId`), nunca del body.
2. **Membership intermedio** entre `User` y `Organization` — un usuario puede pertenecer a varias orgs. La sesión activa fija una sola.
3. **Dinero siempre en `Decimal`/numeric con precisión ≥ 2.** Nunca `Float`.
4. **Append-only en `StockMovement` y `JournalEntryLine`.** Para corregir → contramovimiento o asiento de anulación. Jamás UPDATE/DELETE en estas tablas.
5. **El motor contable es sagrado.** Toda mutación de dinero/stock pasa por `apps/api/src/accounting/`. Sin atajos desde otros services.
6. **Asientos siempre cuadran.** `Σ debit === Σ credit` antes de persistir. Si no, throw `BadRequestException`.
7. **JWT custom, no NextAuth.** El web usa cookies httpOnly emitidas por el API (`atria_access`, `atria_refresh`, `atria_csrf`).
8. **CSRF en mutaciones.** El web lee la cookie `atria_csrf` (NO httpOnly) y la replica en header `x-csrf-token` en POST/PUT/PATCH/DELETE.
9. **Tenant slug** se envía en header `x-tenant-slug` o por subdomain. El cliente lo guarda en `localStorage`.
10. **Períodos contables cerrados son intocables.** Validar antes de insertar `JournalEntry`.
11. **API_ENABLED=false → 503.** En desarrollo frontend el API responde 503 hasta activar la flag. El cliente debe manejar `ApiDisabledError` gracefully.

---

## 5. Estructura del backend (`apps/api/`)

```
apps/api/
├── prisma/
│   ├── schema.prisma           43 modelos: Organization, Membership, User, Role,
│   │                           Branch, Warehouse, Product, ProductInventory,
│   │                           Sale, SaleItem, Payment, JournalEntry, Account...
│   └── seed.ts                 Org "Acero Norte" con roles del roleTemplates
├── src/
│   ├── main.ts                 Bootstrap, Swagger, CORS, helmet, cookie-parser
│   ├── app.module.ts           Cablea TODOS los módulos
│   ├── config/env.schema.ts    Validación de env vars con Zod
│   ├── common/
│   │   ├── decorators/         @CurrentUser, @Permissions, @Public
│   │   ├── guards/             AccessTokenGuard, CsrfGuard, PermissionsGuard
│   │   ├── interceptors/       AuditInterceptor
│   │   ├── middleware/         RequestContextMiddleware (request id, tenant)
│   │   ├── pipes/              SanitizeInputPipe (XSS sanitization)
│   │   ├── filters/            GlobalExceptionFilter (logs estructurados)
│   │   └── utils/request.utils.ts  cookieNames, extractTenantSlug, etc.
│   ├── infrastructure/
│   │   ├── prisma/             PrismaService (singleton)
│   │   ├── redis/              RedisService
│   │   ├── queue/              BullMQ processors (report, upload)
│   │   └── logger/             Pino structured logger
│   ├── auth/                   Login/register/refresh/logout/me/sessions
│   ├── tenancy/                OrganizationProvisioningService
│   ├── audit/                  AuditLog automático via interceptor
│   ├── mailer/                 Templates de correo + nodemailer
│   ├── onboarding/             Wizard inicial post-registro
│   ├── dashboard/              KPIs + serie de ventas + stock crítico
│   ├── branches/               CRUD sucursales
│   ├── inventory/              Productos, almacenes, lotes, movimientos
│   ├── pos/                    Sesiones de caja, ticket, idempotency
│   ├── sales/                  Ventas, cotizaciones, devoluciones
│   ├── accounting/             Plan de cuentas, asientos, libro diario, estados
│   ├── employees/              Perfiles, asistencia
│   ├── reports/                Generación de reportes (encolada en BullMQ)
│   ├── settings/               CompanySetting key-value por org
│   ├── billing/                Suscripción SaaS, BillingInvoice
│   ├── uploads/                FileAsset con MIME validation y queue scan
│   ├── realtime/               Socket.IO gateway
│   └── health/                 /health endpoint
```

### Endpoints clave (todos bajo `/api/v1/`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/register` | público | Crea tenant + admin + sucursal principal en una transacción |
| POST | `/auth/login` | público | Devuelve cookies httpOnly + datos del user |
| POST | `/auth/refresh` | público (cookie refresh) | Rota refresh token |
| POST | `/auth/logout` | autenticado | Revoca sesión |
| GET | `/auth/me` | autenticado | Datos de sesión actual |
| GET | `/auth/sessions` | autenticado | Lista device sessions |
| GET | `/dashboard/overview` | autenticado | KPIs + serie + stock crítico + top vendedores |
| GET | `/health` | público | Liveness probe |

(Resto: ver Swagger en http://localhost:4000/api/docs cuando `API_ENABLED=true`.)

---

## 6. Estructura del frontend (`apps/web/`)

```
apps/web/
├── app/
│   ├── layout.tsx              Root layout (Inter font + globals.css)
│   ├── globals.css             Design system: tokens en @theme, .atria-btn, etc.
│   ├── page.tsx                Landing pública
│   ├── (auth)/
│   │   ├── layout.tsx          Layout simple sin sidebar
│   │   ├── login/page.tsx      Form: tenantSlug + email + password
│   │   └── registro/page.tsx   Wizard 3 pasos → POST /auth/register
│   └── app/                    ZONA PROTEGIDA (middleware redirige si no hay cookie)
│       ├── layout.tsx          SessionProvider + ToastProvider + Sidebar + Header
│       ├── page.tsx            Dashboard real consumiendo /dashboard/overview
│       ├── pos/                Stub — POS dedicado por implementar
│       ├── ventas/             Stub
│       ├── clientes/           Stub
│       ├── inventario/         Stub
│       ├── compras/            Stub
│       ├── contabilidad/       Stub
│       ├── empleados/          Stub
│       ├── sucursales/         Stub
│       ├── reportes/           Stub
│       ├── configuracion/      Stub
│       └── facturacion/        Stub
├── components/
│   ├── ui/                     Button, Input, Select, Card, Badge, KpiCard,
│   │                           DataTable, EmptyState, Modal, Toast
│   ├── layout/                 Sidebar (consume contracts.primaryNavigation),
│   │                           Header, PageHeader, PageStub, SessionProvider
│   └── marketing/              Nav, FAQ (auxiliares del landing)
├── lib/
│   ├── api-client.ts           fetch wrapper: cookies + CSRF + auto-refresh
│   ├── auth-client.ts          login/register/logout/me hablando con API
│   └── utils.ts                cn, formatearMoneda, formatearFecha, iniciales
├── middleware.ts               Redirige a /login si no hay cookie atria_access
├── next.config.ts              standalone output, transpila @atria/contracts
├── tsconfig.json               Extiende ../../tsconfig.base.json (paths a contracts)
└── Dockerfile                  Multi-stage build
```

### Reglas frontend

- **Cliente HTTP único.** Toda llamada al API pasa por `lib/api-client.ts`. NO uses `fetch` directo. El cliente maneja `credentials: include`, CSRF header, tenant header, auto-refresh.
- **Permisos en UI.** El `Sidebar` filtra items de `primaryNavigation` según `user.permissions` (set venido de `/auth/me`).
- **Server vs Client.** Páginas `(auth)/*` y `app/app/*` que necesitan sesión son **Client Components** porque consumen `useSession()`. La landing y rutas públicas pueden ser Server Components.
- **Sin Server Actions de Next.** Todas las mutaciones van vía API NestJS. Esto es distinto a un Next.js standalone.
- **Tipos compartidos** vienen de `@atria/contracts`. NO redefinas `NavigationItem`, `PermissionKey`, etc.

---

## 7. Convenciones de código

### General
- **Español** para identificadores de dominio (`empresa`, `venta`, `usuario`), **inglés** para términos técnicos (`Session`, `Provider`, `Module`, `Service`, `Controller`, `Decorator`).
- **camelCase** TS, **PascalCase** clases/componentes/modelos Prisma, **MAYUSCULA_SNAKE** constantes.
- **Path alias `@/*`** en cada app apunta a su propia raíz (`apps/api/src/` y `apps/web/`).
- **Path alias `@atria/contracts`** apunta a `packages/contracts/src` (vía `tsconfig.base.json`).

### Backend (NestJS)
- Cada feature module: `Module + Controller + Service + DTO`. DTOs con class-validator + Swagger decorators.
- Service queries: SIEMPRE filtrar por `user.organizationId` (multi-tenant). Nunca aceptar `organizationId` del body.
- Errores: usar `BadRequestException`, `NotFoundException`, `ForbiddenException` de `@nestjs/common`.
- Logs: inyectar `StructuredLoggerService`, no `console.log`.
- Transacciones Prisma: `this.prisma.$transaction(async (tx) => {...})` para >1 escritura relacionada.

### Frontend (Next.js)
- Solo CSS variables del design system. **No** `bg-purple-600` ni paleta default de Tailwind.
- Tipografía: clases `.text-display`, `.text-2xl`, `.text-xl`, `.text-lg`, `.text-base`, `.text-small`, `.text-label`.
- Botones: `.atria-btn` + variante `atria-btn-{primary|secondary|ghost|danger}` + tamaño `atria-btn-sm|atria-btn-lg`.
- Cards: `.atria-card`.
- Íconos: Lucide React, tamaño 14-20px.
- Forms: react-hook-form + zodResolver. Errores inline en `<Input error={...}>`.

### Comentarios
- **Default: no comentarios.** Solo cuando el _por qué_ no es obvio.
- Nunca describas QUÉ hace el código.
- Nunca menciones PRs, tareas o contexto temporal.

---

## 8. Roles y permisos

Definidos en `packages/contracts/src/permissions.ts`:

```ts
roleTemplates.owner       // Todos los permisos
roleTemplates.admin       // Todo excepto cierre de período + algunos billing
roleTemplates.accountant  // Contabilidad + reportes + lectura general
roleTemplates.worker      // POS + lectura inventario/sucursales
```

Grupos de permisos: `dashboard`, `onboarding`, `pos`, `sales`, `inventory`, `accounting`, `employees`, `reports`, `settings`, `billing`, `branches`.

Cada uno con sus claves (`pos:view`, `pos:sell`, `accounting:close-period`, etc.).

Verificación:
- **Backend**: decorator `@Permissions("pos:sell")` en el controller + `PermissionsGuard` global.
- **Frontend**: filtro en `Sidebar`, y futuro `<PermisoRequerido perm="X">` para esconder UI.

---

## 9. Planes (`packages/contracts/src/plans.ts`)

| Plan | Usuarios | Sucursales | Notas |
|---|---|---|---|
| **BUSINESS** | 3 | 1 | POS + inventario básico + contabilidad esencial |
| **ENTERPRISE** | ∞ | ∞ | Multi-sucursal + API + analítica ejecutiva |

Precios y feature flags detallados están **por definir** — actualizar `plans.ts` cuando se decidan.

---

## 10. Cómo correr el proyecto

```bash
# 1. Dependencias (workspaces)
npm install

# 2. Variables de entorno
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Editar JWT_*_SECRET en apps/api/.env

# 3. Infraestructura local
docker compose up -d postgres redis

# 4. DB ready
npm run db:generate     # prisma generate
npm run db:migrate      # prisma migrate dev
npm run db:seed         # poblar org demo

# 5. Dev (concurrently corre api + web)
# Antes: editar apps/api/.env → API_ENABLED=true
npm run dev

# API:    http://localhost:4000/api/v1
# Web:    http://localhost:3000
# Swagger: http://localhost:4000/api/docs

# Solo web (sin tocar API real):
npm run dev:web          # API responde 503 → cliente lo maneja
```

---

## 11. Filosofía del producto

1. **El motor contable es sagrado.** Toda operación que toca dinero o stock genera asiento.
2. **Simplicidad operativa, potencia técnica.** El cajero no sabe que se genera partida doble. Ve "cobrar → ticket".
3. **Latinoamérica primero.** Español. Fechas DD/MM/YYYY. Monedas y formatos por país (en `apps/web/lib/utils.ts`).
4. **Offline-ready.** El POS no se cae cuando se cae la red. IndexedDB + sync diferido (skill `pos-offline-sync`).
5. **Si algo no está especificado**, elige la opción más simple que no cierre puertas. Deja `// TODO:` con el porqué.

---

## 12. Qué NO hacer

- ❌ **No** uses `Float` en Prisma para dinero — siempre `Decimal`.
- ❌ **No** uses `UPDATE`/`DELETE` en `StockMovement` o `JournalEntryLine`.
- ❌ **No** aceptes `organizationId` desde el body — siempre `user.organizationId` del JWT.
- ❌ **No** generes `JournalEntry` sin validar que las líneas cuadran (`Σ debit === Σ credit`).
- ❌ **No** uses `console.log` — usa `StructuredLoggerService` en API.
- ❌ **No** uses `fetch` directo en frontend — usa `apiClient`.
- ❌ **No** uses colores hardcodeados de Tailwind (`bg-purple-600`) — siempre CSS variables.
- ❌ **No** insertes asientos en períodos cerrados.
- ❌ **No** uses **NextAuth, Drizzle ni Server Actions** — el stack es Prisma + JWT custom + API REST.
- ❌ **No** mezcles inglés y español en strings de UI.

---

## 13. Glosario

| Término | Significado |
|---|---|
| **Organization / Tenant** | Cada cliente de Atria. `organizationId` aísla todos los datos. |
| **Membership** | Relación many-to-many entre `User` y `Organization` con un `Role`. |
| **Branch / Sucursal** | Local físico de operación; pertenece a una Organization. |
| **Warehouse / Almacén** | Bodega física; pertenece a una Branch. |
| **CxC / CxP** | Cuentas por Cobrar (`Receivable`) / por Pagar (`Payable`). |
| **Partida doble** | Por cada `JournalEntry`, suma de `debit` debe = suma de `credit`. |
| **CAI** | Código de Autorización de Impresión (HN). Vive en `secuencias_fiscales`. |
| **CSRF token** | Cookie `atria_csrf` (NO httpOnly) replicada en header `x-csrf-token` para mutaciones. |
| **Refresh rotación** | Cada `/auth/refresh` revoca el refresh viejo y emite uno nuevo. |

---

## 14. Estado actual (al cierre de esta sesión)

**Construido:**
- ✓ Monorepo workspaces npm + Node 22
- ✓ apps/api end-to-end (43 modelos Prisma, 17 módulos NestJS, seguridad enterprise)
- ✓ apps/web fundación: setup, design system, layout, auth, dashboard real, stubs de todas las rutas del navigation
- ✓ packages/contracts (navigation, permissions, plans, roleTemplates)
- ✓ docker-compose: postgres, redis, api, web, nginx
- ✓ CI GitHub Actions (build + lint)
- ✓ Cliente HTTP con cookies + CSRF + auto-refresh
- ✓ apps/web/Dockerfile multi-stage

**Por construir (priorizado):**
- ⏳ Páginas operativas reales del frontend (POS, ventas, inventario, compras, contabilidad, reportes...)
- ⏳ Migrar `CATALOGO_CUENTAS_BASE` y configuración multi-país a `packages/contracts/`
- ⏳ Actualizar `apps/api/prisma/seed.ts` para poblar plan contable LATAM por org
- ⏳ Tests unitarios (especialmente `accounting`)
- ⏳ Personalizar `apps/api/README.md` (es placeholder de NestJS)
- ⏳ POS offline con IndexedDB + sync (skill `pos-offline-sync` lista)
- ⏳ Cliente WebSocket para realtime
- ⏳ Stripe / pasarela de pago para Subscriptions

---

## 15. Cuando trabajes en algo nuevo

1. **Lee la sección relevante de este archivo primero.**
2. **Identifica si es backend, frontend, contracts o multi-app.** No mezcles.
3. **Sigue las convenciones del lado que corresponde.** Mira un módulo similar de referencia (`auth/` y `dashboard/` son buenos ejemplos en API).
4. **Si dudas entre dos enfoques**, elige el más simple sin cerrar puertas.
5. **Si encuentras inconsistencia entre código y CLAUDE.md**, alerta antes de cambiar — el archivo puede estar desactualizado.
6. **Antes de declarar terminado**: `npm run build` desde la raíz, y para web manualmente verifica en http://localhost:3000.
