# ARCA — Contexto para Claude Code

> **Lee este archivo completo antes de tocar código.** Es la fuente de verdad sobre qué es ARCA, cómo está estructurado, y qué reglas son innegociables.

---

## 1. Qué es ARCA

**ARCA es un SaaS multi-tenant de gestión comercial para pequeñas y medianas empresas de Latinoamérica.** Reemplaza Excel + cuaderno de fiado + sistemas desconectados con una plataforma única que conecta el **punto de venta**, el **inventario** y la **contabilidad** en un solo motor.

**La idea central:** cada evento del negocio (venta, compra, gasto, ajuste) genera **automáticamente su asiento contable de partida doble**. El cajero ve "venta → cobrar → ticket". El contador ve el asiento en el libro diario. Nadie tiene que cuadrar nada a mano.

**Usuarios objetivo:** ferreterías, farmacias, pulperías, distribuidoras, tiendas de ropa, abarroterías — negocios reales de **Honduras, Nicaragua, Guatemala, Costa Rica y El Salvador**.

**Email del dueño del SaaS (super-admin):** `ventatormenta@gmail.com`

---

## 2. Stack técnico (obligatorio)

| Capa | Tecnología | Notas |
|---|---|---|
| Framework | **Next.js 15** (App Router) + TypeScript | Server Actions para mutaciones |
| Estilos | **Tailwind v4** (CSS variables via `@theme`) | Sin `tailwind.config.js` |
| Auth | **NextAuth v5** (Credentials + JWT) | `auth.config.ts` edge / `auth.ts` node |
| Base de datos | **PostgreSQL 16** + **Drizzle ORM** | Supabase como proveedor |
| Validación | **Zod** (compartido cliente/servidor) | |
| Formularios | **React Hook Form** + `@hookform/resolvers` | |
| Estado | Zustand (cliente) · TanStack Query (server state) | |
| Tablas | **TanStack Table v8** | |
| Gráficas | **Recharts** | |
| Íconos | **Lucide React** | |
| Fechas | **date-fns** | |
| Email | **Resend** | Notificaciones |
| Deploy | **Vercel + Supabase** | |

---

## 3. Reglas de arquitectura innegociables

1. **Multi-tenant por `empresa_id`.** Toda tabla de negocio incluye `empresa_id` con FK a `empresas`. **Nunca confíes en `empresa_id` que venga del cliente** — siempre léelo de `auth()` en el servidor.
2. **Dinero siempre en `numeric(18,4)`.** Jamás `float`/`real`.
3. **Append-only** en `movimientos_inventario` y `asiento_partidas`. Para corregir, contramovimiento o anulación + nuevo asiento. Nunca `UPDATE`/`DELETE` en estas tablas.
4. **El motor contable es sagrado.** Toda mutación de dinero o stock pasa por `lib/contabilidad/motor-asientos.ts`. Sin atajos.
5. **Asientos siempre cuadran.** `total_debe === total_haber` (tolerancia 0.0001 por redondeo). Si no cuadran, lanzar `AsientoNoBalanceadoError` antes de persistir.
6. **Server Actions** para mutaciones del usuario. **API Routes** solo para webhooks, integraciones externas y POS offline sync.
7. **RLS a nivel Postgres** por `empresa_id` (aplicar en `lib/db/policies.sql` cuando se construya).
8. **Períodos contables cerrados son intocables.** Validar que la fecha del asiento cae en un período `abierto` antes de insertar.

---

## 4. Estructura de archivos

```
arca/
├── auth.ts                       NextAuth completo (Node-only, importa db)
├── auth.config.ts                NextAuth edge-safe + type augmentations
├── middleware.ts                 Usa auth.config.ts (edge runtime)
├── drizzle.config.ts
├── next.config.ts
├── postcss.config.mjs            Tailwind v4
├── app/
│   ├── layout.tsx                Root (Inter font)
│   ├── globals.css               Design tokens en @theme + componentes utilitarios
│   ├── (marketing)/              Landing pública — / y /precios
│   ├── (auth)/                   /login, /registro (3 pasos), /recuperar
│   ├── (app)/                    Dashboard, POS, módulos de negocio (requiere auth)
│   │   ├── layout.tsx            Sidebar + Header + SessionProvider
│   │   └── dashboard/page.tsx    KPIs + bienvenida onboarding
│   ├── (superadmin)/             Panel del dueño del SaaS
│   └── api/auth/[...nextauth]/   Handler de NextAuth
├── components/
│   ├── ui/                       Button, Input, Select, Card, Badge, KpiCard
│   ├── layout/                   Sidebar, Header, PageHeader, PageStub, SessionProvider
│   └── marketing/                Nav, PricingToggle, FAQ
├── lib/
│   ├── db/
│   │   ├── schema.ts             Schema completo: 7 módulos, ~50 tablas
│   │   └── index.ts              Cliente postgres-js + drizzle
│   ├── contabilidad/
│   │   └── motor-asientos.ts     ⚡ NÚCLEO — API + stubs por implementar
│   ├── actions/
│   │   ├── registro.ts           Bootstrap de empresa (transacción atómica)
│   │   └── session-helpers.ts    requireSession() para server components
│   ├── validations/auth.ts       Zod schemas login + registro
│   ├── paises.ts                 Config por país + CATALOGO_CUENTAS_BASE + CUENTAS_CLAVE
│   ├── pricing.ts                Planes Demo/Pro/Enterprise + features + límites
│   └── utils.ts                  cn(), formatearMoneda, formatearFecha
```

---

## 5. Convenciones de código

### TypeScript
- **Estricto.** Sin `any` implícito. Si necesitas `any`, justifícalo con comentario.
- **Path alias `@/*`** mapea a la raíz del proyecto.
- **Tipos inferidos de Drizzle** (`typeof tabla.$inferSelect`) — están exportados al final de `lib/db/schema.ts`.

### Naming
- **Español para tablas, columnas, variables de dominio.** Inglés solo para términos técnicos (`Session`, `Provider`, `Schema`).
- **camelCase en TS**, **snake_case en SQL/Drizzle columns**. Drizzle hace el mapeo (ej. `empresaId` ↔ `empresa_id`).
- **Constantes**: `MAYUSCULA_SNAKE`.

### UI
- Solo CSS variables del design system (`var(--color-primary)`, etc.). **No usar paleta de Tailwind por defecto** para colores de marca.
- Tipografía: clases utilitarias `.text-display`, `.text-2xl`, `.text-xl`, `.text-lg`, `.text-base`, `.text-small`, `.text-label`.
- Componentes utilitarios pre-armados: `.arca-card`, `.arca-input`, `.arca-btn` (+ variantes `primary`/`secondary`/`ghost`/`danger`), `.arca-badge` (+ semáforo).
- Iconos: **Lucide React**, tamaño `14–20px`.

### Comentarios
- **Default: no comentarios.** Solo escribe uno cuando el _por qué_ no es obvio del código.
- Nunca describas _qué_ hace el código si los nombres lo dejan claro.
- Nunca menciones el PR, la tarea o el contexto temporal.

### Server Actions
- Sufijo del archivo: `lib/actions/<modulo>.ts`.
- Primera línea: `"use server";`.
- Validar entrada con Zod siempre.
- Leer `empresa_id` de `requireSession()` — nunca aceptarlo en argumentos.
- Devolver `{ ok: true, ... }` o `{ ok: false, error: string }`.

### Base de datos
- Insertar en transacción cuando hay >1 escritura relacionada (`db.transaction(async (tx) => {...})`).
- Toda nueva tabla: índice en `empresa_id`, FK a `empresas`, `creado_en` con `defaultNow()`.
- Para movimientos/asientos: nunca UPDATE/DELETE.

---

## 6. Planes y feature flags

| Plan | Mensual | Anual mensualizado | Sucursales | Usuarios | Contabilidad |
|---|---|---|---|---|---|
| **Demo** | Gratis | — | 1 | 1 | ✗ |
| **Pro** | $45.99 | $32.19 | 1 | 5 (+$5/extra) | ✓ |
| **Enterprise** | $199.00 | $139.30 | 3 (+$30/extra) | 10 (+$5/extra) | ✓ multi-sucursal |

Limites Demo: 10 productos, 50 transacciones/mes, 10 clientes, 5 facturas/mes.

Las features están tipadas en `PlanFeatures` (`lib/pricing.ts`). Para gatear UI/lógica:
```ts
import { PLANES, puedeUsar, dentroDeLimite } from "@/lib/pricing";
```
Cuando se construya el dashboard de gating, usar componente `<UpgradeBanner>` (por construir) no `alert()` ni redirects bruscos.

---

## 7. Multi-país

Cada empresa elige país al onboarding (default: **NI** Nicaragua). Esto fija moneda, impuesto y formato de identificación fiscal. Config en `lib/paises.ts`:

| País | Código | Moneda | Símbolo | Impuesto | ID Fiscal |
|---|---|---|---|---|---|
| Honduras | HN | HNL | L | ISV 15% | RTN |
| Nicaragua | NI | NIO | C$ | IVA 15% | RUC |
| Guatemala | GT | GTQ | Q | IVA 12% | NIT |
| Costa Rica | CR | CRC | ₡ | IVA 13% | Cédula Jurídica |
| El Salvador | SV | USD | $ | IVA 13% | NIT |

Helpers: `getPaisConfig(codigo)`, `formatearMoneda(monto, pais)`, `formatearFecha(date, pais)`.

---

## 8. Catálogo de cuentas base + CUENTAS_CLAVE

Al registrar una empresa, se instala automáticamente un catálogo de ~40 cuentas (estructura latinoamericana clásica) definido en `CATALOGO_CUENTAS_BASE`. El motor contable referencia cuentas por su **clave canónica** en `CUENTAS_CLAVE`:

```
CAJA: "1101"        BANCO: "1103"        CXC_CLIENTES: "1104"
INVENTARIO: "1105"  IVA_CREDITO: "1106"  CXP_PROVEEDORES: "2101"
IVA_DEBITO: "2102"  VENTAS: "4101"       COSTO_VENTAS: "5101"
...
```

**Si una empresa renombra/recodifica una cuenta**, el motor debe seguir funcionando consultando el mapeo en `configuraciones` (clave `cuentas_clave`). Nunca hardcodes un código de cuenta en código de negocio.

---

## 9. Asientos automáticos — el motor

Cada evento de negocio llama a una función en `lib/contabilidad/motor-asientos.ts`. Patrón:

```
Venta (contado/crédito):
  DEBE   Caja|Banco|CxC           total
  HABER  Ventas                   subtotal
  HABER  IVA por Pagar            impuesto
+ Costo:
  DEBE   Costo de Ventas          costoTotal
  HABER  Inventario               costoTotal

Compra:
  DEBE   Inventario               subtotal
  DEBE   IVA Acreditable          impuesto
  HABER  Caja|Banco|CxP           total

Pago a proveedor:
  DEBE   CxP Proveedores          monto
  HABER  Caja|Banco               monto

Abono de cliente:
  DEBE   Caja|Banco               monto
  HABER  CxC Clientes             monto

Gasto:
  DEBE   Cuenta de Gasto          subtotal
  DEBE   IVA Acreditable          impuesto
  HABER  Caja|Banco               total
```

**Libro Mayor, Balance de Comprobación, Estado de Resultados y Balance General son queries/vistas SQL** sobre `asiento_partidas` — NO tablas separadas. No persistas estos saldos.

---

## 10. Roles y permisos base

Al onboarding se crean 6 roles y 17 permisos:

| Permiso | Admin | Gerente | Cajero | Contador | Vendedor | Auditor |
|---|---|---|---|---|---|---|
| `ventas.crear` | ✓ | ✓ | ✓ | | ✓ | |
| `ventas.anular` | ✓ | ✓ | | | | |
| `ventas.descuento_supervisor` | ✓ | ✓ | | | | |
| `inventario.ajustar` | ✓ | ✓ | | | | |
| `contabilidad.ver` | ✓ | | | ✓ | | ✓ |
| `contabilidad.asiento_manual` | ✓ | | | ✓ | | |
| `contabilidad.cerrar_periodo` | ✓ | | | ✓ | | |
| `configuracion.usuarios` | ✓ | | | | | |
| `auditoria.ver` | ✓ | | | | | ✓ |
| ... | | | | | | |

Tabla completa en `lib/actions/registro.ts`. Permisos verificados en middleware + en cada Server Action.

---

## 11. Cómo correr el proyecto

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env.local
# Editar DATABASE_URL (Supabase) y AUTH_SECRET (openssl rand -base64 32)

# 3. Esquema en DB
npm run db:push

# 4. Dev
npm run dev          # http://localhost:3000

# Otros
npm run db:studio    # GUI para inspeccionar la DB
npm run typecheck    # tsc --noEmit
npm run db:generate  # crear migración a partir del schema
```

---

## 12. Filosofía del producto

1. **El motor contable es sagrado.** Si una operación toca dinero o stock y no genera asiento, está mal.
2. **Simplicidad operativa, potencia técnica.** El cajero no sabe que detrás se genera partida doble. Ve "cobrar → ticket".
3. **Latinoamérica primero.** Todo en español. Fechas DD/MM/YYYY. Formatos numéricos por país. Palabras que usa el dueño de una ferretería en Tegucigalpa, no las de un MBA.
4. **Offline-ready.** El internet falla. El POS no. (IndexedDB + sync diferido cuando se construya.)
5. **Si algo no está especificado, elige la opción más simple que no cierre puertas**. Deja un `// TODO:` con el razonamiento.

---

## 13. Qué NO hacer

- ❌ **No** uses `float` para dinero.
- ❌ **No** uses `UPDATE`/`DELETE` en `movimientos_inventario` o `asiento_partidas`.
- ❌ **No** aceptes `empresa_id` desde el cliente.
- ❌ **No** generes asientos sin validar con `validarBalance()` primero.
- ❌ **No** hardcodes códigos de cuenta (`"1101"`, etc.) en lógica de negocio — usa `CUENTAS_CLAVE`.
- ❌ **No** uses colores hardcodeados de Tailwind (`bg-purple-600`) — siempre `var(--color-primary)`, etc.
- ❌ **No** dejes que un asiento se inserte sin verificar que el `periodo_contable` esté `abierto`.
- ❌ **No** crees tablas sin `empresa_id` (excepto las globales: `planes`, `permisos`).
- ❌ **No** uses `shadcn/ui` ni `MUI` — diseño custom basado en el design system de `globals.css`.
- ❌ **No** uses Excalidraw, mermaid u otro tipo de diagramas en archivos markdown salvo que se pida explícitamente.
- ❌ **No** mezcles inglés y español en strings de UI.

---

## 14. Glosario

| Término | Significado |
|---|---|
| **Tenant / Empresa** | Cada cliente de ARCA. Un tenant = una `empresas` row + todos sus datos aislados. |
| **CAI** | Código de Autorización de Impresión (Honduras). Va en `secuencias_fiscales.autorizacion`. |
| **CxC / CxP** | Cuentas por Cobrar / por Pagar. |
| **Partida doble** | Por cada asiento, lo que entra a una cuenta sale de otra (Debe = Haber). |
| **Kardex** | Histórico de movimientos de un producto. Se reconstruye desde `movimientos_inventario`. |
| **Sesión de caja** | Apertura del cajero con monto inicial; al cierre se hace arqueo (esperado vs real). |
| **Fiado / Crédito** | Venta a pagar después. Genera `cuentas_por_cobrar`. |
| **ISV / IVA** | Impuesto al valor agregado, según país. |

---

## 15. Estado actual

**Construido** (fundación end-to-end):
- ✓ Setup completo del proyecto (Next.js 15, Drizzle, NextAuth v5, Tailwind v4)
- ✓ Schema PostgreSQL completo (7 módulos, ~50 tablas)
- ✓ Auth funcional (login + registro 3 pasos con bootstrap automático)
- ✓ Design system + componentes UI base
- ✓ Layout del app (sidebar + header) + dashboard inicial
- ✓ Landing page completa (hero, features, pricing, FAQ, CTA)
- ✓ Motor contable: API definida + `validarBalance` + stubs documentados
- ✓ Super-admin scaffolded

**Por construir** (módulos de negocio):
- ⏳ POS funcional (online y offline con IndexedDB)
- ⏳ Implementación de `motor-asientos.ts` (6 funciones)
- ⏳ CRUD de Inventario · Ventas · Compras · Clientes · Proveedores
- ⏳ Libro diario, mayor, balance, estados financieros
- ⏳ Tesorería + gastos
- ⏳ Reportes con Recharts
- ⏳ Configuración (sucursales/usuarios/roles/cajas/impuestos/facturación fiscal)
- ⏳ Super-admin con impersonación
- ⏳ Webhooks de Stripe para facturación del SaaS

---

## 16. Cuando trabajes en algo nuevo

1. **Lee la sección relevante de este archivo primero.**
2. **Sigue las convenciones del proyecto.** Mira archivos similares (`lib/actions/registro.ts` es buen ejemplo de Server Action).
3. **Si dudas entre dos enfoques**, elige el más simple que no cierre puertas.
4. **Si encuentras una inconsistencia entre el código y este archivo**, alerta antes de cambiar nada — puede que el archivo esté desactualizado.
5. **Antes de declarar terminada una tarea**, corre `npm run typecheck` y `npm run build` si tocaste código compilado.
