CREATE TABLE IF NOT EXISTS caja_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL, sucursal_id uuid NOT NULL,
  sesion_id uuid NOT NULL, tipo text NOT NULL, origen_tipo text NOT NULL, origen_id uuid NOT NULL,
  monto numeric(18,4) NOT NULL, usuario_id uuid NOT NULL, device_id uuid,
  ocurrido_en timestamptz NOT NULL, registrado_en timestamptz NOT NULL DEFAULT now(), detalle jsonb NOT NULL DEFAULT '{}',
  CONSTRAINT caja_movimiento_origen_uq UNIQUE(empresa_id,origen_tipo,origen_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS caja_movimientos_sesion_idx ON caja_movimientos(empresa_id,sesion_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS caja_revisiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL, sucursal_id uuid NOT NULL,
  sesion_id uuid NOT NULL, movimiento_id uuid NOT NULL, motivo text NOT NULL,
  resuelta_en timestamptz, resuelta_por uuid, resolucion text,
  CONSTRAINT caja_revision_movimiento_uq UNIQUE(empresa_id,movimiento_id)
);

--> statement-breakpoint
ALTER TABLE caja_movimientos ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE caja_movimientos FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY caja_movimientos_tenant ON caja_movimientos
 USING (empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)
 WITH CHECK (empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid);

--> statement-breakpoint
ALTER TABLE caja_revisiones ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE caja_revisiones FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY caja_revisiones_tenant ON caja_revisiones
 USING (empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)
 WITH CHECK (empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid);


--> statement-breakpoint
-- Fail safely if an existing physical box has duplicate open sessions; never close historical sessions automatically.
CREATE UNIQUE INDEX IF NOT EXISTS sesiones_caja_abierta_uq ON sesiones_caja(empresa_id,caja_id) WHERE estado='abierta';
