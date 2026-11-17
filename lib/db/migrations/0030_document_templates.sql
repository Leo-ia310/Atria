CREATE TABLE IF NOT EXISTS documento_plantillas(
 id uuid PRIMARY KEY,empresa_id uuid NOT NULL REFERENCES empresas(id),nombre text NOT NULL,version integer NOT NULL DEFAULT 1,
 creado_por uuid NOT NULL REFERENCES usuarios(id),creado_en timestamptz NOT NULL DEFAULT now(),UNIQUE(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS documento_plantilla_versiones(
 empresa_id uuid NOT NULL,plantilla_id uuid NOT NULL,version integer NOT NULL,design jsonb NOT NULL,
 usuario_id uuid NOT NULL REFERENCES usuarios(id),device_id uuid,creado_en timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,plantilla_id,version),FOREIGN KEY(empresa_id,plantilla_id) REFERENCES documento_plantillas(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS documento_emisiones(
 id uuid PRIMARY KEY,empresa_id uuid NOT NULL REFERENCES empresas(id),sucursal_id uuid NOT NULL REFERENCES sucursales(id),
 origen_tipo text NOT NULL,origen_id uuid NOT NULL,origen_version integer NOT NULL,origen_estado text NOT NULL,numero text NOT NULL,
 plantilla_id uuid,plantilla_version integer NOT NULL DEFAULT 0,ejemplar text NOT NULL CHECK(ejemplar IN ('original','duplicado')),
 snapshot jsonb NOT NULL,design jsonb NOT NULL,fiscal boolean NOT NULL DEFAULT false CHECK(NOT fiscal),
 usuario_id uuid NOT NULL REFERENCES usuarios(id),device_id uuid,creado_en timestamptz NOT NULL DEFAULT now(),UNIQUE(empresa_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS documento_emision_origen_uq ON documento_emisiones(empresa_id,origen_tipo,origen_id,origen_version,origen_estado,coalesce(plantilla_id,'00000000-0000-0000-0000-000000000000'::uuid),plantilla_version,ejemplar);
CREATE TABLE IF NOT EXISTS documento_eventos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),empresa_id uuid NOT NULL REFERENCES empresas(id),sucursal_id uuid NOT NULL REFERENCES sucursales(id),
 documento_id uuid,plantilla_id uuid,version integer NOT NULL,accion text NOT NULL,usuario_id uuid NOT NULL REFERENCES usuarios(id),device_id uuid,
 correlation_id uuid NOT NULL,datos jsonb NOT NULL DEFAULT '{}',creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documento_eventos_documento_idx ON documento_eventos(empresa_id,documento_id,creado_en);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='documento_plantilla_actual_fk') THEN
 ALTER TABLE documento_plantillas ADD CONSTRAINT documento_plantilla_actual_fk FOREIGN KEY(empresa_id,id,version) REFERENCES documento_plantilla_versiones(empresa_id,plantilla_id,version) DEFERRABLE INITIALLY DEFERRED;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='documento_emision_plantilla_fk') THEN
 ALTER TABLE documento_emisiones ADD CONSTRAINT documento_emision_plantilla_fk FOREIGN KEY(empresa_id,plantilla_id,plantilla_version) REFERENCES documento_plantilla_versiones(empresa_id,plantilla_id,version);
 END IF;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['documento_plantilla_versiones','documento_emisiones','documento_eventos'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS documento_inmutable ON %I',t);
 EXECUTE format('CREATE TRIGGER documento_inmutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION arca_comercial_inmutable()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['documento_plantillas','documento_plantilla_versiones','documento_emisiones','documento_eventos'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('DROP POLICY IF EXISTS documento_tenant ON %I',t);
 EXECUTE format('CREATE POLICY documento_tenant ON %I USING (empresa_id::text=current_setting(''app.empresa_id'',true)) WITH CHECK(empresa_id::text=current_setting(''app.empresa_id'',true))',t);
 END LOOP;
END $$;
INSERT INTO permisos(clave,modulo,descripcion) SELECT 'documento.'||a,'documentos','Documentos internos: '||a FROM unnest(ARRAY['ver','disenar','emitir','imprimir']) a ON CONFLICT(clave) DO NOTHING;
