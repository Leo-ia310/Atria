ALTER TABLE "restaurante_mesas"
  ADD COLUMN IF NOT EXISTS "rotacion" numeric(8, 4) DEFAULT '0' NOT NULL,
  ADD COLUMN IF NOT EXISTS "estado_override_manual" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "estado_override_usuario_id" uuid REFERENCES "usuarios"("id"),
  ADD COLUMN IF NOT EXISTS "estado_override_motivo" text,
  ADD COLUMN IF NOT EXISTS "estado_override_en" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "restaurante_mesas_override_idx"
  ON "restaurante_mesas" USING btree ("empresa_id", "estado_override_manual");
