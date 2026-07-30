# ARCA

**Sistema operativo para el comercio.** SaaS multi-tenant que conecta el punto de venta, el inventario y la contabilidad en un solo motor — diseñado para pequeñas y medianas empresas de Latinoamérica.

> Cada venta, compra, gasto o ajuste genera automáticamente su asiento contable de partida doble. El dueño de la pulpería opera. El contador audita. El sistema cuadra.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind v4**
- **PostgreSQL 16** + **Drizzle ORM** + Row-Level Security por `empresa_id`
- **NextAuth v5** (credentials + JWT)
- **Zod** (validación cliente/servidor) + **React Hook Form**
- **TanStack Query / Table**, **Zustand**, **Recharts**, **Lucide**
- Deploy target: **Vercel + Supabase**

## Quick start

```bash
# 1. Instalar dependencias
npm install

# 2. Crear .env.local desde el ejemplo
cp .env.example .env.local
# Editar DATABASE_URL y AUTH_SECRET

# 3. Crear esquema en la base de datos
npm run db:push

# 4. Levantar el dev server
npm run dev
```

App en http://localhost:3000

## Arquitectura

```
app/
  (marketing)/   Landing pública
  (auth)/        Login + registro 3 pasos
  (app)/         Dashboard, POS, Inventario, Ventas, Compras, Contabilidad...
  (superadmin)/  Panel del dueño del SaaS
  api/           Webhooks + POS offline sync

lib/
  db/schema.ts                 Schema completo Drizzle (7 módulos)
  contabilidad/motor-asientos.ts  ⚡ Motor de partida doble (núcleo del sistema)
  actions/                     Server Actions por módulo
  pricing.ts                   Planes Demo/Pro/Enterprise + feature flags
  paises.ts                    Config por país (HN, NI, GT, CR, SV)
```

## Filosofía

1. **El motor contable es sagrado.** Toda mutación de dinero o inventario pasa por él.
2. **Simplicidad operativa, potencia técnica.** El cajero ve "venta → cobrar → ticket". El contador ve el asiento.
3. **Latinoamérica primero.** Todo en español, fechas DD/MM/YYYY, formatos numéricos por país.
4. **Offline-ready.** El POS no se cae cuando se cae la red.

## Planes

| Plan | Mensual | Anual | Sucursales | Usuarios | Contabilidad |
|------|---------|-------|------------|----------|--------------|
| **Demo** | Gratis | — | 1 | 1 | ✗ |
| **Pro** | $45.99 | $386.32 ($32.19/mes) | 1 | 5 | ✓ |
| **Enterprise** | $199.00 | $1,671.60 ($139.30/mes) | 3 (+$30/extra) | 10 (+$5/extra) | ✓ multi-sucursal |

## Estado del proyecto

Esta es la **fundación end-to-end**: setup, schema completo, auth, design system, layout, landing, onboarding. Los módulos de negocio (POS, inventario, contabilidad operativa, etc.) se construyen sobre esta base en siguientes sesiones.

## Licencia

Privado — propiedad del autor. No redistribuir.
