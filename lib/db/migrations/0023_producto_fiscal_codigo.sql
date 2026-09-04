ALTER TABLE "productos"
ADD COLUMN IF NOT EXISTS "producto_fiscal_codigo" text DEFAULT 'GENERAL_TAXABLE' NOT NULL;
--> statement-breakpoint
UPDATE "productos"
SET "producto_fiscal_codigo" = 'GENERAL_TAXABLE'
WHERE "producto_fiscal_codigo" IS NULL OR trim("producto_fiscal_codigo") = '';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "productos_empresa_fiscal_idx"
ON "productos" USING btree ("empresa_id","producto_fiscal_codigo");
