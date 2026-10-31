import { eq, sql } from "drizzle-orm";
import { dbSuperAdmin } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { getAccessContext } from "@/lib/server-access";
import { puedeAccederModulo } from "@/lib/access-control";
import type { SessionUser } from "@/lib/actions/session-helpers";

/** Initial offline catalog. Reads remain scoped to the authenticated company. */
export async function desktopBootstrap(user: SessionUser, sucursalIds: string[]) {
  const access = await getAccessContext(user);
  if (access.suscripcionBloqueada) throw new Error("La suscripcion no permite descargar datos.");
  const branches = sql`ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(sucursalIds)}::jsonb)::uuid)`;
  return dbSuperAdmin(async (tx) => {
    const [empresa] = await tx.select({
      empresa_id: empresas.id, nombre: sql<string>`coalesce(${empresas.nombreComercial}, ${empresas.razonSocial})`,
      identificacion_fiscal: empresas.identificacionFiscal, pais: empresas.pais,
      moneda: empresas.moneda, direccion: empresas.direccion, telefono: empresas.telefono,
    }).from(empresas).where(eq(empresas.id, user.empresaId));
    const sucursales = await tx.execute(sql`select s.id, s.empresa_id, s.nombre, s.direccion, s.telefono, s.activa as activo,
      (select a.id from almacenes a where a.empresa_id = s.empresa_id and a.sucursal_id = s.id
        and a.activo = true order by a.es_principal desc, a.id limit 1) as almacen_id
      from sucursales s where s.empresa_id = ${user.empresaId}::uuid
      and s.id = any(${branches})`);
    const productos = puedeAccederModulo(access, "inventario") || puedeAccederModulo(access, "pos")
      ? await tx.execute(sql`select p.id, p.empresa_id, p.sku, p.codigo_barras, p.nombre,
        p.precio_base, p.costo_promedio, coalesce(i.tasa,0) as impuesto_tasa,
        p.activo, p.actualizado_en, p.eliminado_en
        from productos p left join impuestos i on i.id = p.impuesto_id
        where p.empresa_id = ${user.empresaId}::uuid`) : [];
    const clientes = puedeAccederModulo(access, "clientes")
      ? await tx.execute(sql`select id, empresa_id, nombre, identificacion_fiscal, telefono,
        email, limite_credito, dias_credito, activo, eliminado_en from clientes
        where empresa_id = ${user.empresaId}::uuid`) : [];
    const impuestos = await tx.execute(sql`select id, empresa_id, nombre, tasa, activo from impuestos where empresa_id = ${user.empresaId}::uuid`);
    const formas_pago = await tx.execute(sql`select id, empresa_id, nombre, codigo as tipo, activa as activo from formas_pago where empresa_id = ${user.empresaId}::uuid`);
    const proveedores = puedeAccederModulo(access, "compras") ? await tx.execute(sql`select id, empresa_id, coalesce(nombre_comercial, razon_social) as nombre, identificacion_fiscal, telefono, email, activo, eliminado_en from proveedores where empresa_id = ${user.empresaId}::uuid`) : [];
    const puedeVentas = puedeAccederModulo(access, "ventas");
    const ventas = puedeVentas ? await tx.execute(sql`select id, empresa_id, sucursal_id, sesion_caja_id,
      cliente_id, numero as numero_local, numero as numero_servidor, fecha, estado, subtotal,
      descuento, impuesto, total, usuario_id, 'web:' || id::text as idempotency_key
      from ventas where empresa_id = ${user.empresaId}::uuid and sucursal_id = any(${branches})`) : [];
    const venta_detalle = puedeVentas ? await tx.execute(sql`select d.id, v.empresa_id, d.venta_id,
      d.producto_id, d.cantidad, d.precio_unitario, d.descuento, d.impuesto, d.costo_unitario, d.subtotal
      from venta_detalle d join ventas v on v.id = d.venta_id
      where v.empresa_id = ${user.empresaId}::uuid and v.sucursal_id = any(${branches})`) : [];
    const pagos_venta = puedeVentas ? await tx.execute(sql`select p.id, v.empresa_id, p.venta_id,
      p.forma_pago_id, p.monto, p.referencia from pagos_venta p join ventas v on v.id = p.venta_id
      where v.empresa_id = ${user.empresaId}::uuid and v.sucursal_id = any(${branches})`) : [];
    const movimientos_inventario = puedeAccederModulo(access, "inventario") || puedeAccederModulo(access, "pos")
      ? await tx.execute(sql`select m.id, m.empresa_id, m.producto_id, m.almacen_id, m.tipo,
        m.cantidad, m.costo_unitario, m.referencia_tabla, m.referencia_id, m.usuario_id, m.creado_en
        from movimientos_inventario m join almacenes a on a.id = m.almacen_id
        where m.empresa_id = ${user.empresaId}::uuid and a.empresa_id = ${user.empresaId}::uuid
        and a.sucursal_id = any(${branches})`) : [];
    const facturas = puedeAccederModulo(access, "facturas") ? await tx.execute(sql`select f.id, f.empresa_id,
      f.venta_id, f.numero, f.fecha, f.vendedor_id, f.vendedor_nombre, f.cliente_nombre, f.formas_pago,
      f.es_credito, f.total, f.snapshot::text as snapshot_json, f.creado_en
      from facturas f join ventas v on v.id = f.venta_id
      where f.empresa_id = ${user.empresaId}::uuid and v.sucursal_id = any(${branches})`) : [];
    const cuentas_por_cobrar = puedeAccederModulo(access, "cxc") ? await tx.execute(sql`select c.id,
      c.empresa_id, c.cliente_id, c.venta_id, c.fecha_emision, c.fecha_vencimiento, c.monto,
      c.saldo, c.estado, c.notas, c.creado_en from cuentas_por_cobrar c left join ventas v on v.id = c.venta_id
      where c.empresa_id = ${user.empresaId}::uuid and (c.venta_id is null or v.sucursal_id = any(${branches}))`) : [];
    const cuentas_por_pagar = puedeAccederModulo(access, "cxp") ? await tx.execute(sql`select c.id,
      c.empresa_id, c.proveedor_id, c.compra_id, c.fecha_emision, c.fecha_vencimiento, c.monto,
      c.saldo, c.estado, c.notas, c.creado_en from cuentas_por_pagar c left join compras p on p.id = c.compra_id
      where c.empresa_id = ${user.empresaId}::uuid and (c.compra_id is null or p.sucursal_id = any(${branches}))`) : [];
    const catalogo_cuentas = puedeAccederModulo(access, "contabilidad") ? await tx.execute(sql`select id,
      empresa_id, padre_id, codigo, nombre, tipo, naturaleza, nivel, es_detalle, permite_movimiento, activa
      from catalogo_cuentas where empresa_id = ${user.empresaId}::uuid`) : [];
    const periodos_contables = puedeAccederModulo(access, "contabilidad") ? await tx.execute(sql`select id,
      empresa_id, anio, mes, estado from periodos_contables where empresa_id = ${user.empresaId}::uuid`) : [];
    const asientos_contables = puedeAccederModulo(access, "contabilidad") ? await tx.execute(sql`select id,
      empresa_id, periodo_id, numero, fecha, concepto, origen, referencia_tabla, referencia_id,
      total_debe, total_haber, estado, usuario_id from asientos_contables
      where empresa_id = ${user.empresaId}::uuid and (sucursal_id is null or sucursal_id = any(${branches}))`) : [];
    const asiento_partidas = puedeAccederModulo(access, "contabilidad") ? await tx.execute(sql`select p.id,
      a.empresa_id, p.asiento_id, p.cuenta_id, p.descripcion, p.debe, p.haber, p.orden
      from asiento_partidas p join asientos_contables a on a.id = p.asiento_id
      where a.empresa_id = ${user.empresaId}::uuid and (a.sucursal_id is null or a.sucursal_id = any(${branches}))`) : [];
    const compras = puedeAccederModulo(access, "compras") ? await tx.execute(sql`select c.id, c.empresa_id,
      coalesce(c.sucursal_id, a.sucursal_id)::text as sucursal_id, c.proveedor_id,
      coalesce(c.numero_factura, c.id::text) as numero_local, c.fecha, c.estado, c.subtotal, c.impuesto,
      c.total, c.usuario_id, 'web:' || c.id::text as idempotency_key
      from compras c join almacenes a on a.id = c.almacen_id
      where c.empresa_id = ${user.empresaId}::uuid and coalesce(c.sucursal_id, a.sucursal_id) = any(${branches})`) : [];
    const compra_detalle = puedeAccederModulo(access, "compras") ? await tx.execute(sql`select d.id,
      c.empresa_id, d.compra_id, d.producto_id, d.cantidad, d.costo_unitario, d.subtotal
      from compra_detalle d join compras c on c.id = d.compra_id join almacenes a on a.id = c.almacen_id
      where c.empresa_id = ${user.empresaId}::uuid and coalesce(c.sucursal_id, a.sucursal_id) = any(${branches})`) : [];
    const sesiones_caja = puedeAccederModulo(access, "caja") ? await tx.execute(sql`select s.id,
      s.empresa_id, c.sucursal_id, s.caja_id, s.usuario_id, s.estado, s.monto_inicial as fondo_inicial,
      s.monto_final_real as total_declarado, s.diferencia, s.abierta_en as apertura_en,
      s.cerrada_en as cierre_en, s.notas from sesiones_caja s join cajas c on c.id = s.caja_id
      where s.empresa_id = ${user.empresaId}::uuid and c.sucursal_id = any(${branches})`) : [];
    const cuentas_financieras = puedeAccederModulo(access, "tesoreria") ? await tx.execute(sql`select id, empresa_id, nombre, tipo, saldo_actual as saldo_inicial, activa as activo from cuentas_financieras where empresa_id = ${user.empresaId}::uuid and (sucursal_id is null or sucursal_id = any(${branches}))`) : [];
    const gastos = puedeAccederModulo(access, "tesoreria") ? await tx.execute(sql`select g.id, g.empresa_id,
      coalesce(g.sucursal_id::text, '') as sucursal_id, coalesce(g.cuenta_financiera_id::text, '') as cuenta_id,
      c.nombre as categoria, g.descripcion, g.total as monto, g.fecha, g.usuario_id
      from gastos g join categorias_gasto c on c.id = g.categoria_id
      where g.empresa_id = ${user.empresaId}::uuid and (g.sucursal_id is null or g.sucursal_id = any(${branches}))`) : [];
    const rrhh: Record<string, unknown[]> = {};
    if (puedeAccederModulo(access, "rrhh")) {
      rrhh.empleados = [...await tx.execute(sql`select id, codigo, nombres, apellidos, puesto, departamento, estado, salario_base, fecha_ingreso from empleados where empresa_id = ${user.empresaId}::uuid and (sucursal_id is null or sucursal_id = any(${branches}))`)];
      rrhh.asistencia = [...await tx.execute(sql`select a.id, e.nombres || ' ' || e.apellidos as empleado, a.fecha, a.estado, a.hora_entrada, a.hora_salida, a.horas_trabajadas, a.horas_extra from asistencias a join empleados e on e.id = a.empleado_id where a.empresa_id = ${user.empresaId}::uuid and (e.sucursal_id is null or e.sucursal_id = any(${branches}))`)];
      rrhh.nomina = [...await tx.execute(sql`select id, numero, descripcion, periodo_inicio, periodo_fin, fecha_pago, estado, empleados_count, total_devengado, total_deducciones, total_neto from nominas where empresa_id = ${user.empresaId}::uuid`)];
      rrhh.ingresos = [...await tx.execute(sql`select i.id, e.nombres || ' ' || e.apellidos as empleado, t.nombre as concepto, i.monto, i.semana, i.nota from nomina_ingresos i join nomina_detalles d on d.id = i.nomina_detalle_id join empleados e on e.id = d.empleado_id join tipos_ingreso t on t.id = i.tipo_ingreso_id where i.empresa_id = ${user.empresaId}::uuid and (e.sucursal_id is null or e.sucursal_id = any(${branches}))`)];
      rrhh.deducciones = [...await tx.execute(sql`select i.id, e.nombres || ' ' || e.apellidos as empleado, t.nombre as concepto, i.monto, i.semana, i.nota from nomina_deducciones i join nomina_detalles d on d.id = i.nomina_detalle_id join empleados e on e.id = d.empleado_id join tipos_deduccion t on t.id = i.tipo_deduccion_id where i.empresa_id = ${user.empresaId}::uuid and (e.sucursal_id is null or e.sucursal_id = any(${branches}))`)];
      rrhh.solicitudes = [...await tx.execute(sql`select s.id, e.nombres || ' ' || e.apellidos as empleado, s.tipo, s.estado, s.fecha_inicio, s.fecha_fin, s.dias, s.monto, s.motivo from solicitudes_rrhh s join empleados e on e.id = s.empleado_id where s.empresa_id = ${user.empresaId}::uuid and (e.sucursal_id is null or e.sucursal_id = any(${branches}))`)];
    }
    return { empresaId: user.empresaId, empresa_config: empresa ? [empresa] : [], sucursales, rrhh, compras, compra_detalle, sesiones_caja, cuentas_financieras, gastos,
      productos, clientes, impuestos, formas_pago, proveedores, ventas, venta_detalle, pagos_venta, movimientos_inventario,
      facturas, cuentas_por_cobrar, cuentas_por_pagar, catalogo_cuentas, periodos_contables, asientos_contables, asiento_partidas };
  });
}
