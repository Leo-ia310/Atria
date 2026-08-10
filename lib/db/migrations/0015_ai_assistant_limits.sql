CREATE TABLE IF NOT EXISTS "asistente_ia_uso" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE cascade,
  "plan_codigo" "plan_tipo" NOT NULL,
  "fecha" date NOT NULL,
  "preguntas" integer DEFAULT 0 NOT NULL,
  "palabras_entrada" integer DEFAULT 0 NOT NULL,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "asistente_ia_uso_empresa_usuario_fecha_uq"
  ON "asistente_ia_uso" ("empresa_id", "usuario_id", "fecha");

CREATE INDEX IF NOT EXISTS "asistente_ia_uso_empresa_fecha_idx"
  ON "asistente_ia_uso" ("empresa_id", "fecha");
