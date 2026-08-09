CREATE TABLE IF NOT EXISTS "referidos_atribuciones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "codigo_referido" text NOT NULL,
  "primer_pago_id" uuid,
  "origen" text DEFAULT 'pago_paypal' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "fijado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "referidos_atribuciones_empresa_fk"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE cascade,
  CONSTRAINT "referidos_atribuciones_primer_pago_fk"
    FOREIGN KEY ("primer_pago_id") REFERENCES "pagos_suscripcion"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referidos_atribuciones_empresa_uq"
  ON "referidos_atribuciones" ("empresa_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referidos_atribuciones_codigo_idx"
  ON "referidos_atribuciones" ("codigo_referido");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referidos_pagos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "pago_suscripcion_id" uuid NOT NULL,
  "codigo_referido" text NOT NULL,
  "plan_codigo" "plan_tipo" NOT NULL,
  "ciclo" "ciclo_facturacion" NOT NULL,
  "monto" numeric(18, 4) NOT NULL,
  "tipo_comision" text NOT NULL,
  "referencia_externa" text NOT NULL,
  "estado_notificacion" text DEFAULT 'pendiente' NOT NULL,
  "notificado_en" timestamp with time zone,
  "error_notificacion" text,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "referidos_pagos_empresa_fk"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE cascade,
  CONSTRAINT "referidos_pagos_pago_fk"
    FOREIGN KEY ("pago_suscripcion_id") REFERENCES "pagos_suscripcion"("id") ON DELETE cascade,
  CONSTRAINT "referidos_pagos_tipo_comision_check"
    CHECK ("tipo_comision" IN ('primera', 'renovacion')),
  CONSTRAINT "referidos_pagos_estado_notificacion_check"
    CHECK ("estado_notificacion" IN ('pendiente', 'enviado', 'fallido'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referidos_pagos_pago_uq"
  ON "referidos_pagos" ("pago_suscripcion_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referidos_pagos_referencia_uq"
  ON "referidos_pagos" ("referencia_externa");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referidos_pagos_empresa_idx"
  ON "referidos_pagos" ("empresa_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referidos_pagos_codigo_idx"
  ON "referidos_pagos" ("codigo_referido");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referidos_pagos_plan_idx"
  ON "referidos_pagos" ("empresa_id", "plan_codigo");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referidos_pagos_estado_notificacion_idx"
  ON "referidos_pagos" ("estado_notificacion");
--> statement-breakpoint
WITH primer_pago AS (
  SELECT DISTINCT ON (p.empresa_id)
    p.empresa_id,
    p.id,
    COALESCE(p.completado_en, p.creado_en, now()) AS fecha
  FROM pagos_suscripcion p
  WHERE p.estado = 'completado'
    AND p.plan_codigo IN ('pro', 'enterprise')
  ORDER BY p.empresa_id, COALESCE(p.completado_en, p.creado_en, now()) ASC, p.creado_en ASC, p.id ASC
)
INSERT INTO referidos_atribuciones (
  empresa_id,
  codigo_referido,
  primer_pago_id,
  origen,
  metadata,
  fijado_en,
  actualizado_en
)
SELECT
  e.id,
  UPPER(regexp_replace(trim(e.codigo_referido), '[^A-Za-z0-9_-]', '', 'g')),
  pp.id,
  'migration_backfill',
  jsonb_build_object('source', 'empresas.codigo_referido'),
  COALESCE(pp.fecha, now()),
  now()
FROM empresas e
LEFT JOIN primer_pago pp ON pp.empresa_id = e.id
WHERE e.codigo_referido IS NOT NULL
  AND trim(e.codigo_referido) <> ''
  AND UPPER(regexp_replace(trim(e.codigo_referido), '[^A-Za-z0-9_-]', '', 'g')) <> ''
ON CONFLICT (empresa_id) DO NOTHING;
--> statement-breakpoint
WITH pagos_base AS (
  SELECT
    p.id AS pago_id,
    p.empresa_id,
    p.plan_codigo,
    p.ciclo,
    p.monto,
    COALESCE(p.completado_en, p.creado_en, now()) AS fecha,
    p.creado_en,
    COALESCE(
      ra.codigo_referido,
      UPPER(regexp_replace(trim(e.codigo_referido), '[^A-Za-z0-9_-]', '', 'g'))
    ) AS codigo_referido,
    row_number() OVER (
      PARTITION BY p.empresa_id, p.plan_codigo
      ORDER BY COALESCE(p.completado_en, p.creado_en, now()) ASC, p.creado_en ASC, p.id ASC
    ) AS numero_pago_plan
  FROM pagos_suscripcion p
  JOIN empresas e ON e.id = p.empresa_id
  LEFT JOIN referidos_atribuciones ra ON ra.empresa_id = p.empresa_id
  WHERE p.estado = 'completado'
    AND p.plan_codigo IN ('pro', 'enterprise')
),
pagos_ref AS (
  SELECT
    *,
    concat(
      'plan:',
      empresa_id::text,
      ':',
      plan_codigo::text,
      ':',
      ciclo::text,
      ':',
      to_char(fecha, 'YYYY-MM-DD')
    ) AS referencia_legacy,
    row_number() OVER (
      PARTITION BY empresa_id, plan_codigo, ciclo, fecha::date
      ORDER BY fecha ASC, creado_en ASC, pago_id ASC
    ) AS numero_referencia
  FROM pagos_base
  WHERE codigo_referido IS NOT NULL
    AND trim(codigo_referido) <> ''
)
INSERT INTO referidos_pagos (
  empresa_id,
  pago_suscripcion_id,
  codigo_referido,
  plan_codigo,
  ciclo,
  monto,
  tipo_comision,
  referencia_externa,
  estado_notificacion,
  creado_en,
  actualizado_en
)
SELECT
  empresa_id,
  pago_id,
  codigo_referido,
  plan_codigo,
  ciclo,
  monto,
  CASE WHEN numero_pago_plan = 1 THEN 'primera' ELSE 'renovacion' END,
  CASE
    WHEN numero_referencia = 1 THEN referencia_legacy
    ELSE concat(referencia_legacy, ':pago:', pago_id::text)
  END,
  'pendiente',
  fecha,
  now()
FROM pagos_ref
ON CONFLICT (pago_suscripcion_id) DO NOTHING;
