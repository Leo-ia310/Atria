CREATE TABLE IF NOT EXISTS "nomina_colillas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nomina_id" uuid NOT NULL,
	"nomina_detalle_id" uuid NOT NULL,
	"empleado_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"generado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nomina_colillas_detalle_uq" UNIQUE("nomina_detalle_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nomina_deducciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nomina_detalle_id" uuid NOT NULL,
	"tipo_deduccion_id" uuid NOT NULL,
	"monto" numeric(18, 4) NOT NULL,
	"semana" text DEFAULT 'periodo' NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nomina_ingresos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nomina_detalle_id" uuid NOT NULL,
	"tipo_ingreso_id" uuid NOT NULL,
	"monto" numeric(18, 4) NOT NULL,
	"semana" text DEFAULT 'periodo' NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "producto_advertencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"fila_excel" integer,
	"campo" text NOT NULL,
	"mensaje" text NOT NULL,
	"valor_original" text,
	"resuelta" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tipos_deduccion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tipos_deduccion_empresa_nombre_uq" UNIQUE("empresa_id","nombre")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tipos_ingreso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tipos_ingreso_empresa_nombre_uq" UNIQUE("empresa_id","nombre")
);
--> statement-breakpoint
ALTER TABLE "empleados" ADD COLUMN IF NOT EXISTS "ciudad" text;--> statement-breakpoint
ALTER TABLE "empleados" ADD COLUMN IF NOT EXISTS "municipio" text;--> statement-breakpoint
ALTER TABLE "empleados" ADD COLUMN IF NOT EXISTS "estado_civil" text;--> statement-breakpoint
ALTER TABLE "empleados" ADD COLUMN IF NOT EXISTS "nacionalidad" text;--> statement-breakpoint
ALTER TABLE "empleados" ADD COLUMN IF NOT EXISTS "profesion_oficio" text;--> statement-breakpoint
ALTER TABLE "empleados" ADD COLUMN IF NOT EXISTS "dependientes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "nomina_deducciones" ADD COLUMN IF NOT EXISTS "semana" text DEFAULT 'periodo' NOT NULL;--> statement-breakpoint
ALTER TABLE "nomina_detalles" ADD COLUMN IF NOT EXISTS "estado_pago" text DEFAULT 'pendiente' NOT NULL;--> statement-breakpoint
ALTER TABLE "nomina_detalles" ADD COLUMN IF NOT EXISTS "pagado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nominas" ADD COLUMN IF NOT EXISTS "nivel_verificacion" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nomina_colillas" ADD CONSTRAINT "nomina_colillas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nomina_colillas" ADD CONSTRAINT "nomina_colillas_nomina_id_nominas_id_fk" FOREIGN KEY ("nomina_id") REFERENCES "public"."nominas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nomina_colillas" ADD CONSTRAINT "nomina_colillas_nomina_detalle_id_nomina_detalles_id_fk" FOREIGN KEY ("nomina_detalle_id") REFERENCES "public"."nomina_detalles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nomina_colillas" ADD CONSTRAINT "nomina_colillas_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nomina_deducciones" ADD CONSTRAINT "nomina_deducciones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nomina_deducciones" ADD CONSTRAINT "nomina_deducciones_nomina_detalle_id_nomina_detalles_id_fk" FOREIGN KEY ("nomina_detalle_id") REFERENCES "public"."nomina_detalles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nomina_deducciones" ADD CONSTRAINT "nomina_deducciones_tipo_deduccion_id_tipos_deduccion_id_fk" FOREIGN KEY ("tipo_deduccion_id") REFERENCES "public"."tipos_deduccion"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nomina_ingresos" ADD CONSTRAINT "nomina_ingresos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nomina_ingresos" ADD CONSTRAINT "nomina_ingresos_nomina_detalle_id_nomina_detalles_id_fk" FOREIGN KEY ("nomina_detalle_id") REFERENCES "public"."nomina_detalles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nomina_ingresos" ADD CONSTRAINT "nomina_ingresos_tipo_ingreso_id_tipos_ingreso_id_fk" FOREIGN KEY ("tipo_ingreso_id") REFERENCES "public"."tipos_ingreso"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "producto_advertencias" ADD CONSTRAINT "producto_advertencias_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "producto_advertencias" ADD CONSTRAINT "producto_advertencias_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tipos_deduccion" ADD CONSTRAINT "tipos_deduccion_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tipos_ingreso" ADD CONSTRAINT "tipos_ingreso_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nomina_colillas_nomina_idx" ON "nomina_colillas" USING btree ("nomina_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nomina_colillas_empleado_idx" ON "nomina_colillas" USING btree ("empleado_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nomina_deducciones_detalle_idx" ON "nomina_deducciones" USING btree ("nomina_detalle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nomina_deducciones_empresa_idx" ON "nomina_deducciones" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nomina_ingresos_detalle_idx" ON "nomina_ingresos" USING btree ("nomina_detalle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nomina_ingresos_empresa_idx" ON "nomina_ingresos" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "producto_advertencias_empresa_resuelta_idx" ON "producto_advertencias" USING btree ("empresa_id","resuelta");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "producto_advertencias_producto_idx" ON "producto_advertencias" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tipos_deduccion_empresa_idx" ON "tipos_deduccion" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tipos_ingreso_empresa_idx" ON "tipos_ingreso" USING btree ("empresa_id");
