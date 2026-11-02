import { sql } from "drizzle-orm";
import { dbSuperAdmin } from "./db";

let ready: Promise<void> | null = null;
/** Additive infrastructure and payment evidence. Existing rows are never replaced. */
export function ensureDesktopSchema(): Promise<void> {
  if (ready) return ready;
  ready = dbSuperAdmin(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('arca-desktop-schema-v7',0))`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS desktop_schema_versions(version integer PRIMARY KEY, installed_at timestamptz NOT NULL DEFAULT now())`);
    const installed = await tx.execute(sql`select version from desktop_schema_versions where version=10`);
    if (installed.length) return;
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS transferencias_pendientes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),empresa_id uuid NOT NULL REFERENCES empresas(id),sucursal_id uuid NOT NULL REFERENCES sucursales(id),venta_id uuid NOT NULL REFERENCES ventas(id),forma_pago_id uuid NOT NULL REFERENCES formas_pago(id),monto numeric(18,4) NOT NULL CHECK(monto>0),referencia text NOT NULL,status text NOT NULL DEFAULT 'pending_verification',version integer NOT NULL DEFAULT 0,cuenta_financiera_id uuid REFERENCES cuentas_financieras(id),bank_reference text,resolution_reason text,abono_id uuid REFERENCES abonos_cliente(id),resolved_by uuid REFERENCES usuarios(id),resolved_at timestamptz,created_at timestamptz NOT NULL DEFAULT now())`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS pending_transfers_scope_idx ON transferencias_pendientes(empresa_id,sucursal_id,status)`);
    await tx.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS pending_transfer_bank_receipt_uq ON transferencias_pendientes(empresa_id,cuenta_financiera_id,bank_reference) WHERE status='verified'`);
    await tx.execute(sql`ALTER TABLE pagos_venta ADD COLUMN IF NOT EXISTS payment_source text NOT NULL DEFAULT 'legacy'`);
    await tx.execute(sql`ALTER TABLE pagos_venta ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unverified'`);
    await tx.execute(sql`ALTER TABLE pagos_venta ADD COLUMN IF NOT EXISTS terminal_approved boolean NOT NULL DEFAULT false`);
    await tx.execute(sql`ALTER TABLE pagos_venta ADD COLUMN IF NOT EXISTS terminal_independent boolean NOT NULL DEFAULT false`);
    await tx.execute(sql`ALTER TABLE pagos_venta ADD COLUMN IF NOT EXISTS terminal_authorization text`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS desktop_devices (
      empresa_id uuid NOT NULL REFERENCES empresas(id), device_id uuid NOT NULL,
      name text NOT NULL DEFAULT 'ARCA Desktop', revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(), last_sync_at timestamptz,
      PRIMARY KEY(empresa_id,device_id))`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS desktop_device_users (
      empresa_id uuid NOT NULL, device_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES usuarios(id),
      offline_access_valid_until timestamptz NOT NULL, revoked_at timestamptz,
      PRIMARY KEY(empresa_id,device_id,user_id),
      FOREIGN KEY(empresa_id,device_id) REFERENCES desktop_devices(empresa_id,device_id))`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS desktop_operations (
      empresa_id uuid NOT NULL, idempotency_key text NOT NULL, operation_id text NOT NULL,
      device_id uuid NOT NULL, user_id uuid NOT NULL, entity_type text NOT NULL, entity_id uuid,
      request_hash text NOT NULL, result jsonb NOT NULL, stock_pairs jsonb NOT NULL DEFAULT '[]', applied_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(empresa_id,idempotency_key))`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS desktop_change_log (
      seq bigserial PRIMARY KEY, empresa_id uuid NOT NULL, entity_type text NOT NULL,
      entity_id text NOT NULL, deleted boolean NOT NULL DEFAULT false,
      change_tx xid8 NOT NULL DEFAULT pg_current_xact_id(), changed_at timestamptz NOT NULL DEFAULT now())`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS desktop_changes_tenant_seq ON desktop_change_log(empresa_id,seq)`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS desktop_changes_tenant_tx ON desktop_change_log(empresa_id,change_tx,seq)`);
    await tx.execute(sql`CREATE OR REPLACE FUNCTION arca_desktop_track_change() RETURNS trigger LANGUAGE plpgsql AS $fn$
      DECLARE r jsonb; tenant uuid; record_id text; kind text;
      BEGIN
        r := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
        tenant := CASE WHEN TG_TABLE_NAME = 'empresas' THEN (r->>'id')::uuid ELSE (r->>'empresa_id')::uuid END;
        IF tenant IS NULL AND TG_TABLE_NAME IN ('venta_detalle','pagos_venta') THEN
          SELECT empresa_id INTO tenant FROM ventas WHERE id=(r->>'venta_id')::uuid;
        ELSIF tenant IS NULL AND TG_TABLE_NAME='compra_detalle' THEN
          SELECT empresa_id INTO tenant FROM compras WHERE id=(r->>'compra_id')::uuid;
        ELSIF tenant IS NULL AND TG_TABLE_NAME='asiento_partidas' THEN
          SELECT empresa_id INTO tenant FROM asientos_contables WHERE id=(r->>'asiento_id')::uuid;
          IF tenant IS NULL THEN SELECT empresa_id INTO tenant FROM catalogo_cuentas WHERE id=(r->>'cuenta_id')::uuid; END IF;
        END IF;
        IF tenant IS NULL AND TG_TABLE_NAME='rol_permisos' THEN SELECT empresa_id INTO tenant FROM roles WHERE id=(r->>'rol_id')::uuid; END IF;
        IF tenant IS NULL THEN RETURN NULL; END IF;
        kind := CASE TG_TABLE_NAME WHEN 'categorias_gasto' THEN 'settings.gastos_categorias' WHEN 'gastos_recurrentes' THEN 'settings.gastos_recurrentes' WHEN 'roles' THEN 'settings.roles' WHEN 'rol_permisos' THEN 'settings.roles' WHEN 'usuarios' THEN 'settings.usuarios' WHEN 'configuraciones' THEN 'settings.configuraciones' WHEN 'secuencias_fiscales' THEN 'settings.secuencias' WHEN 'tipos_documento' THEN 'settings.documentos' WHEN 'empresas' THEN 'empresa_config' WHEN 'existencias' THEN 'inventario_base'
          WHEN 'empleados' THEN 'rrhh.empleados' WHEN 'asistencias' THEN 'rrhh.asistencia' WHEN 'nomina_detalles' THEN 'rrhh.detalles' WHEN 'tipos_ingreso' THEN 'rrhh.tipos_ingreso' WHEN 'tipos_deduccion' THEN 'rrhh.tipos_deduccion' WHEN 'feriados' THEN 'rrhh.feriados'
          WHEN 'nominas' THEN 'rrhh.nomina' WHEN 'nomina_colillas' THEN 'rrhh.colillas' WHEN 'nomina_ingresos' THEN 'rrhh.ingresos'
          WHEN 'nomina_deducciones' THEN 'rrhh.deducciones' WHEN 'solicitudes_rrhh' THEN 'rrhh.solicitudes'
          WHEN 'almacenes' THEN 'inventario_almacenes' ELSE TG_TABLE_NAME END;
        record_id := CASE WHEN TG_TABLE_NAME='rol_permisos' THEN r->>'rol_id' WHEN TG_TABLE_NAME = 'existencias' THEN (r->>'producto_id') || ':' || (r->>'almacen_id') ELSE r->>'id' END;
        INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id,deleted) VALUES(tenant,kind,record_id,TG_OP='DELETE');
        IF TG_TABLE_NAME='gastos' THEN
          INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id,deleted) VALUES(tenant,'settings.gastos_detalles',record_id,TG_OP='DELETE');
        ELSIF TG_TABLE_NAME IN ('categorias_gasto','cuentas_financieras') THEN
          INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id)
            SELECT tenant,'settings.gastos_detalles',g.id::text FROM gastos g WHERE g.empresa_id=tenant AND (CASE WHEN TG_TABLE_NAME='categorias_gasto' THEN g.categoria_id ELSE g.cuenta_financiera_id END)=(r->>'id')::uuid
            UNION ALL SELECT tenant,'settings.gastos_recurrentes',g.id::text FROM gastos_recurrentes g WHERE g.empresa_id=tenant AND (CASE WHEN TG_TABLE_NAME='categorias_gasto' THEN g.categoria_id ELSE g.cuenta_financiera_id END)=(r->>'id')::uuid;
          IF TG_TABLE_NAME='categorias_gasto' THEN
            INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id) SELECT tenant,'gastos',id::text FROM gastos WHERE empresa_id=tenant AND categoria_id=(r->>'id')::uuid;
          END IF;
        END IF;
        IF TG_TABLE_NAME IN ('empresas','sucursales','cajas','impuestos','formas_pago','cuentas_financieras') THEN
          INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id,deleted) VALUES(tenant,
            CASE TG_TABLE_NAME WHEN 'empresas' THEN 'settings.empresa' WHEN 'cuentas_financieras' THEN 'settings.cuentas' ELSE 'settings.' || TG_TABLE_NAME END,record_id,TG_OP='DELETE');
        END IF;
        IF TG_TABLE_NAME = 'impuestos' THEN
          INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id)
            SELECT tenant,'productos',id::text FROM productos WHERE empresa_id=tenant AND impuesto_id=(r->>'id')::uuid;
        END IF;
        IF TG_TABLE_NAME = 'empleados' THEN
          INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id)
            SELECT tenant,'rrhh.asistencia',id::text FROM asistencias WHERE empresa_id=tenant AND empleado_id=(r->>'id')::uuid
            UNION ALL SELECT tenant,'rrhh.solicitudes',id::text FROM solicitudes_rrhh WHERE empresa_id=tenant AND empleado_id=(r->>'id')::uuid
            UNION ALL SELECT tenant,'rrhh.detalles',id::text FROM nomina_detalles WHERE empresa_id=tenant AND empleado_id=(r->>'id')::uuid
            UNION ALL SELECT tenant,'rrhh.ingresos',i.id::text FROM nomina_ingresos i JOIN nomina_detalles d ON d.id=i.nomina_detalle_id WHERE i.empresa_id=tenant AND d.empleado_id=(r->>'id')::uuid
            UNION ALL SELECT tenant,'rrhh.deducciones',i.id::text FROM nomina_deducciones i JOIN nomina_detalles d ON d.id=i.nomina_detalle_id WHERE i.empresa_id=tenant AND d.empleado_id=(r->>'id')::uuid;
        ELSIF TG_TABLE_NAME = 'tipos_ingreso' THEN
          INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id) SELECT tenant,'rrhh.ingresos',id::text FROM nomina_ingresos WHERE empresa_id=tenant AND tipo_ingreso_id=(r->>'id')::uuid;
        ELSIF TG_TABLE_NAME = 'tipos_deduccion' THEN
          INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id) SELECT tenant,'rrhh.deducciones',id::text FROM nomina_deducciones WHERE empresa_id=tenant AND tipo_deduccion_id=(r->>'id')::uuid;
        ELSIF TG_TABLE_NAME = 'almacenes' THEN
          INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id) VALUES(tenant,'sucursales',r->>'sucursal_id');
        END IF;
        IF TG_TABLE_NAME='asiento_partidas' THEN
          INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id)
            SELECT tenant,'settings.cuentas',id::text FROM cuentas_financieras WHERE empresa_id=tenant AND cuenta_contable_id=(r->>'cuenta_id')::uuid
            UNION ALL SELECT tenant,'cuentas_financieras',id::text FROM cuentas_financieras WHERE empresa_id=tenant AND cuenta_contable_id=(r->>'cuenta_id')::uuid;
          IF TG_OP='UPDATE' THEN
            INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id)
              SELECT tenant,'settings.cuentas',id::text FROM cuentas_financieras WHERE empresa_id=tenant AND cuenta_contable_id=(to_jsonb(OLD)->>'cuenta_id')::uuid
              UNION ALL SELECT tenant,'cuentas_financieras',id::text FROM cuentas_financieras WHERE empresa_id=tenant AND cuenta_contable_id=(to_jsonb(OLD)->>'cuenta_id')::uuid;
          END IF;
        ELSIF TG_TABLE_NAME='asientos_contables' THEN
          INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id)
            SELECT DISTINCT tenant,'settings.cuentas',cf.id::text FROM cuentas_financieras cf JOIN asiento_partidas p ON p.cuenta_id=cf.cuenta_contable_id WHERE cf.empresa_id=tenant AND p.asiento_id=(r->>'id')::uuid
            UNION SELECT DISTINCT tenant,'cuentas_financieras',cf.id::text FROM cuentas_financieras cf JOIN asiento_partidas p ON p.cuenta_id=cf.cuenta_contable_id WHERE cf.empresa_id=tenant AND p.asiento_id=(r->>'id')::uuid;
        ELSIF TG_TABLE_NAME IN ('catalogo_cuentas','empresas') THEN
          INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id)
            SELECT tenant,'settings.cuentas',id::text FROM cuentas_financieras WHERE empresa_id=tenant AND (TG_TABLE_NAME='empresas' OR cuenta_contable_id=(r->>'id')::uuid)
            UNION ALL SELECT tenant,'cuentas_financieras',id::text FROM cuentas_financieras WHERE empresa_id=tenant AND (TG_TABLE_NAME='empresas' OR cuenta_contable_id=(r->>'id')::uuid);
        ELSIF TG_TABLE_NAME='cuentas_financieras' THEN
          INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id)
            SELECT tenant,'settings.cuentas',id::text FROM cuentas_financieras WHERE empresa_id=tenant AND cuenta_contable_id=(r->>'cuenta_contable_id')::uuid
            UNION ALL SELECT tenant,'cuentas_financieras',id::text FROM cuentas_financieras WHERE empresa_id=tenant AND cuenta_contable_id=(r->>'cuenta_contable_id')::uuid;
          IF TG_OP='UPDATE' THEN
            INSERT INTO desktop_change_log(empresa_id,entity_type,entity_id)
              SELECT tenant,'settings.cuentas',id::text FROM cuentas_financieras WHERE empresa_id=tenant AND cuenta_contable_id=(to_jsonb(OLD)->>'cuenta_contable_id')::uuid
              UNION ALL SELECT tenant,'cuentas_financieras',id::text FROM cuentas_financieras WHERE empresa_id=tenant AND cuenta_contable_id=(to_jsonb(OLD)->>'cuenta_contable_id')::uuid;
          END IF;
        END IF;
        RETURN NULL;
      END $fn$`);
    // The allowlist is constant, never a client table name.
    for (const table of ["transferencias_pendientes","usuarios","roles","rol_permisos","configuraciones","secuencias_fiscales","tipos_documento","empresas","sucursales","cajas","almacenes","impuestos","formas_pago","productos","clientes","proveedores","ventas","venta_detalle","pagos_venta","movimientos_inventario","existencias","compras","compra_detalle","sesiones_caja","cuentas_financieras","categorias_gasto","gastos_recurrentes","gastos","facturas","cuentas_por_cobrar","cuentas_por_pagar","catalogo_cuentas","periodos_contables","asientos_contables","asiento_partidas","empleados","asistencias","nominas","nomina_detalles","nomina_colillas","tipos_ingreso","tipos_deduccion","feriados","nomina_ingresos","nomina_deducciones","solicitudes_rrhh"]) {
      // Child rows without empresa_id obtain their tenant through the parent function below.
      await tx.execute(sql.raw(`DROP TRIGGER IF EXISTS arca_desktop_change ON "${table}"`));
      await tx.execute(sql.raw(`CREATE TRIGGER arca_desktop_change AFTER INSERT OR UPDATE OR DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION arca_desktop_track_change()`));
    }
    for (const table of ["transferencias_pendientes","desktop_devices","desktop_device_users","desktop_operations","desktop_change_log"]) {
      await tx.execute(sql.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
      await tx.execute(sql.raw(`DROP POLICY IF EXISTS desktop_tenant_scope ON ${table}`));
      await tx.execute(sql.raw(`CREATE POLICY desktop_tenant_scope ON ${table} USING (
        empresa_id=nullif(current_setting('app.empresa_id',true),'')::uuid OR current_setting('app.bypass_rls',true)='true'
      ) WITH CHECK (empresa_id=nullif(current_setting('app.empresa_id',true),'')::uuid OR current_setting('app.bypass_rls',true)='true')`));
    }
    await tx.execute(sql`UPDATE facturas SET snapshot=snapshot || '{"fiscal_status":"pending_submission","fiscal_provider_status":"not_configured","official_fiscal_id":null}'::jsonb WHERE snapshot->>'documentType'='internal_receipt' AND snapshot->>'fiscal_status' IS NULL`);
    await tx.execute(sql`INSERT INTO desktop_schema_versions(version) VALUES(10)`);
  }).catch((error: unknown) => { ready = null; throw error; });
  return ready;
}
