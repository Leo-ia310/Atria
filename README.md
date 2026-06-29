# Atria

Atria es una plataforma SaaS multi-tenant para ERP, POS, inventario, contabilidad, empleados, reportes y facturacion. El repositorio esta organizado como monorepo con Next.js para la experiencia operativa y NestJS para la API segura y modular.

## Estructura

- `apps/web`: aplicacion Next.js con App Router, TailwindCSS, Shadcn/UI, TanStack Query y flujos en espanol.
- `apps/api`: API NestJS con Prisma, PostgreSQL, Redis, BullMQ, WebSockets y seguridad multi-tenant.
- `packages/contracts`: contratos y tipados compartidos para permisos, navegacion y planes.
- `nginx`: reverse proxy local y base para despliegue productivo.

## Arquitectura actual

- `apps/web` separa `domain`, `application` e `infrastructure` para desacoplar la UI de los detalles de transporte.
- En desarrollo, el frontend usa un repositorio local por defecto y evita llamadas HTTP reales.
- `apps/api` queda deshabilitada por defecto en desarrollo y responde `503` hasta activar `API_ENABLED=true`.

## Inicio rapido

1. Copia `apps/api/.env.example` y `apps/web/.env.example` si necesitas personalizar variables.
2. Si solo trabajaras frontend, deja `NEXT_PUBLIC_API_ENABLED=false` y `API_ENABLED=false`.
3. Si necesitas backend real, activa ambas variables en `true` y luego prepara infraestructura.
4. Instala dependencias con `npm install`.
5. Levanta infraestructura con `docker compose up -d postgres redis`.
6. Genera Prisma con `npm run db:generate`.
7. Ejecuta migraciones con `npm run db:migrate`.
8. Carga datos base con `npm run db:seed`.
9. Inicia todo con `npm run dev`.

## Seguridad aplicada

- JWT de acceso y refresh con rotacion.
- Cookies `httpOnly`, sesiones por dispositivo y revocacion.
- Aislamiento por tenant y RBAC granular.
- Helmet, rate limiting, validacion global, filtros de excepcion y auditoria.
- Subida de archivos con validacion de MIME, tamano y pipeline de escaneo.
- Logs estructurados y configuracion validada por entorno.
