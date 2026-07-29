CREATE INDEX IF NOT EXISTS "suscripciones_empresa_creado_idx"
  ON "suscripciones" USING btree ("empresa_id", "creado_en");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sucursales_empresa_activa_eliminado_idx"
  ON "sucursales" USING btree ("empresa_id", "activa", "eliminado_en");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "productos_empresa_activo_eliminado_creado_idx"
  ON "productos" USING btree ("empresa_id", "activo", "eliminado_en", "creado_en");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "almacenes_empresa_sucursal_activo_idx"
  ON "almacenes" USING btree ("empresa_id", "sucursal_id", "activo");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "existencias_empresa_almacen_producto_idx"
  ON "existencias" USING btree ("empresa_id", "almacen_id", "producto_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mov_inv_empresa_producto_almacen_creado_idx"
  ON "movimientos_inventario" USING btree ("empresa_id", "producto_id", "almacen_id", "creado_en");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cxp_empresa_estado_vencimiento_idx"
  ON "cuentas_por_pagar" USING btree ("empresa_id", "estado", "fecha_vencimiento");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cajas_empresa_sucursal_activa_idx"
  ON "cajas" USING btree ("empresa_id", "sucursal_id", "activa");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sesiones_empresa_estado_caja_idx"
  ON "sesiones_caja" USING btree ("empresa_id", "estado", "caja_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ventas_empresa_fecha_idx"
  ON "ventas" USING btree ("empresa_id", "fecha");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ventas_empresa_sucursal_fecha_idx"
  ON "ventas" USING btree ("empresa_id", "sucursal_id", "fecha");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "facturas_empresa_fecha_idx"
  ON "facturas" USING btree ("empresa_id", "fecha");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cxc_empresa_estado_vencimiento_idx"
  ON "cuentas_por_cobrar" USING btree ("empresa_id", "estado", "fecha_vencimiento");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asientos_empresa_estado_fecha_idx"
  ON "asientos_contables" USING btree ("empresa_id", "estado", "fecha");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gastos_empresa_fecha_idx"
  ON "gastos" USING btree ("empresa_id", "fecha");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "empleados_empresa_sucursal_eliminado_idx"
  ON "empleados" USING btree ("empresa_id", "sucursal_id", "eliminado_en");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asistencias_empresa_fecha_empleado_idx"
  ON "asistencias" USING btree ("empresa_id", "fecha", "empleado_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "solicitudes_rrhh_empresa_estado_creado_idx"
  ON "solicitudes_rrhh" USING btree ("empresa_id", "estado", "creado_en");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vacantes_empresa_estado_creado_idx"
  ON "vacantes" USING btree ("empresa_id", "estado", "creado_en");
