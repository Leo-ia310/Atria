-- =============================================================
-- ATRIA — Row-Level Security (aislamiento multi-tenant)
-- =============================================================
-- Segunda línea de defensa: aunque una query olvide filtrar por empresa_id,
-- Postgres rechaza las filas de otras empresas.
--
-- IDEMPOTENTE: se puede correr las veces que sea. Reaplica helpers y políticas.
--
-- ⚠️  NO aplicar en producción sin haber migrado antes las server actions y las
--     lecturas a `dbConEmpresa()` / `dbSuperAdmin()` (ver RLS-ROLLOUT.md).
--     Con FORCE RLS activo, cualquier query que no fije `app.empresa_id`
--     verá 0 filas. Probar primero en staging.
--
-- Aplicar con:  npm run db:rls
-- =============================================================

-- Helpers -----------------------------------------------------

CREATE OR REPLACE FUNCTION atria_empresa_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.empresa_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION atria_bypass() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.bypass_rls', true), 'false') = 'true'
$$;

-- Caso especial: `empresas` compara `id` en lugar de `empresa_id` -------------

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresas_tenant_isolation ON empresas;
CREATE POLICY empresas_tenant_isolation ON empresas
  USING (atria_bypass() OR id = atria_empresa_id())
  WITH CHECK (atria_bypass() OR id = atria_empresa_id());

-- Tablas con `empresa_id` directo ---------------------------------------------
-- Política estándar: la fila pertenece a la empresa de la sesión (o bypass).

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'suscripciones', 'pagos_suscripcion', 'referidos_atribuciones',
    'referidos_pagos', 'sucursales', 'roles', 'usuarios',
    'auditoria', 'configuraciones', 'tipos_cambio', 'categorias', 'marcas',
    'unidades_medida', 'impuestos', 'perfiles_fiscales',
    'jurisdicciones_fiscales', 'codigos_producto_fiscal',
    'reglas_impuesto_fiscal', 'snapshots_impuesto_fiscal',
    'productos', 'listas_precios', 'almacenes',
    'lotes', 'existencias', 'movimientos_inventario', 'conteos_inventario',
    'proveedores', 'ordenes_compra', 'compras', 'cuentas_por_pagar',
    'pagos_proveedor', 'clientes', 'cajas', 'sesiones_caja', 'formas_pago',
    'ventas', 'menus_virtuales', 'menu_secciones', 'menu_platillos',
    'menu_promociones', 'pedidos_cocina', 'restaurante_estaciones',
    'restaurante_areas', 'restaurante_mesas', 'restaurante_meseros',
    'restaurante_comensales', 'restaurante_productos', 'restaurante_recetas',
    'restaurante_receta_ingredientes', 'restaurante_modificador_grupos',
    'restaurante_modificadores', 'restaurante_ordenes',
    'restaurante_orden_items', 'restaurante_comandas',
    'restaurante_comanda_items', 'restaurante_reservaciones',
    'restaurante_lista_espera', 'restaurante_comensal_tokens',
    'restaurante_visitas_comensal', 'restaurante_mermas',
    'restaurante_promociones', 'restaurante_fidelizacion_config',
    'restaurante_movimientos_puntos', 'restaurante_encuestas',
    'restaurante_encuesta_respuestas', 'restaurante_compras_sugeridas',
    'notas_credito', 'facturas',
    'cuentas_por_cobrar', 'abonos_cliente', 'cotizaciones', 'tipos_documento',
    'secuencias_fiscales', 'documentos_fiscales', 'catalogo_cuentas',
    'centros_costo', 'periodos_contables', 'asientos_contables',
    'cuentas_financieras', 'movimientos_tesoreria', 'categorias_gasto',
    'gastos_recurrentes', 'gastos', 'asistente_ia_uso', 'empleados', 'producto_advertencias',
    'asistencias', 'feriados', 'nominas', 'nomina_detalles', 'tipos_deduccion',
    'nomina_deducciones', 'tipos_ingreso', 'nomina_ingresos', 'nomina_colillas',
    'solicitudes_rrhh', 'vacantes', 'candidatos'
  ];
  pol text;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    pol := t || '_tenant_isolation';
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I '
      'USING (atria_bypass() OR empresa_id = atria_empresa_id()) '
      'WITH CHECK (atria_bypass() OR empresa_id = atria_empresa_id())',
      pol, t
    );
  END LOOP;
END $$;

-- Tablas hijas sin `empresa_id` directo ---------------------------------------
-- Aíslan vía EXISTS contra el padre (que sí tiene empresa_id). El WITH CHECK
-- impide insertar/mover filas cuyo padre sea de otra empresa.
-- Formato de spec: 'tabla_hija|tabla_padre|columna_fk'

DO $$
DECLARE
  spec text;
  child text; parent text; fk text; pol text;
  specs text[] := ARRAY[
    'rol_permisos|roles|rol_id',
    'usuario_sucursales|usuarios|usuario_id',
    'codigos_recuperacion|usuarios|usuario_id',
    'producto_unidades|productos|producto_id',
    'producto_componentes|productos|producto_padre_id',
    'precios|productos|producto_id',
    'conteo_detalle|conteos_inventario|conteo_id',
    'orden_compra_detalle|ordenes_compra|orden_id',
    'compra_detalle|compras|compra_id',
    'venta_detalle|ventas|venta_id',
    'pagos_venta|ventas|venta_id',
    'pedido_cocina_items|pedidos_cocina|pedido_id',
    'nota_credito_detalle|notas_credito|nota_id',
    'cotizacion_detalle|cotizaciones|cotizacion_id',
    'asiento_partidas|asientos_contables|asiento_id'
  ];
BEGIN
  FOREACH spec IN ARRAY specs LOOP
    child  := split_part(spec, '|', 1);
    parent := split_part(spec, '|', 2);
    fk     := split_part(spec, '|', 3);
    pol    := child || '_tenant_isolation';
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', child);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', child);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, child);
    EXECUTE format(
      'CREATE POLICY %I ON %I '
      'USING (atria_bypass() OR EXISTS ('
      '  SELECT 1 FROM %I p WHERE p.id = %I.%I AND p.empresa_id = atria_empresa_id())) '
      'WITH CHECK (atria_bypass() OR EXISTS ('
      '  SELECT 1 FROM %I p WHERE p.id = %I.%I AND p.empresa_id = atria_empresa_id()))',
      pol, child, parent, child, fk, parent, child, fk
    );
  END LOOP;
END $$;

-- Tablas globales SIN RLS: `planes`, `permisos` (catálogos compartidos).
-- Su escritura se controla en código (solo super-admin).
