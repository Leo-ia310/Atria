-- Additive. No historical repairs or automatic grants. Requires 0029 and 0030.
CREATE TABLE IF NOT EXISTS cxc_configuracion(
 empresa_id uuid PRIMARY KEY REFERENCES empresas(id),cuenta_pasivo_id uuid NOT NULL REFERENCES catalogo_cuentas(id),
 usuario_id uuid NOT NULL REFERENCES usuarios(id),actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cxc_creditos(
 id uuid PRIMARY KEY,empresa_id uuid NOT NULL REFERENCES empresas(id),sucursal_id uuid NOT NULL REFERENCES sucursales(id),cliente_id uuid NOT NULL REFERENCES clientes(id),
 tipo text NOT NULL CHECK(tipo IN ('anticipo','nota_credito')),origen_id uuid NOT NULL,numero text NOT NULL,moneda text NOT NULL,
 monto numeric(18,4) NOT NULL CHECK(monto>0),saldo numeric(18,4) NOT NULL CHECK(saldo>=0 AND saldo<=monto),
 cuenta_pasivo_id uuid NOT NULL REFERENCES catalogo_cuentas(id),fecha date NOT NULL,usuario_id uuid NOT NULL REFERENCES usuarios(id),device_id uuid,asiento_id uuid NOT NULL REFERENCES asientos_contables(id),
 UNIQUE(empresa_id,tipo,origen_id),UNIQUE(empresa_id,numero)
);
CREATE TABLE IF NOT EXISTS cxc_eventos(
 id uuid PRIMARY KEY,empresa_id uuid NOT NULL REFERENCES empresas(id),sucursal_id uuid NOT NULL REFERENCES sucursales(id),cliente_id uuid REFERENCES clientes(id),
 tipo text NOT NULL,numero text NOT NULL,credito_id uuid REFERENCES cxc_creditos(id),cxc_id uuid REFERENCES cuentas_por_cobrar(id),nota_id uuid REFERENCES notas_credito(id),
 fecha date NOT NULL,monto numeric(18,4) NOT NULL CHECK(monto>0),referencia text,motivo text NOT NULL,
 usuario_id uuid NOT NULL REFERENCES usuarios(id),device_id uuid,correlation_id uuid NOT NULL,asiento_id uuid NOT NULL REFERENCES asientos_contables(id),snapshot jsonb NOT NULL,
 datos jsonb NOT NULL DEFAULT '{}',creado_en timestamptz NOT NULL DEFAULT now(),UNIQUE(empresa_id,correlation_id)
);
ALTER TABLE notas_credito ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES sucursales(id);
ALTER TABLE notas_credito ADD COLUMN IF NOT EXISTS snapshot jsonb;
ALTER TABLE notas_credito ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE nota_credito_detalle ADD COLUMN IF NOT EXISTS venta_detalle_id uuid REFERENCES venta_detalle(id);
ALTER TABLE nota_credito_detalle ADD COLUMN IF NOT EXISTS impuesto numeric(18,4);
ALTER TABLE nota_credito_detalle ADD COLUMN IF NOT EXISTS total numeric(18,4);
ALTER TABLE nota_credito_detalle ADD COLUMN IF NOT EXISTS costo numeric(18,4);
ALTER TABLE nota_credito_detalle ADD COLUMN IF NOT EXISTS reingresada boolean;
CREATE INDEX IF NOT EXISTS cxc_creditos_scope_idx ON cxc_creditos(empresa_id,sucursal_id,cliente_id);
CREATE INDEX IF NOT EXISTS cxc_eventos_scope_idx ON cxc_eventos(empresa_id,sucursal_id,cliente_id,fecha);
CREATE INDEX IF NOT EXISTS nota_credito_linea_idx ON nota_credito_detalle(venta_detalle_id);
CREATE INDEX IF NOT EXISTS nota_credito_scope_fecha_idx ON notas_credito(empresa_id,sucursal_id,fecha);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['cxc_configuracion','cxc_creditos','cxc_eventos'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('DROP POLICY IF EXISTS cxc_tenant ON %I',t);
 EXECUTE format('CREATE POLICY cxc_tenant ON %I USING (empresa_id::text=current_setting(''app.empresa_id'',true)) WITH CHECK(empresa_id::text=current_setting(''app.empresa_id'',true))',t);
 END LOOP;
 DROP TRIGGER IF EXISTS cxc_evento_inmutable ON cxc_eventos;
 CREATE TRIGGER cxc_evento_inmutable BEFORE UPDATE OR DELETE ON cxc_eventos FOR EACH ROW EXECUTE FUNCTION arca_comercial_inmutable();
 DROP TRIGGER IF EXISTS nota_nueva_inmutable ON notas_credito;
 CREATE TRIGGER nota_nueva_inmutable BEFORE UPDATE OR DELETE ON notas_credito FOR EACH ROW WHEN (OLD.snapshot IS NOT NULL) EXECUTE FUNCTION arca_comercial_inmutable();
 DROP TRIGGER IF EXISTS nota_linea_nueva_inmutable ON nota_credito_detalle;
 CREATE TRIGGER nota_linea_nueva_inmutable BEFORE UPDATE OR DELETE ON nota_credito_detalle FOR EACH ROW WHEN (OLD.venta_detalle_id IS NOT NULL) EXECUTE FUNCTION arca_comercial_inmutable();
END $$;
INSERT INTO permisos(clave,modulo,descripcion) SELECT 'cxc.'||a,'cxc','Cuentas por cobrar: '||a FROM unnest(ARRAY['ver','anticipar','aplicar','reembolsar','cobrar','configurar','imprimir']) a ON CONFLICT(clave) DO NOTHING;
INSERT INTO permisos(clave,modulo,descripcion) SELECT 'venta.'||a,'ventas','Venta: '||a FROM unnest(ARRAY['nota_credito','devolver','anular']) a ON CONFLICT(clave) DO NOTHING;
