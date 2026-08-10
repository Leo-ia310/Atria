CREATE TABLE IF NOT EXISTS "gastos_plataforma" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fecha" date NOT NULL,
  "categoria" text NOT NULL,
  "proveedor" text,
  "descripcion" text NOT NULL,
  "monto" numeric(18, 4) NOT NULL,
  "moneda" text DEFAULT 'USD' NOT NULL,
  "metodo_pago" text,
  "recurrente" boolean DEFAULT false NOT NULL,
  "notas" text,
  "creado_por_id" uuid REFERENCES "usuarios"("id"),
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gastos_plataforma_fecha_idx" ON "gastos_plataforma" ("fecha");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gastos_plataforma_categoria_idx" ON "gastos_plataforma" ("categoria");
