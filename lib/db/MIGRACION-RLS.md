# Progreso de migración a dbConEmpresa / dbSuperAdmin

Objetivo: envolver toda consulta `db.*` en `dbConEmpresa(empresaId, tx => ...)`
(o `dbSuperAdmin(tx => ...)` para lo pre-sesión/cross-tenant) para poder activar
RLS (`npm run db:rls -- --confirm`) sin que la app vea 0 filas.

Regla: el `where(eq(x.empresaId, ...))` se mantiene (primera línea de defensa).

## Clasificación
- **dbSuperAdmin** (bypass, sin sesión o cross-tenant): auth.ts, recuperacion.ts,
  registro.ts, crons (expiracion, gastos-recurrentes), superadmin/*, y el lookup
  inicial por slug de menu-publico.
- **dbConEmpresa(user.empresaId)**: todo lo demás (acciones + páginas + helpers).

## Acciones (lib/actions)
- [x] clientes.ts
- [x] proveedores.ts
- [x] periodos.ts
- [x] caja.ts
- [x] cxc.ts
- [x] cxp.ts
- [x] productos.ts
- [x] tesoreria.ts
- [x] compras.ts
- [x] ventas.ts
- [ ] configuracion.ts
- [ ] restaurante.ts
- [ ] rrhh.ts
- [x] planes.ts (mixto: planes global + suscripciones tenant)
- [ ] pagos.ts (mixto)
- [ ] menu-publico.ts (mixto: slug lookup super + writes tenant)
- [x] recuperacion.ts (SUPER)
- [x] registro.ts (SUPER)

## Auth / acceso
- [x] auth.ts (SUPER — login pre-sesión)
- [ ] lib/server-access.ts (dbConEmpresa)
- [ ] lib/tenant-data.ts (dbConEmpresa)
- [ ] lib/layout-notifications.ts (dbConEmpresa)
- [ ] lib/sucursal-scope.ts (dbConEmpresa)
- [ ] lib/suscripciones/core.ts (usa tx recibido; revisar callers)
- [ ] lib/suscripciones/expiracion.ts (SUPER — cron)
- [ ] lib/tesoreria/gastos-recurrentes.ts (SUPER — cron)
- [ ] lib/contabilidad/queries.ts (dbConEmpresa)
- [x] lib/contabilidad/motor-asientos.ts
- [x] lib/contabilidad/helpers.ts (solo tipos; sin cambios)

## Páginas (app) — ~70 archivos, lectura
Pendiente de listar por módulo a medida que se migran.

## Al terminar
1. `npm run build` verde.
2. Probar en dev/staging: `npm run db:rls -- --confirm`.
3. Verificar login + dashboard + un módulo con datos.
