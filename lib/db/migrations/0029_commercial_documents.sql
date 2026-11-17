-- Additive commercial offers only. Apply after 0028, explicitly, never at runtime.
ALTER TABLE cotizacion_detalle ADD COLUMN IF NOT EXISTS revision_oferta integer;
CREATE TABLE IF NOT EXISTS perfiles_documentales (
 empresa_id uuid PRIMARY KEY REFERENCES empresas(id), perfil text NOT NULL DEFAULT 'configuracion_pendiente'
 CHECK(perfil IN ('no_registrado','configuracion_pendiente','registrado')), ruc text,
 fiscal_habilitado boolean NOT NULL DEFAULT false CHECK(NOT fiscal_habilitado),
 actualizado_en timestamptz NOT NULL DEFAULT now(), actualizado_por uuid REFERENCES usuarios(id),
 CHECK(perfil!='registrado' OR (ruc IS NOT NULL AND length(trim(ruc))>0))
);
CREATE TABLE IF NOT EXISTS comercial_origenes (
 id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES empresas(id), sucursal_id uuid NOT NULL REFERENCES sucursales(id),
 cotizacion_id uuid UNIQUE REFERENCES cotizaciones(id), version integer NOT NULL DEFAULT 1 CHECK(version>0),
 estado text NOT NULL CHECK(estado IN ('borrador','enviada','aceptada','rechazada','vencida','convertida')),
 venta_id uuid REFERENCES ventas(id), creado_por uuid NOT NULL REFERENCES usuarios(id), device_id uuid,
 creado_en timestamptz NOT NULL DEFAULT now(), actualizado_en timestamptz NOT NULL DEFAULT now(),
 UNIQUE(empresa_id,id), CHECK((estado='convertida')=(venta_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS comercial_revisiones (
 empresa_id uuid NOT NULL, origen_id uuid NOT NULL, version integer NOT NULL,
 snapshot jsonb NOT NULL, creado_por uuid NOT NULL REFERENCES usuarios(id), device_id uuid,
 creado_en timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(empresa_id,origen_id,version),
 FOREIGN KEY(empresa_id,origen_id) REFERENCES comercial_origenes(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS proformas (
 id uuid PRIMARY KEY, empresa_id uuid NOT NULL, origen_id uuid NOT NULL,
 numero text NOT NULL, creado_por uuid NOT NULL REFERENCES usuarios(id), creado_en timestamptz NOT NULL DEFAULT now(),
 UNIQUE(empresa_id,numero), UNIQUE(empresa_id,origen_id),
 FOREIGN KEY(empresa_id,origen_id) REFERENCES comercial_origenes(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS comercial_conversiones (
 empresa_id uuid NOT NULL, origen_id uuid NOT NULL, revision integer NOT NULL, venta_id uuid NOT NULL REFERENCES ventas(id),
 usuario_id uuid NOT NULL REFERENCES usuarios(id), device_id uuid, request_id uuid NOT NULL,
 creado_en timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(empresa_id,origen_id,revision),
 UNIQUE(empresa_id,origen_id), FOREIGN KEY(empresa_id,origen_id,revision) REFERENCES comercial_revisiones(empresa_id,origen_id,version)
);
CREATE TABLE IF NOT EXISTS comercial_intentos (
 empresa_id uuid NOT NULL REFERENCES empresas(id), usuario_id uuid NOT NULL REFERENCES usuarios(id), request_id uuid NOT NULL,
 sucursal_id uuid NOT NULL REFERENCES sucursales(id), clase text NOT NULL, hash text NOT NULL, resultado jsonb NOT NULL, creado_en timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,usuario_id,request_id)
);
CREATE TABLE IF NOT EXISTS comercial_eventos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL, origen_id uuid NOT NULL, version integer NOT NULL,
 documento_id uuid NOT NULL, clase text NOT NULL CHECK(clase IN ('cotizacion','proforma')), accion text NOT NULL,
 usuario_id uuid NOT NULL REFERENCES usuarios(id), device_id uuid, correlation_id uuid NOT NULL,
 motivo text, evidencia text, datos jsonb NOT NULL DEFAULT '{}', resultado text NOT NULL DEFAULT 'confirmado',
 creado_en timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(empresa_id,origen_id,version) REFERENCES comercial_revisiones(empresa_id,origen_id,version)
);
CREATE INDEX IF NOT EXISTS comercial_scope_idx ON comercial_origenes(empresa_id,sucursal_id,actualizado_en);
CREATE INDEX IF NOT EXISTS comercial_eventos_origen_idx ON comercial_eventos(empresa_id,origen_id,creado_en);
-- Immutable document revisions and event history, including privileged application sessions.
CREATE OR REPLACE FUNCTION arca_comercial_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Documento comercial histórico inmutable'; END $$;
DROP TRIGGER IF EXISTS comercial_revision_inmutable ON comercial_revisiones;
CREATE TRIGGER comercial_revision_inmutable BEFORE UPDATE OR DELETE ON comercial_revisiones FOR EACH ROW EXECUTE FUNCTION arca_comercial_inmutable();
DROP TRIGGER IF EXISTS comercial_evento_inmutable ON comercial_eventos;
CREATE TRIGGER comercial_evento_inmutable BEFORE UPDATE OR DELETE ON comercial_eventos FOR EACH ROW EXECUTE FUNCTION arca_comercial_inmutable();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['perfiles_documentales','comercial_origenes','comercial_revisiones','proformas','comercial_conversiones','comercial_intentos','comercial_eventos'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('DROP POLICY IF EXISTS comercial_tenant ON %I',t);
 EXECUTE format('CREATE POLICY comercial_tenant ON %I USING (empresa_id::text = current_setting(''app.empresa_id'',true)) WITH CHECK (empresa_id::text = current_setting(''app.empresa_id'',true))',t);
 END LOOP;
END $$;
INSERT INTO permisos(clave,modulo,descripcion)
SELECT kind||'.'||action,kind,'Documentos comerciales: '||kind||' '||action
FROM (VALUES('cotizacion'),('proforma')) k(kind)
CROSS JOIN (VALUES('ver'),('crear'),('editar'),('duplicar'),('enviar'),('aceptar'),('rechazar'),('convertir'),('imprimir')) a(action)
ON CONFLICT(clave) DO NOTHING;
-- Deliberately no role grants, data backfills or historical document updates.

INSERT INTO permisos(clave,modulo,descripcion) VALUES('documental.configurar','configuracion','Configurar perfil documental sin emisión fiscal') ON CONFLICT(clave) DO NOTHING;
