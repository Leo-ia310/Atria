ALTER TABLE "menus_virtuales" ADD COLUMN "cantidad_mesas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos_cocina" ADD COLUMN "mesa_numero" text;