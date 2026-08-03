ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "codigo_referido" text;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "referido_capturado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "suscripciones" ADD COLUMN IF NOT EXISTS "codigo_referido" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "empresas_codigo_referido_idx" ON "empresas" ("codigo_referido");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suscripciones_codigo_referido_idx" ON "suscripciones" ("codigo_referido");
