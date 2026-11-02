CREATE TABLE IF NOT EXISTS transferencias_pendientes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES empresas(id), sucursal_id uuid NOT NULL REFERENCES sucursales(id),
 venta_id uuid NOT NULL REFERENCES ventas(id), forma_pago_id uuid NOT NULL REFERENCES formas_pago(id), monto numeric(18,4) NOT NULL CHECK(monto>0), referencia text NOT NULL,
 status text NOT NULL DEFAULT 'pending_verification' CHECK(status IN ('pending_verification','verified','rejected')), version integer NOT NULL DEFAULT 0,
 cuenta_financiera_id uuid REFERENCES cuentas_financieras(id), bank_reference text, resolution_reason text, abono_id uuid REFERENCES abonos_cliente(id), resolved_by uuid REFERENCES usuarios(id), resolved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS pending_transfers_scope_idx ON transferencias_pendientes(empresa_id,sucursal_id,status);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS pending_transfer_bank_receipt_uq ON transferencias_pendientes(empresa_id,cuenta_financiera_id,bank_reference) WHERE status='verified';
--> statement-breakpoint
ALTER TABLE transferencias_pendientes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS desktop_tenant_scope ON transferencias_pendientes;
--> statement-breakpoint
CREATE POLICY desktop_tenant_scope ON transferencias_pendientes USING(empresa_id=nullif(current_setting('app.empresa_id',true),'')::uuid OR current_setting('app.bypass_rls',true)='true') WITH CHECK(empresa_id=nullif(current_setting('app.empresa_id',true),'')::uuid OR current_setting('app.bypass_rls',true)='true');
