CREATE TABLE IF NOT EXISTS "usuario_onboarding_modulos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL,
  "usuario_id" uuid NOT NULL,
  "modulo" text NOT NULL,
  "visto_en" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "usuario_onboarding_modulos_usuario_modulo_uq" UNIQUE("usuario_id","modulo")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usuario_onboarding_modulos" ADD CONSTRAINT "usuario_onboarding_modulos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usuario_onboarding_modulos" ADD CONSTRAINT "usuario_onboarding_modulos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usuario_onboarding_modulos_empresa_usuario_idx" ON "usuario_onboarding_modulos" USING btree ("empresa_id","usuario_id");
