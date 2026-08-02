CREATE TABLE IF NOT EXISTS "gastos_recurrentes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"categoria_id" uuid NOT NULL,
	"cuenta_financiera_id" uuid NOT NULL,
	"descripcion" text NOT NULL,
	"referencia" text,
	"subtotal" numeric(18, 4) NOT NULL,
	"impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"dia_mes" integer NOT NULL,
	"proxima_fecha" date NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"ultimo_generado_en" timestamp with time zone,
	"usuario_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "recurrente_id" uuid;--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "periodo_recurrente" date;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_categoria_id_categorias_gasto_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_gasto"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_cuenta_financiera_id_cuentas_financieras_id_fk" FOREIGN KEY ("cuenta_financiera_id") REFERENCES "public"."cuentas_financieras"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gastos_recurrentes_empresa_idx" ON "gastos_recurrentes" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gastos_recurrentes_proxima_idx" ON "gastos_recurrentes" USING btree ("activa","proxima_fecha");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gastos" ADD CONSTRAINT "gastos_recurrente_id_gastos_recurrentes_id_fk" FOREIGN KEY ("recurrente_id") REFERENCES "public"."gastos_recurrentes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_recurrente_periodo_uq" UNIQUE("recurrente_id","periodo_recurrente");