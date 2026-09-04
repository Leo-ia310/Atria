CREATE TABLE IF NOT EXISTS "perfiles_fiscales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"pais" "pais" NOT NULL,
	"identificacion_fiscal" text,
	"nombre_fiscal" text,
	"regimen_fiscal" text,
	"direccion_fiscal" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"b2b_default" boolean DEFAULT true NOT NULL,
	"factura_electronica_activa" boolean DEFAULT false NOT NULL,
	"proveedor_fiscal" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perfiles_fiscales_empresa_pais_uq" UNIQUE("empresa_id","pais")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jurisdicciones_fiscales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"pais" "pais" NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" text NOT NULL,
	"padre_codigo" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jurisdicciones_fiscales_empresa_codigo_uq" UNIQUE("empresa_id","codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "codigos_producto_fiscal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"categoria" text DEFAULT 'general' NOT NULL,
	"descripcion" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codigos_producto_fiscal_empresa_codigo_uq" UNIQUE("empresa_id","codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reglas_impuesto_fiscal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"jurisdiccion_id" uuid,
	"producto_fiscal_id" uuid NOT NULL,
	"impuesto_id" uuid,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"pais" "pais" NOT NULL,
	"autoridad" text NOT NULL,
	"tasa" numeric(8, 6) NOT NULL,
	"base_imponible" text DEFAULT 'subtotal' NOT NULL,
	"aplica_desde" date NOT NULL,
	"aplica_hasta" date,
	"prioridad" integer DEFAULT 100 NOT NULL,
	"condicion" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fuente" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reglas_impuesto_fiscal_empresa_codigo_desde_uq" UNIQUE("empresa_id","codigo","aplica_desde")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "snapshots_impuesto_fiscal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"regla_id" uuid,
	"jurisdiccion_id" uuid,
	"producto_fiscal_id" uuid,
	"referencia_tabla" text NOT NULL,
	"referencia_id" uuid,
	"linea_referencia" text,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"pais" "pais" NOT NULL,
	"moneda" "moneda" NOT NULL,
	"base_imponible" numeric(18, 4) NOT NULL,
	"tasa" numeric(8, 6) NOT NULL,
	"impuesto" numeric(18, 4) NOT NULL,
	"total" numeric(18, 4) NOT NULL,
	"detalle" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fuente" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "perfiles_fiscales" ADD CONSTRAINT "perfiles_fiscales_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jurisdicciones_fiscales" ADD CONSTRAINT "jurisdicciones_fiscales_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "codigos_producto_fiscal" ADD CONSTRAINT "codigos_producto_fiscal_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reglas_impuesto_fiscal" ADD CONSTRAINT "reglas_impuesto_fiscal_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reglas_impuesto_fiscal" ADD CONSTRAINT "reglas_impuesto_fiscal_jurisdiccion_id_jurisdicciones_fiscales_id_fk" FOREIGN KEY ("jurisdiccion_id") REFERENCES "public"."jurisdicciones_fiscales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reglas_impuesto_fiscal" ADD CONSTRAINT "reglas_impuesto_fiscal_producto_fiscal_id_codigos_producto_fiscal_id_fk" FOREIGN KEY ("producto_fiscal_id") REFERENCES "public"."codigos_producto_fiscal"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reglas_impuesto_fiscal" ADD CONSTRAINT "reglas_impuesto_fiscal_impuesto_id_impuestos_id_fk" FOREIGN KEY ("impuesto_id") REFERENCES "public"."impuestos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "snapshots_impuesto_fiscal" ADD CONSTRAINT "snapshots_impuesto_fiscal_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "snapshots_impuesto_fiscal" ADD CONSTRAINT "snapshots_impuesto_fiscal_regla_id_reglas_impuesto_fiscal_id_fk" FOREIGN KEY ("regla_id") REFERENCES "public"."reglas_impuesto_fiscal"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "snapshots_impuesto_fiscal" ADD CONSTRAINT "snapshots_impuesto_fiscal_jurisdiccion_id_jurisdicciones_fiscales_id_fk" FOREIGN KEY ("jurisdiccion_id") REFERENCES "public"."jurisdicciones_fiscales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "snapshots_impuesto_fiscal" ADD CONSTRAINT "snapshots_impuesto_fiscal_producto_fiscal_id_codigos_producto_fiscal_id_fk" FOREIGN KEY ("producto_fiscal_id") REFERENCES "public"."codigos_producto_fiscal"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "perfiles_fiscales_empresa_idx" ON "perfiles_fiscales" USING btree ("empresa_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jurisdicciones_fiscales_empresa_idx" ON "jurisdicciones_fiscales" USING btree ("empresa_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jurisdicciones_fiscales_pais_idx" ON "jurisdicciones_fiscales" USING btree ("pais");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "codigos_producto_fiscal_empresa_idx" ON "codigos_producto_fiscal" USING btree ("empresa_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "codigos_producto_fiscal_categoria_idx" ON "codigos_producto_fiscal" USING btree ("categoria");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reglas_impuesto_fiscal_empresa_idx" ON "reglas_impuesto_fiscal" USING btree ("empresa_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reglas_impuesto_fiscal_pais_idx" ON "reglas_impuesto_fiscal" USING btree ("pais");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reglas_impuesto_fiscal_vigencia_idx" ON "reglas_impuesto_fiscal" USING btree ("empresa_id","activo","aplica_desde","aplica_hasta");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_impuesto_fiscal_empresa_idx" ON "snapshots_impuesto_fiscal" USING btree ("empresa_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_impuesto_fiscal_referencia_idx" ON "snapshots_impuesto_fiscal" USING btree ("referencia_tabla","referencia_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_impuesto_fiscal_fecha_idx" ON "snapshots_impuesto_fiscal" USING btree ("empresa_id","fecha");
--> statement-breakpoint
INSERT INTO "perfiles_fiscales" (
	"empresa_id",
	"pais",
	"identificacion_fiscal",
	"nombre_fiscal",
	"metadata"
)
SELECT
	"empresas"."id",
	"empresas"."pais",
	NULLIF("empresas"."identificacion_fiscal", ''),
	"empresas"."razon_social",
	'{"origen":"migration_0022","requiereRevisionFiscal":true}'::jsonb
FROM "empresas"
ON CONFLICT ("empresa_id","pais") DO NOTHING;
--> statement-breakpoint
INSERT INTO "jurisdicciones_fiscales" (
	"empresa_id",
	"pais",
	"codigo",
	"nombre",
	"tipo",
	"padre_codigo",
	"metadata"
)
SELECT
	"empresas"."id",
	"empresas"."pais",
	CASE
		WHEN "empresas"."pais" = 'US' THEN 'US-CO'
		WHEN "empresas"."pais" = 'MX' THEN 'MX-FED'
		ELSE "empresas"."pais"::text || '-NACIONAL'
	END,
	CASE
		WHEN "empresas"."pais" = 'US' THEN 'Colorado'
		WHEN "empresas"."pais" = 'MX' THEN 'Mexico federal'
		WHEN "empresas"."pais" = 'HN' THEN 'Honduras nacional'
		WHEN "empresas"."pais" = 'NI' THEN 'Nicaragua nacional'
		WHEN "empresas"."pais" = 'GT' THEN 'Guatemala nacional'
		WHEN "empresas"."pais" = 'CR' THEN 'Costa Rica nacional'
		WHEN "empresas"."pais" = 'SV' THEN 'El Salvador nacional'
		ELSE "empresas"."pais"::text || ' nacional'
	END,
	CASE
		WHEN "empresas"."pais" = 'US' THEN 'state'
		WHEN "empresas"."pais" = 'MX' THEN 'federal'
		ELSE 'national'
	END,
	CASE
		WHEN "empresas"."pais" = 'US' THEN 'US'
		WHEN "empresas"."pais" = 'MX' THEN 'MX'
		ELSE NULL
	END,
	CASE
		WHEN "empresas"."pais" = 'US' THEN '{"piloto":true,"requiereDireccionExacta":true,"requiereNexus":true,"homeRuleCities":true,"nota":"Piloto Colorado; no representa una tasa nacional de Estados Unidos."}'::jsonb
		WHEN "empresas"."pais" = 'MX' THEN '{"requiereCfdi":true,"requiereRfc":true,"requiereRegimenFiscal":true,"requiereCodigoPostalFiscal":true}'::jsonb
		ELSE '{}'::jsonb
	END
FROM "empresas"
ON CONFLICT ("empresa_id","codigo") DO NOTHING;
--> statement-breakpoint
INSERT INTO "codigos_producto_fiscal" (
	"empresa_id",
	"codigo",
	"nombre",
	"categoria",
	"descripcion"
)
SELECT
	"empresas"."id",
	"productos"."codigo",
	"productos"."nombre",
	"productos"."categoria",
	"productos"."descripcion"
FROM "empresas"
CROSS JOIN (
	VALUES
		('GENERAL_TAXABLE', 'Operacion gravada general', 'general', 'Linea gravada con el impuesto principal configurado para la empresa.'),
		('GENERAL_EXEMPT', 'Operacion exenta general', 'general', 'Linea no gravada que requiere evidencia o configuracion fiscal.'),
		('ARCA_SAAS_STANDARD', 'ARCA SaaS estandar', 'saas', 'Suscripcion SaaS estandar vendida por ARCA.'),
		('ARCA_SAAS_CUSTOM', 'ARCA software personalizado', 'saas', 'Software o implementacion personalizada sujeta a soporte documental.'),
		('ARCA_IMPLEMENTATION', 'Implementacion y consultoria', 'servicio', 'Servicios profesionales separados de la suscripcion SaaS.'),
		('RESTAURANTE_PREPARED_FOOD', 'Alimentos preparados', 'restaurante', 'Venta de alimentos o bebidas preparados por un restaurante.'),
		('RESTAURANTE_TIP_VOLUNTARY', 'Propina voluntaria', 'restaurante', 'Propina voluntaria separada de cargos obligatorios.'),
		('RESTAURANTE_SERVICE_CHARGE', 'Cargo de servicio obligatorio', 'restaurante', 'Cargo obligatorio que debe analizarse separado de la propina voluntaria.'),
		('RESTAURANTE_DELIVERY', 'Entrega o delivery', 'restaurante', 'Cargo de entrega o delivery sujeto a reglas por jurisdiccion.')
) AS "productos"("codigo","nombre","categoria","descripcion")
ON CONFLICT ("empresa_id","codigo") DO NOTHING;
--> statement-breakpoint
INSERT INTO "reglas_impuesto_fiscal" (
	"empresa_id",
	"jurisdiccion_id",
	"producto_fiscal_id",
	"impuesto_id",
	"codigo",
	"nombre",
	"pais",
	"autoridad",
	"tasa",
	"base_imponible",
	"aplica_desde",
	"condicion",
	"fuente",
	"activo"
)
SELECT
	"empresas"."id",
	"jurisdicciones_fiscales"."id",
	"codigos_producto_fiscal"."id",
	"impuestos"."id",
	"jurisdicciones_fiscales"."codigo" || ':' || "codigos_producto_fiscal"."codigo" || ':' || "impuestos"."codigo" || ':v1',
	"impuestos"."nombre" || CASE
		WHEN "codigos_producto_fiscal"."codigo" = 'ARCA_SAAS_STANDARD' THEN ' SaaS estandar'
		ELSE ' general'
	END,
	"empresas"."pais",
	"jurisdicciones_fiscales"."nombre",
	"impuestos"."tasa",
	'subtotal',
	'2026-01-01',
	CASE
		WHEN "empresas"."pais" = 'US' AND "codigos_producto_fiscal"."codigo" = 'ARCA_SAAS_STANDARD'
			THEN '{"pilotoColorado":true,"requiereDireccionExacta":true,"requiereNexus":true,"noUsarComoTasaNacional":true}'::jsonb
		ELSE '{}'::jsonb
	END,
	CASE
		WHEN "empresas"."pais" = 'US' THEN 'Colorado piloto desde reporte fiscal ARCA'
		WHEN "empresas"."pais" = 'MX' THEN 'SAT/LIVA default IVA general'
		ELSE 'CONFIG_PAIS'
	END,
	true
FROM "empresas"
JOIN LATERAL (
	SELECT "impuestos"."id", "impuestos"."codigo", "impuestos"."nombre", "impuestos"."tasa"
	FROM "impuestos"
	WHERE "impuestos"."empresa_id" = "empresas"."id"
	ORDER BY "impuestos"."activo" DESC, "impuestos"."codigo" ASC
	LIMIT 1
) "impuestos" ON true
JOIN "jurisdicciones_fiscales"
	ON "jurisdicciones_fiscales"."empresa_id" = "empresas"."id"
	AND "jurisdicciones_fiscales"."codigo" = CASE
		WHEN "empresas"."pais" = 'US' THEN 'US-CO'
		WHEN "empresas"."pais" = 'MX' THEN 'MX-FED'
		ELSE "empresas"."pais"::text || '-NACIONAL'
	END
JOIN "codigos_producto_fiscal"
	ON "codigos_producto_fiscal"."empresa_id" = "empresas"."id"
	AND "codigos_producto_fiscal"."codigo" IN ('GENERAL_TAXABLE', 'ARCA_SAAS_STANDARD')
ON CONFLICT ("empresa_id","codigo","aplica_desde") DO NOTHING;
