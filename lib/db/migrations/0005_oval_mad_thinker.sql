CREATE TYPE "public"."empresa_tipo" AS ENUM('general', 'restaurante', 'retail', 'servicios');--> statement-breakpoint
CREATE TYPE "public"."menu_virtual_plantilla" AS ENUM('bistro', 'minimal', 'fiesta');--> statement-breakpoint
CREATE TYPE "public"."pedido_cocina_estado" AS ENUM('nuevo', 'en_preparacion', 'listo', 'entregado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."promocion_menu_tipo" AS ENUM('porcentaje', 'monto', 'precio_fijo');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "menu_platillos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"menu_id" uuid NOT NULL,
	"seccion_id" uuid,
	"producto_id" uuid,
	"nombre" text NOT NULL,
	"descripcion" text,
	"precio" numeric(18, 4) NOT NULL,
	"precio_oferta" numeric(18, 4),
	"etiqueta_oferta" text,
	"imagen_url" text,
	"destacado" boolean DEFAULT false NOT NULL,
	"disponible" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "menu_promociones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"menu_id" uuid NOT NULL,
	"platillo_id" uuid,
	"nombre" text NOT NULL,
	"descripcion" text,
	"tipo" "promocion_menu_tipo" DEFAULT 'porcentaje' NOT NULL,
	"valor" numeric(18, 4) NOT NULL,
	"dias_semana" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"fecha_inicio" date,
	"fecha_fin" date,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "menu_secciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"menu_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"orden" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "menus_virtuales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	"descripcion" text,
	"plantilla" "menu_virtual_plantilla" DEFAULT 'bistro' NOT NULL,
	"color_primario" text DEFAULT '#0f766e' NOT NULL,
	"color_secundario" text DEFAULT '#f59e0b' NOT NULL,
	"color_fondo" text DEFAULT '#fffaf0' NOT NULL,
	"logo_url" text,
	"telefono" text,
	"whatsapp" text,
	"instagram_url" text,
	"facebook_url" text,
	"tiktok_url" text,
	"sitio_web_url" text,
	"animaciones" boolean DEFAULT true NOT NULL,
	"publicado" boolean DEFAULT true NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menus_virtuales_slug_uq" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pedido_cocina_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"producto_id" uuid,
	"nombre" text NOT NULL,
	"cantidad" numeric(18, 4) NOT NULL,
	"notas" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pedidos_cocina" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"venta_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"cliente_nombre" text,
	"estado" "pedido_cocina_estado" DEFAULT 'nuevo' NOT NULL,
	"notas" text,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"listo_en" timestamp with time zone,
	CONSTRAINT "pedidos_cocina_venta_uq" UNIQUE("venta_id")
);
--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "tipo_empresa" "empresa_tipo" DEFAULT 'general' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menu_platillos" ADD CONSTRAINT "menu_platillos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menu_platillos" ADD CONSTRAINT "menu_platillos_menu_id_menus_virtuales_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus_virtuales"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menu_platillos" ADD CONSTRAINT "menu_platillos_seccion_id_menu_secciones_id_fk" FOREIGN KEY ("seccion_id") REFERENCES "public"."menu_secciones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menu_platillos" ADD CONSTRAINT "menu_platillos_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menu_promociones" ADD CONSTRAINT "menu_promociones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menu_promociones" ADD CONSTRAINT "menu_promociones_menu_id_menus_virtuales_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus_virtuales"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menu_promociones" ADD CONSTRAINT "menu_promociones_platillo_id_menu_platillos_id_fk" FOREIGN KEY ("platillo_id") REFERENCES "public"."menu_platillos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menu_secciones" ADD CONSTRAINT "menu_secciones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menu_secciones" ADD CONSTRAINT "menu_secciones_menu_id_menus_virtuales_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus_virtuales"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menus_virtuales" ADD CONSTRAINT "menus_virtuales_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menus_virtuales" ADD CONSTRAINT "menus_virtuales_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_cocina_items" ADD CONSTRAINT "pedido_cocina_items_pedido_id_pedidos_cocina_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos_cocina"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_cocina_items" ADD CONSTRAINT "pedido_cocina_items_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedidos_cocina" ADD CONSTRAINT "pedidos_cocina_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedidos_cocina" ADD CONSTRAINT "pedidos_cocina_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedidos_cocina" ADD CONSTRAINT "pedidos_cocina_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedidos_cocina" ADD CONSTRAINT "pedidos_cocina_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_platillos_empresa_idx" ON "menu_platillos" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_platillos_menu_idx" ON "menu_platillos" USING btree ("menu_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_platillos_seccion_orden_idx" ON "menu_platillos" USING btree ("seccion_id","orden");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_promociones_empresa_idx" ON "menu_promociones" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_promociones_menu_activa_idx" ON "menu_promociones" USING btree ("menu_id","activa");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_promociones_platillo_idx" ON "menu_promociones" USING btree ("platillo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_secciones_empresa_idx" ON "menu_secciones" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_secciones_menu_orden_idx" ON "menu_secciones" USING btree ("menu_id","orden");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menus_virtuales_empresa_idx" ON "menus_virtuales" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menus_virtuales_empresa_publicado_idx" ON "menus_virtuales" USING btree ("empresa_id","publicado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pedido_cocina_items_pedido_idx" ON "pedido_cocina_items" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pedido_cocina_items_producto_idx" ON "pedido_cocina_items" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pedidos_cocina_empresa_estado_idx" ON "pedidos_cocina" USING btree ("empresa_id","estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pedidos_cocina_sucursal_estado_idx" ON "pedidos_cocina" USING btree ("sucursal_id","estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pedidos_cocina_creado_idx" ON "pedidos_cocina" USING btree ("creado_en");