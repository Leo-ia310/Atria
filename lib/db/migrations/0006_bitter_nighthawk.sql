ALTER TABLE "pedidos_cocina" ALTER COLUMN "venta_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "menus_virtuales" ADD COLUMN "sucursal_id" uuid;--> statement-breakpoint
ALTER TABLE "pedidos_cocina" ADD COLUMN "menu_id" uuid;--> statement-breakpoint
ALTER TABLE "pedidos_cocina" ADD COLUMN "origen" text DEFAULT 'pos' NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos_cocina" ADD COLUMN "cliente_telefono" text;--> statement-breakpoint
ALTER TABLE "pedidos_cocina" ADD COLUMN "cliente_direccion" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menus_virtuales" ADD CONSTRAINT "menus_virtuales_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedidos_cocina" ADD CONSTRAINT "pedidos_cocina_menu_id_menus_virtuales_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus_virtuales"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menus_virtuales_sucursal_idx" ON "menus_virtuales" USING btree ("sucursal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pedidos_cocina_menu_idx" ON "pedidos_cocina" USING btree ("menu_id");