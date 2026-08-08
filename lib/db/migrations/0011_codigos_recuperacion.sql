CREATE TABLE IF NOT EXISTS "codigos_recuperacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"codigo_hash" text NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"usado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "codigos_recuperacion" ADD CONSTRAINT "codigos_recuperacion_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "codigos_recuperacion_usuario_idx" ON "codigos_recuperacion" USING btree ("usuario_id");