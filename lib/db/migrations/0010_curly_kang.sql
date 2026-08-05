CREATE TYPE "public"."pago_suscripcion_estado" AS ENUM('creado', 'completado', 'fallido', 'reembolsado');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pagos_suscripcion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"suscripcion_id" uuid,
	"numero_recibo" text NOT NULL,
	"proveedor" text DEFAULT 'paypal' NOT NULL,
	"orden_id" text NOT NULL,
	"captura_id" text,
	"plan_codigo" "plan_tipo" NOT NULL,
	"ciclo" "ciclo_facturacion" NOT NULL,
	"monto" numeric(18, 4) NOT NULL,
	"moneda" text DEFAULT 'USD' NOT NULL,
	"estado" "pago_suscripcion_estado" DEFAULT 'creado' NOT NULL,
	"pagador_email" text,
	"pagador_nombre" text,
	"recibo_enviado_a" text,
	"recibo_enviado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"completado_en" timestamp with time zone,
	CONSTRAINT "pagos_suscripcion_orden_uq" UNIQUE("orden_id"),
	CONSTRAINT "pagos_suscripcion_recibo_uq" UNIQUE("numero_recibo")
);
--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "codigo_referido" text;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "referido_capturado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "terminos_version" text;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "terminos_aceptados_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "suscripciones" ADD COLUMN IF NOT EXISTS "codigo_referido" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pagos_suscripcion" ADD CONSTRAINT "pagos_suscripcion_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pagos_suscripcion" ADD CONSTRAINT "pagos_suscripcion_suscripcion_id_suscripciones_id_fk" FOREIGN KEY ("suscripcion_id") REFERENCES "public"."suscripciones"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pagos_suscripcion_empresa_idx" ON "pagos_suscripcion" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pagos_suscripcion_estado_idx" ON "pagos_suscripcion" USING btree ("estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "empresas_codigo_referido_idx" ON "empresas" USING btree ("codigo_referido");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suscripciones_codigo_referido_idx" ON "suscripciones" USING btree ("codigo_referido");