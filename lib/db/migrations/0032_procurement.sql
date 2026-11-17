-- Additive procurement. Apply after 0031. No backfills, historical repair, or role grants.
ALTER TABLE compras ADD COLUMN IF NOT EXISTS flujo text NOT NULL DEFAULT 'simultanea';
CREATE UNIQUE INDEX IF NOT EXISTS abast_oc_tenant_uq ON ordenes_compra(empresa_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS abast_oc_line_parent_uq ON orden_compra_detalle(orden_id,id);
CREATE TABLE IF NOT EXISTS abast_config(
 empresa_id uuid PRIMARY KEY REFERENCES empresas(id),policy text NOT NULL CHECK(policy IN('sin_reconocimiento_hasta_factura','mercancia_recibida_no_facturada')),
 grni_account_id uuid REFERENCES catalogo_cuentas(id),transit_account_id uuid REFERENCES catalogo_cuentas(id),claim_account_id uuid REFERENCES catalogo_cuentas(id),variance_account_id uuid REFERENCES catalogo_cuentas(id),
 version integer NOT NULL,usuario_id uuid NOT NULL REFERENCES usuarios(id),actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS abast_rfq(
 id uuid PRIMARY KEY,empresa_id uuid NOT NULL REFERENCES empresas(id),sucursal_id uuid NOT NULL REFERENCES sucursales(id),numero text NOT NULL,estado text NOT NULL DEFAULT 'abierta',version integer NOT NULL DEFAULT 1,
 snapshot jsonb NOT NULL,selected_offer_id uuid,selected_revision integer,selection_reason text,approved boolean NOT NULL DEFAULT false,
 usuario_id uuid NOT NULL REFERENCES usuarios(id),device_id uuid,creado_en timestamptz NOT NULL DEFAULT now(),UNIQUE(empresa_id,id),UNIQUE(empresa_id,numero)
);
CREATE TABLE IF NOT EXISTS abast_envios(
 id uuid PRIMARY KEY,empresa_id uuid NOT NULL,sucursal_id uuid NOT NULL REFERENCES sucursales(id),rfq_id uuid NOT NULL,proveedor_id uuid NOT NULL REFERENCES proveedores(id),medio text NOT NULL,evidencia text NOT NULL,
 usuario_id uuid NOT NULL REFERENCES usuarios(id),device_id uuid,correlation_id uuid NOT NULL,creado_en timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(empresa_id,rfq_id) REFERENCES abast_rfq(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS abast_ofertas(
 id uuid PRIMARY KEY,empresa_id uuid NOT NULL,rfq_id uuid NOT NULL,proveedor_id uuid NOT NULL REFERENCES proveedores(id),revision integer NOT NULL DEFAULT 1,estado text NOT NULL DEFAULT 'registrada',
 UNIQUE(empresa_id,id),UNIQUE(empresa_id,rfq_id,proveedor_id),FOREIGN KEY(empresa_id,rfq_id) REFERENCES abast_rfq(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS abast_oferta_revisiones(
 empresa_id uuid NOT NULL,oferta_id uuid NOT NULL,revision integer NOT NULL,snapshot jsonb NOT NULL,usuario_id uuid NOT NULL REFERENCES usuarios(id),device_id uuid,creado_en timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,oferta_id,revision),FOREIGN KEY(empresa_id,oferta_id) REFERENCES abast_ofertas(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS abast_oc(
 id uuid PRIMARY KEY REFERENCES ordenes_compra(id),empresa_id uuid NOT NULL,rfq_id uuid NOT NULL,oferta_id uuid NOT NULL,revision integer NOT NULL,version integer NOT NULL DEFAULT 1,aprobada boolean NOT NULL DEFAULT false,snapshot jsonb NOT NULL,
 UNIQUE(empresa_id,id),UNIQUE(empresa_id,rfq_id),FOREIGN KEY(empresa_id,id) REFERENCES ordenes_compra(empresa_id,id),FOREIGN KEY(empresa_id,oferta_id,revision) REFERENCES abast_oferta_revisiones(empresa_id,oferta_id,revision)
);
CREATE TABLE IF NOT EXISTS abast_recepciones(
 id uuid PRIMARY KEY,empresa_id uuid NOT NULL,sucursal_id uuid NOT NULL REFERENCES sucursales(id),orden_id uuid NOT NULL,almacen_id uuid NOT NULL REFERENCES almacenes(id),numero text NOT NULL,fecha date NOT NULL,snapshot jsonb NOT NULL,
 accounting_status text NOT NULL,accounting_reason text,asiento_id uuid REFERENCES asientos_contables(id),accounting_meta jsonb NOT NULL DEFAULT '{}',
 usuario_id uuid NOT NULL REFERENCES usuarios(id),device_id uuid,creado_en timestamptz NOT NULL DEFAULT now(),UNIQUE(empresa_id,id),UNIQUE(empresa_id,numero),FOREIGN KEY(empresa_id,orden_id) REFERENCES abast_oc(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS abast_recepcion_detalle(
 id uuid PRIMARY KEY,empresa_id uuid NOT NULL,recepcion_id uuid NOT NULL,orden_id uuid NOT NULL,oc_line_id uuid NOT NULL,aceptada numeric(18,4) NOT NULL CHECK(aceptada>=0),rechazada numeric(18,4) NOT NULL CHECK(rechazada>=0),devuelta numeric(18,4) NOT NULL DEFAULT 0 CHECK(devuelta>=0 AND devuelta<=aceptada),
 base numeric(18,4) NOT NULL,impuesto numeric(18,4) NOT NULL,grni_qty numeric(18,4) NOT NULL DEFAULT 0,grni_base numeric(18,4) NOT NULL DEFAULT 0,
 UNIQUE(empresa_id,id),UNIQUE(recepcion_id,oc_line_id),FOREIGN KEY(empresa_id,recepcion_id) REFERENCES abast_recepciones(empresa_id,id),FOREIGN KEY(orden_id,oc_line_id) REFERENCES orden_compra_detalle(orden_id,id)
);
CREATE TABLE IF NOT EXISTS abast_facturas(
 id uuid PRIMARY KEY,empresa_id uuid NOT NULL,sucursal_id uuid NOT NULL REFERENCES sucursales(id),orden_id uuid NOT NULL,proveedor_id uuid NOT NULL REFERENCES proveedores(id),compra_id uuid NOT NULL UNIQUE REFERENCES compras(id),cxp_id uuid NOT NULL UNIQUE REFERENCES cuentas_por_pagar(id),
 doc_key text NOT NULL,numero text NOT NULL,serie text NOT NULL,fecha date NOT NULL,vencimiento date NOT NULL,moneda text NOT NULL,tipo_cambio numeric(18,6) NOT NULL CHECK(tipo_cambio>0),functional_currency text NOT NULL,snapshot jsonb NOT NULL,
 usuario_id uuid NOT NULL REFERENCES usuarios(id),device_id uuid,creado_en timestamptz NOT NULL DEFAULT now(),UNIQUE(empresa_id,id),UNIQUE(empresa_id,proveedor_id,doc_key),FOREIGN KEY(empresa_id,orden_id) REFERENCES abast_oc(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS abast_factura_detalle(
 id uuid PRIMARY KEY,empresa_id uuid NOT NULL,factura_id uuid NOT NULL,orden_id uuid NOT NULL,oc_line_id uuid NOT NULL,cantidad numeric(18,4) NOT NULL CHECK(cantidad>0),base numeric(18,4) NOT NULL,impuesto numeric(18,4) NOT NULL,transit_account_id uuid REFERENCES catalogo_cuentas(id),
 UNIQUE(empresa_id,id),UNIQUE(factura_id,oc_line_id),FOREIGN KEY(empresa_id,factura_id) REFERENCES abast_facturas(empresa_id,id),FOREIGN KEY(orden_id,oc_line_id) REFERENCES orden_compra_detalle(orden_id,id)
);
CREATE TABLE IF NOT EXISTS abast_asignaciones(
 id uuid PRIMARY KEY,empresa_id uuid NOT NULL,recepcion_line_id uuid NOT NULL,factura_line_id uuid NOT NULL,cantidad numeric(18,4) NOT NULL CHECK(cantidad>0),invoice_base numeric(18,4) NOT NULL,receipt_base numeric(18,4) NOT NULL,grni_qty numeric(18,4) NOT NULL DEFAULT 0,grni_base numeric(18,4) NOT NULL DEFAULT 0,
 UNIQUE(recepcion_line_id,factura_line_id),FOREIGN KEY(empresa_id,recepcion_line_id) REFERENCES abast_recepcion_detalle(empresa_id,id),FOREIGN KEY(empresa_id,factura_line_id) REFERENCES abast_factura_detalle(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS abast_devoluciones(
 id uuid PRIMARY KEY,empresa_id uuid NOT NULL,sucursal_id uuid NOT NULL REFERENCES sucursales(id),recepcion_id uuid NOT NULL,numero text NOT NULL,fecha date NOT NULL,snapshot jsonb NOT NULL,accounting_status text NOT NULL,accounting_reason text,asiento_id uuid REFERENCES asientos_contables(id),
 usuario_id uuid NOT NULL REFERENCES usuarios(id),device_id uuid,creado_en timestamptz NOT NULL DEFAULT now(),UNIQUE(empresa_id,id),FOREIGN KEY(empresa_id,recepcion_id) REFERENCES abast_recepciones(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS abast_eventos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),empresa_id uuid NOT NULL REFERENCES empresas(id),sucursal_id uuid NOT NULL REFERENCES sucursales(id),entity_id uuid NOT NULL,accion text NOT NULL,revision integer,datos jsonb NOT NULL,
 usuario_id uuid NOT NULL REFERENCES usuarios(id),device_id uuid,correlation_id uuid NOT NULL,creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS abast_rfq_scope_idx ON abast_rfq(empresa_id,sucursal_id,creado_en);
CREATE INDEX IF NOT EXISTS abast_recepcion_order_idx ON abast_recepciones(empresa_id,orden_id);
CREATE INDEX IF NOT EXISTS abast_factura_order_idx ON abast_facturas(empresa_id,orden_id);
CREATE INDEX IF NOT EXISTS abast_event_entity_idx ON abast_eventos(empresa_id,entity_id,creado_en);
CREATE INDEX IF NOT EXISTS abast_assignment_receipt_idx ON abast_asignaciones(empresa_id,recepcion_line_id);
CREATE INDEX IF NOT EXISTS abast_assignment_invoice_idx ON abast_asignaciones(empresa_id,factura_line_id);
CREATE OR REPLACE FUNCTION arca_abast_snapshot_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.snapshot IS DISTINCT FROM OLD.snapshot THEN RAISE EXCEPTION 'Snapshot de abastecimiento inmutable'; END IF; RETURN NEW; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['abast_config','abast_rfq','abast_envios','abast_ofertas','abast_oferta_revisiones','abast_oc','abast_recepciones','abast_recepcion_detalle','abast_facturas','abast_factura_detalle','abast_asignaciones','abast_devoluciones','abast_eventos'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);EXECUTE format('DROP POLICY IF EXISTS abast_tenant ON %I',t);
 EXECUTE format('CREATE POLICY abast_tenant ON %I USING(empresa_id::text=current_setting(''app.empresa_id'',true)) WITH CHECK(empresa_id::text=current_setting(''app.empresa_id'',true))',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['abast_oferta_revisiones','abast_envios','abast_facturas','abast_factura_detalle','abast_asignaciones','abast_eventos'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS abast_inmutable ON %I',t);EXECUTE format('CREATE TRIGGER abast_inmutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION arca_comercial_inmutable()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['abast_rfq','abast_oc','abast_recepciones','abast_devoluciones'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS abast_snapshot_guard ON %I',t);EXECUTE format('CREATE TRIGGER abast_snapshot_guard BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION arca_abast_snapshot_inmutable()',t);
 END LOOP;
END $$;
INSERT INTO permisos(clave,modulo,descripcion) SELECT a,'abastecimiento','Abastecimiento: '||a FROM unnest(ARRAY['rfq.ver','rfq.crear','rfq.enviar','oferta_proveedor.ver','oferta_proveedor.registrar','oferta_proveedor.editar','oferta_proveedor.comparar','oferta_proveedor.aprobar','oferta_proveedor.rechazar','orden_compra.crear','orden_compra.aprobar','recepcion.crear','recepcion.devolver','cxp.ver','cxp.pagar','cxp.configurar']) a ON CONFLICT(clave) DO NOTHING;

-- Headers are never removed; corrections are separate audited business operations.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['abast_rfq','abast_oc','abast_recepciones','abast_devoluciones'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS abast_no_delete ON %I',t);
 EXECUTE format('CREATE TRIGGER abast_no_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION arca_comercial_inmutable()',t);
 END LOOP;
END $$;
