ALTER TABLE "asientos_contables" ADD COLUMN IF NOT EXISTS "sucursal_id" uuid REFERENCES "sucursales"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "gastos_recurrentes" ADD COLUMN IF NOT EXISTS "sucursal_id" uuid REFERENCES "sucursales"("id") ON DELETE SET NULL;--> statement-breakpoint

UPDATE "gastos" g
SET "sucursal_id" = cf."sucursal_id"
FROM "cuentas_financieras" cf
WHERE g."cuenta_financiera_id" = cf."id"
  AND g."empresa_id" = cf."empresa_id"
  AND g."sucursal_id" IS NULL
  AND cf."sucursal_id" IS NOT NULL;--> statement-breakpoint

UPDATE "gastos_recurrentes" gr
SET "sucursal_id" = cf."sucursal_id"
FROM "cuentas_financieras" cf
WHERE gr."cuenta_financiera_id" = cf."id"
  AND gr."empresa_id" = cf."empresa_id"
  AND gr."sucursal_id" IS NULL
  AND cf."sucursal_id" IS NOT NULL;--> statement-breakpoint

WITH recurrentes_con_sucursal AS (
  SELECT
    g."recurrente_id",
    MIN(g."sucursal_id"::text)::uuid AS "sucursal_id"
  FROM "gastos" g
  WHERE g."recurrente_id" IS NOT NULL
    AND g."sucursal_id" IS NOT NULL
  GROUP BY g."recurrente_id"
  HAVING COUNT(DISTINCT g."sucursal_id") = 1
)
UPDATE "gastos_recurrentes" gr
SET "sucursal_id" = rcs."sucursal_id"
FROM recurrentes_con_sucursal rcs
WHERE gr."id" = rcs."recurrente_id"
  AND gr."sucursal_id" IS NULL;--> statement-breakpoint

UPDATE "asientos_contables" a
SET "sucursal_id" = v."sucursal_id"
FROM "ventas" v
WHERE a."referencia_tabla" = 'ventas'
  AND a."referencia_id" = v."id"
  AND a."empresa_id" = v."empresa_id"
  AND a."sucursal_id" IS NULL;--> statement-breakpoint

UPDATE "asientos_contables" a
SET "sucursal_id" = c."sucursal_id"
FROM "compras" c
WHERE a."referencia_tabla" = 'compras'
  AND a."referencia_id" = c."id"
  AND a."empresa_id" = c."empresa_id"
  AND a."sucursal_id" IS NULL;--> statement-breakpoint

UPDATE "asientos_contables" a
SET "sucursal_id" = g."sucursal_id"
FROM "gastos" g
WHERE a."referencia_tabla" = 'gastos'
  AND a."referencia_id" = g."id"
  AND a."empresa_id" = g."empresa_id"
  AND a."sucursal_id" IS NULL
  AND g."sucursal_id" IS NOT NULL;--> statement-breakpoint

UPDATE "asientos_contables" a
SET "sucursal_id" = v."sucursal_id"
FROM "abonos_cliente" ac
INNER JOIN "cuentas_por_cobrar" cxc ON cxc."id" = ac."cxc_id"
INNER JOIN "ventas" v ON v."id" = cxc."venta_id"
WHERE a."referencia_tabla" = 'abonos_cliente'
  AND a."referencia_id" = ac."id"
  AND a."empresa_id" = ac."empresa_id"
  AND a."sucursal_id" IS NULL;--> statement-breakpoint

UPDATE "asientos_contables" a
SET "sucursal_id" = c."sucursal_id"
FROM "pagos_proveedor" pp
INNER JOIN "cuentas_por_pagar" cxp ON cxp."id" = pp."cxp_id"
INNER JOIN "compras" c ON c."id" = cxp."compra_id"
WHERE a."referencia_tabla" = 'pagos_proveedor'
  AND a."referencia_id" = pp."id"
  AND a."empresa_id" = pp."empresa_id"
  AND a."sucursal_id" IS NULL;--> statement-breakpoint

UPDATE "asientos_contables" a
SET "sucursal_id" = al."sucursal_id"
FROM "movimientos_inventario" mi
INNER JOIN "almacenes" al ON al."id" = mi."almacen_id"
WHERE a."referencia_tabla" = 'movimientos_inventario'
  AND a."referencia_id" = mi."id"
  AND a."empresa_id" = mi."empresa_id"
  AND a."sucursal_id" IS NULL
  AND al."sucursal_id" IS NOT NULL;--> statement-breakpoint

WITH nominas_con_sucursal AS (
  SELECT
    nd."nomina_id",
    MIN(e."sucursal_id"::text)::uuid AS "sucursal_id"
  FROM "nomina_detalles" nd
  INNER JOIN "empleados" e ON e."id" = nd."empleado_id"
  WHERE e."sucursal_id" IS NOT NULL
  GROUP BY nd."nomina_id"
  HAVING COUNT(DISTINCT e."sucursal_id") = 1
)
UPDATE "asientos_contables" a
SET "sucursal_id" = ncs."sucursal_id"
FROM nominas_con_sucursal ncs
WHERE a."referencia_tabla" = 'nominas'
  AND a."referencia_id" = ncs."nomina_id"
  AND a."sucursal_id" IS NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "asientos_empresa_sucursal_fecha_idx" ON "asientos_contables" ("empresa_id","sucursal_id","fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asientos_empresa_sucursal_estado_fecha_idx" ON "asientos_contables" ("empresa_id","sucursal_id","estado","fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gastos_recurrentes_sucursal_idx" ON "gastos_recurrentes" ("sucursal_id");
