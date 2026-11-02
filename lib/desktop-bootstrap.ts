import { cuentasConSaldoContableQuery } from "./tesoreria/saldos";
import { eq, sql, type SQL } from "drizzle-orm";
import { desktopScopeHash, readDesktopCursor, signDesktopCursor, type DesktopCursorState } from "./desktop-cursor";
import { dbSuperAdmin } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { getAccessContext } from "@/lib/server-access";
import { puedeAccederModulo } from "@/lib/access-control";
import type { SessionUser } from "@/lib/actions/session-helpers";
import { TASA_SEGURIDAD_SOCIAL } from "./rrhh";
import type { PaisCodigo } from "./paises";

/** Initial offline catalog. Reads remain scoped to the authenticated company. */
export async function desktopBootstrap(user: SessionUser, sucursalIds: string[], options?: { deviceId: string; cursor?: string; pendingKeys?: string[] }) {
  const access = await getAccessContext(user);
  if (access.suscripcionBloqueada) throw new Error("La suscripcion no permite descargar datos.");
  const branches = sql`ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(sucursalIds)}::jsonb)::uuid)`;
  const scopeHash = desktopScopeHash([13,sucursalIds.slice().sort(), user.rolId, access.permisos.slice().sort(), access.esAdminEmpresa, access.plan, access.suscripcionBloqueada]);
  const cursorScope = { empresaId: user.empresaId, userId: user.id, deviceId: options?.deviceId ?? "", scopeHash };
  const previous = options?.cursor ? readDesktopCursor(options.cursor, cursorScope) : null;
  return dbSuperAdmin(async (tx) => {
    const [snapshot] = await tx.execute(sql`select pg_current_snapshot()::text as value`);
    const until = previous?.until ?? String(snapshot.value);
    const receipts = options?.pendingKeys?.length ? [...await tx.execute(sql`select operation_id,result,stock_pairs from desktop_operations
      where empresa_id=${user.empresaId}::uuid and user_id=${user.id}::uuid and device_id=${options.deviceId}::uuid
      and idempotency_key=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(options.pendingKeys)}::jsonb)))`)] : [];
    const logRows = previous ? [...await tx.execute(sql`select seq::text,entity_type,entity_id,deleted from desktop_change_log
      where empresa_id=${user.empresaId}::uuid and seq > ${previous.after}::bigint
      and change_tx >= ${previous.snapshot.split(":")[0]}::xid8
      and not pg_visible_in_snapshot(change_tx,${previous.snapshot}::pg_snapshot)
      and pg_visible_in_snapshot(change_tx,${until}::pg_snapshot) order by desktop_change_log.seq limit 201`)] : [];
    const hasMore = logRows.length > 200;
    const page = logRows.slice(0,200);
    const changes: Record<string, string[]> = {};
    for (const row of page) (changes[String(row.entity_type)] ??= []).push(String(row.entity_id));
    const returned = new Set<string>();
    async function query(table: string, statement: SQL): Promise<Record<string,unknown>[]> {
      const ids = changes[table];
      if (previous && !ids?.length) return [];
      const querySql = previous ? table === "inventario_base" ? sql`select * from (${statement}) scoped_rows where scoped_rows.id = any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)))`
        : sql`select * from (${statement}) scoped_rows where scoped_rows.id = any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::uuid))` : statement;
      const rows = [...await tx.execute(querySql)];
      for (const row of rows) returned.add(`${table}:${String(row.id)}`);
      return rows;
    }
    const [empresa] = await tx.select({
      empresa_id: empresas.id, nombre: sql<string>`coalesce(${empresas.nombreComercial}, ${empresas.razonSocial})`,
      identificacion_fiscal: empresas.identificacionFiscal, pais: empresas.pais,
      zona_horaria: empresas.zonaHoraria, moneda: empresas.moneda, direccion: empresas.direccion, telefono: empresas.telefono,
    }).from(empresas).where(eq(empresas.id, user.empresaId));
    const sucursales = await query("sucursales", sql`select s.id, s.empresa_id, s.nombre, s.direccion, s.telefono, s.activa as activo,
      (select a.id from almacenes a where a.empresa_id = s.empresa_id and a.sucursal_id = s.id
        and a.activo = true order by a.es_principal desc, a.id limit 1) as almacen_id
      from sucursales s where s.empresa_id = ${user.empresaId}::uuid
      and s.id = any(${branches})`);
    const cajas = puedeAccederModulo(access, "caja") || puedeAccederModulo(access, "pos")
      ? await query("cajas", sql`select id, empresa_id, sucursal_id, nombre from cajas where empresa_id = ${user.empresaId}::uuid and sucursal_id = any(${branches}) and activa = true`) : [];
    const productos = puedeAccederModulo(access, "inventario") || puedeAccederModulo(access, "pos")
      ? await query("productos", sql`select p.id, p.empresa_id, p.sku, p.codigo_barras, p.nombre,
        p.precio_base, p.costo_promedio, p.stock_minimo, coalesce(i.tasa,0) as impuesto_tasa,
        p.activo, p.actualizado_en, p.eliminado_en
        from productos p left join impuestos i on i.id = p.impuesto_id
        where p.empresa_id = ${user.empresaId}::uuid`) : [];
    const clientes = puedeAccederModulo(access, "clientes")
      ? await query("clientes", sql`select id, empresa_id, nombre, identificacion_fiscal, telefono,
        email, limite_credito, dias_credito, activo, eliminado_en from clientes
        where empresa_id = ${user.empresaId}::uuid`) : [];
    const impuestos = await query("impuestos", sql`select id, empresa_id, nombre, tasa, activo from impuestos where empresa_id = ${user.empresaId}::uuid`);
    const formas_pago = await query("formas_pago", sql`select id, empresa_id, nombre, codigo as tipo, activa as activo from formas_pago where empresa_id = ${user.empresaId}::uuid`);
    const proveedores = puedeAccederModulo(access, "compras") ? await query("proveedores", sql`select id, empresa_id, coalesce(nombre_comercial, razon_social) as nombre, identificacion_fiscal, telefono, email, activo, eliminado_en from proveedores where empresa_id = ${user.empresaId}::uuid`) : [];
    const puedeVentas = puedeAccederModulo(access, "ventas");
    const transferencias_pendientes=(puedeVentas||puedeAccederModulo(access,"cxc")||puedeAccederModulo(access,"tesoreria"))?await query("transferencias_pendientes",sql`select t.*,v.numero as numero_venta,c.nombre as cliente_nombre from transferencias_pendientes t join ventas v on v.id=t.venta_id and v.empresa_id=t.empresa_id left join clientes c on c.id=v.cliente_id and c.empresa_id=t.empresa_id where t.empresa_id=${user.empresaId}::uuid and t.sucursal_id=any(${branches})`):[];
    const ventas = puedeVentas ? await query("ventas", sql`select id, empresa_id, sucursal_id, sesion_caja_id,
      cliente_id, numero as numero_local, numero as numero_servidor, fecha, estado, subtotal,
      descuento, impuesto, total, costo_total, usuario_id, 'web:' || id::text as idempotency_key
      from ventas where empresa_id = ${user.empresaId}::uuid and sucursal_id = any(${branches})`) : [];
    const venta_detalle = puedeVentas ? await query("venta_detalle", sql`select d.id, v.empresa_id, d.venta_id,
      d.producto_id, d.cantidad, d.precio_unitario, d.descuento, d.impuesto, d.costo_unitario, d.subtotal
      from venta_detalle d join ventas v on v.id = d.venta_id
      where v.empresa_id = ${user.empresaId}::uuid and v.sucursal_id = any(${branches})`) : [];
    const pagos_venta = puedeVentas ? await query("pagos_venta", sql`select p.id, v.empresa_id, p.venta_id,
      p.forma_pago_id, p.monto, p.referencia, p.payment_source, p.payment_status, p.terminal_approved, p.terminal_independent, p.terminal_authorization from pagos_venta p join ventas v on v.id = p.venta_id
      where v.empresa_id = ${user.empresaId}::uuid and v.sucursal_id = any(${branches})`) : [];
    const movimientos_inventario = puedeAccederModulo(access, "inventario") || puedeAccederModulo(access, "pos")
      ? await query("movimientos_inventario", sql`select m.id, m.empresa_id, m.producto_id, m.almacen_id, m.tipo,
        m.cantidad, m.costo_unitario, m.referencia_tabla, m.referencia_id, m.usuario_id, m.creado_en
        from movimientos_inventario m join almacenes a on a.id = m.almacen_id
        where m.empresa_id = ${user.empresaId}::uuid and a.empresa_id = ${user.empresaId}::uuid
        and a.sucursal_id = any(${branches})`) : [];
    const inventario_almacenes = puedeAccederModulo(access, "inventario") || puedeAccederModulo(access, "pos")
      ? await query("inventario_almacenes", sql`select id, empresa_id, sucursal_id from almacenes where empresa_id = ${user.empresaId}::uuid and sucursal_id = any(${branches}) and activo = true`) : [];
    let inventario_base = puedeAccederModulo(access, "inventario") || puedeAccederModulo(access, "pos")
      ? await query("inventario_base", sql`select e.producto_id::text || ':' || e.almacen_id::text as id, e.empresa_id,
        e.producto_id, e.almacen_id, sum(e.cantidad) as cantidad, max(e.actualizado_en) as actualizado_en
        from existencias e join almacenes a on a.id = e.almacen_id and a.empresa_id = e.empresa_id
        where e.empresa_id = ${user.empresaId}::uuid and a.sucursal_id = any(${branches}) and a.activo = true
          and (${!previous} or exists(select 1 from jsonb_array_elements_text(${JSON.stringify(changes.inventario_base ?? [])}::jsonb) changed(id)
            where e.producto_id=split_part(changed.id,':',1)::uuid and e.almacen_id=split_part(changed.id,':',2)::uuid))
        group by e.producto_id, e.empresa_id, e.almacen_id`) : [];
    const stockPairs = receipts.flatMap((row) => Array.isArray(row.stock_pairs) ? row.stock_pairs as Array<{productoId:string;almacenId:string}> : []);
    if (stockPairs.length && (puedeAccederModulo(access,"inventario") || puedeAccederModulo(access,"pos"))) {
      const refreshed = [...await tx.execute(sql`select p.id::text || ':' || a.id::text as id,p.empresa_id,p.id as producto_id,a.id as almacen_id,
        coalesce(sum(e.cantidad),0) as cantidad,max(e.actualizado_en) as actualizado_en
        from (select distinct "productoId","almacenId" from jsonb_to_recordset(${JSON.stringify(stockPairs)}::jsonb) as pairs("productoId" uuid,"almacenId" uuid)) pair
        join productos p on p.id=pair."productoId" and p.empresa_id=${user.empresaId}::uuid
        join almacenes a on a.id=pair."almacenId" and a.empresa_id=p.empresa_id and a.sucursal_id=any(${branches})
        left join existencias e on e.producto_id=p.id and e.almacen_id=a.id and e.empresa_id=p.empresa_id
        group by p.id,p.empresa_id,a.id`)];
      inventario_base = [...inventario_base,...refreshed];
      for (const row of refreshed) returned.add(`inventario_base:${String(row.id)}`);
    }
    const facturas = puedeAccederModulo(access, "facturas") ? await query("facturas", sql`select f.id, f.empresa_id,
      f.venta_id, f.numero, f.fecha, f.vendedor_id, f.vendedor_nombre, f.cliente_nombre, f.formas_pago,
      f.es_credito, f.total, f.snapshot::text as snapshot_json, f.creado_en
      from facturas f join ventas v on v.id = f.venta_id
      where f.empresa_id = ${user.empresaId}::uuid and v.sucursal_id = any(${branches})`) : [];
    const cuentas_por_cobrar = puedeAccederModulo(access, "cxc") ? await query("cuentas_por_cobrar", sql`select c.id,
      c.empresa_id, c.cliente_id, c.venta_id, c.fecha_emision, c.fecha_vencimiento, c.monto,
      c.saldo, c.estado, c.notas, c.creado_en from cuentas_por_cobrar c left join ventas v on v.id = c.venta_id
      where c.empresa_id = ${user.empresaId}::uuid and (c.venta_id is null or v.sucursal_id = any(${branches}))`) : [];
    const cuentas_por_pagar = puedeAccederModulo(access, "cxp") ? await query("cuentas_por_pagar", sql`select c.id,
      c.empresa_id, c.proveedor_id, c.compra_id, c.fecha_emision, c.fecha_vencimiento, c.monto,
      c.saldo, c.estado, c.notas, c.creado_en from cuentas_por_pagar c left join compras p on p.id = c.compra_id
      where c.empresa_id = ${user.empresaId}::uuid and (c.compra_id is null or p.sucursal_id = any(${branches}))`) : [];
    const catalogo_cuentas = (puedeAccederModulo(access, "contabilidad") || puedeAccederModulo(access, "tesoreria")) ? await query("catalogo_cuentas", sql`select id,
      empresa_id, padre_id, codigo, nombre, tipo, naturaleza, nivel, es_detalle, permite_movimiento, activa
      from catalogo_cuentas where empresa_id = ${user.empresaId}::uuid`) : [];
    const periodos_contables = puedeAccederModulo(access, "contabilidad") ? await query("periodos_contables", sql`select id,
      empresa_id, anio, mes, fecha_inicio, fecha_fin, cerrado_en, estado from periodos_contables where empresa_id = ${user.empresaId}::uuid`) : [];
    const asientos_contables = puedeAccederModulo(access, "contabilidad") ? await query("asientos_contables", sql`select id,
      empresa_id, sucursal_id, periodo_id, numero, fecha, concepto, origen, referencia_tabla, referencia_id,
      total_debe, total_haber, estado, usuario_id from asientos_contables
      where empresa_id = ${user.empresaId}::uuid and (sucursal_id is null or sucursal_id = any(${branches}))`) : [];
    const asiento_partidas = puedeAccederModulo(access, "contabilidad") ? await query("asiento_partidas", sql`select p.id,
      a.empresa_id, p.asiento_id, p.cuenta_id, p.descripcion, p.debe, p.haber, p.orden
      from asiento_partidas p join asientos_contables a on a.id = p.asiento_id
      where a.empresa_id = ${user.empresaId}::uuid and (a.sucursal_id is null or a.sucursal_id = any(${branches}))`) : [];
    const compras = puedeAccederModulo(access, "compras") ? await query("compras", sql`select c.id, c.empresa_id,
      coalesce(c.sucursal_id, a.sucursal_id)::text as sucursal_id, c.proveedor_id,
      coalesce(c.numero_factura, c.id::text) as numero_local, c.fecha, c.estado, c.subtotal, c.impuesto,
      c.total, c.usuario_id, 'web:' || c.id::text as idempotency_key
      from compras c join almacenes a on a.id = c.almacen_id
      where c.empresa_id = ${user.empresaId}::uuid and coalesce(c.sucursal_id, a.sucursal_id) = any(${branches})`) : [];
    const compra_detalle = puedeAccederModulo(access, "compras") ? await query("compra_detalle", sql`select d.id,
      c.empresa_id, d.compra_id, d.producto_id, d.cantidad, d.costo_unitario, d.subtotal
      from compra_detalle d join compras c on c.id = d.compra_id join almacenes a on a.id = c.almacen_id
      where c.empresa_id = ${user.empresaId}::uuid and coalesce(c.sucursal_id, a.sucursal_id) = any(${branches})`) : [];
    const sesiones_caja = puedeAccederModulo(access, "caja") ? await query("sesiones_caja", sql`select s.id,
      s.empresa_id, c.sucursal_id, s.caja_id, s.usuario_id, s.estado, s.monto_inicial as fondo_inicial,
      s.monto_final_real as total_declarado, s.diferencia, s.abierta_en as apertura_en,
      s.cerrada_en as cierre_en, s.notas from sesiones_caja s join cajas c on c.id = s.caja_id
      where s.empresa_id = ${user.empresaId}::uuid and c.sucursal_id = any(${branches})`) : [];
    const cuentas_financieras = puedeAccederModulo(access, "tesoreria") ? await query("cuentas_financieras", cuentasConSaldoContableQuery(user.empresaId,sucursalIds)) : [];
    const gastos = puedeAccederModulo(access, "tesoreria") ? await query("gastos", sql`select g.id, g.empresa_id,
      coalesce(g.sucursal_id::text, '') as sucursal_id, coalesce(g.cuenta_financiera_id::text, '') as cuenta_id,
      c.nombre as categoria, g.descripcion, g.total as monto, g.fecha, g.usuario_id
      from gastos g join categorias_gasto c on c.id = g.categoria_id
      where g.empresa_id = ${user.empresaId}::uuid and (g.sucursal_id is null or g.sucursal_id = any(${branches}))`) : [];
    const rrhh: Record<string, unknown[]> = {};
    if (puedeAccederModulo(access, "rrhh") && access.esAdminEmpresa) {
      rrhh.empleados = [...await query("rrhh.empleados", sql`select * from empleados where empresa_id = ${user.empresaId}::uuid and eliminado_en is null and (sucursal_id is null or sucursal_id = any(${branches}))`)];
      rrhh.asistencia = [...await query("rrhh.asistencia", sql`select a.*, e.nombres || ' ' || e.apellidos as empleado from asistencias a join empleados e on e.id = a.empleado_id where a.empresa_id = ${user.empresaId}::uuid and (e.sucursal_id is null or e.sucursal_id = any(${branches}))`)];
      rrhh.nomina = [...await query("rrhh.nomina", sql`select * from nominas where empresa_id = ${user.empresaId}::uuid`)];
      rrhh.ingresos = [...await query("rrhh.ingresos", sql`select i.*, e.nombres || ' ' || e.apellidos as empleado, t.nombre as concepto from nomina_ingresos i join nomina_detalles d on d.id = i.nomina_detalle_id join empleados e on e.id = d.empleado_id join tipos_ingreso t on t.id = i.tipo_ingreso_id where i.empresa_id = ${user.empresaId}::uuid and (e.sucursal_id is null or e.sucursal_id = any(${branches}))`)];
      rrhh.deducciones = [...await query("rrhh.deducciones", sql`select i.*, e.nombres || ' ' || e.apellidos as empleado, t.nombre as concepto from nomina_deducciones i join nomina_detalles d on d.id = i.nomina_detalle_id join empleados e on e.id = d.empleado_id join tipos_deduccion t on t.id = i.tipo_deduccion_id where i.empresa_id = ${user.empresaId}::uuid and (e.sucursal_id is null or e.sucursal_id = any(${branches}))`)];
      rrhh.solicitudes = [...await query("rrhh.solicitudes", sql`select s.*, e.nombres || ' ' || e.apellidos as empleado from solicitudes_rrhh s join empleados e on e.id = s.empleado_id where s.empresa_id = ${user.empresaId}::uuid and (e.sucursal_id is null or e.sucursal_id = any(${branches}))`)];
      rrhh.detalles = await query("rrhh.detalles", sql`select d.*, e.nombres || ' ' || e.apellidos as empleado, e.puesto, e.codigo from nomina_detalles d join empleados e on e.id=d.empleado_id where d.empresa_id=${user.empresaId}::uuid and e.empresa_id=${user.empresaId}::uuid and (e.sucursal_id is null or e.sucursal_id=any(${branches}))`);
      rrhh.tipos_ingreso = await query("rrhh.tipos_ingreso", sql`select id,nombre,activo from tipos_ingreso where empresa_id=${user.empresaId}::uuid`);
      rrhh.tipos_deduccion = await query("rrhh.tipos_deduccion", sql`select id,nombre,activo from tipos_deduccion where empresa_id=${user.empresaId}::uuid`);
      rrhh.feriados = await query("rrhh.feriados", sql`select id,nombre,fecha,es_recurrente from feriados where empresa_id=${user.empresaId}::uuid`);
      rrhh.colillas = await query("rrhh.colillas", sql`select c.id,c.nomina_id,c.nomina_detalle_id,c.snapshot from nomina_colillas c join empleados e on e.id=c.empleado_id where c.empresa_id=${user.empresaId}::uuid and e.empresa_id=${user.empresaId}::uuid and (e.sucursal_id is null or e.sucursal_id=any(${branches}))`);
    }
    const settings: Record<string,unknown[]> = {};
    if(puedeAccederModulo(access,"tesoreria")) {
      settings.cuentas=await query("settings.cuentas",cuentasConSaldoContableQuery(user.empresaId,sucursalIds));
      settings.gastos_categorias=await query("settings.gastos_categorias",sql`select id,empresa_id,nombre,cuenta_contable_id,activa from categorias_gasto where empresa_id=${user.empresaId}::uuid`);
      settings.gastos_recurrentes=await query("settings.gastos_recurrentes",sql`select r.*,c.nombre as categoria,f.nombre as cuenta from gastos_recurrentes r join categorias_gasto c on c.id=r.categoria_id and c.empresa_id=r.empresa_id join cuentas_financieras f on f.id=r.cuenta_financiera_id and f.empresa_id=r.empresa_id where r.empresa_id=${user.empresaId}::uuid and (r.sucursal_id is null or r.sucursal_id=any(${branches}))`);
      settings.gastos_detalles=await query("settings.gastos_detalles",sql`select g.id,g.empresa_id,g.sucursal_id,g.categoria_id,c.nombre as categoria,g.cuenta_financiera_id,f.nombre as cuenta,g.fecha,g.descripcion,g.referencia,g.subtotal,g.impuesto,g.total,g.asiento_id,g.recurrente_id from gastos g join categorias_gasto c on c.id=g.categoria_id and c.empresa_id=g.empresa_id join cuentas_financieras f on f.id=g.cuenta_financiera_id and f.empresa_id=g.empresa_id where g.empresa_id=${user.empresaId}::uuid and (g.sucursal_id is null or g.sucursal_id=any(${branches}))`);
    }
    settings.access=previous?[]:[{id:user.id,can_manage:puedeAccederModulo(access,"configuracion")&&access.esAdminEmpresa}];
    if (puedeAccederModulo(access,"configuracion") && access.esAdminEmpresa) {
      settings.empresa = await query("settings.empresa",sql`select id,razon_social,nombre_comercial,identificacion_fiscal,pais,moneda,direccion,telefono,tipo_empresa,vertical_empresa from empresas where id=${user.empresaId}::uuid`);
      settings.empresa=settings.empresa.map((value)=>{const row=value as Record<string,unknown>;return {...row,tasa_seguridad_social:TASA_SEGURIDAD_SOCIAL[row.pais as PaisCodigo]??0};});
      settings.usuarios = await query("settings.usuarios",sql`select id,nombre,email,rol_id,activo from usuarios where empresa_id=${user.empresaId}::uuid and eliminado_en is null`);
      settings.roles = await query("settings.roles",sql`select r.id,r.nombre,r.descripcion,r.es_base,coalesce((select jsonb_agg(p.permiso_id) from rol_permisos p where p.rol_id=r.id),'[]'::jsonb) as permiso_ids from roles r where r.empresa_id=${user.empresaId}::uuid`);
      settings.permisos = await query("settings.permisos",sql`select id,clave,modulo,descripcion from permisos`);
      settings.sucursales = await query("settings.sucursales",sql`select id,codigo,nombre,direccion,telefono,activa from sucursales where empresa_id=${user.empresaId}::uuid and eliminado_en is null and id=any(${branches})`);
      settings.cajas = await query("settings.cajas",sql`select id,codigo,nombre,sucursal_id,activa from cajas where empresa_id=${user.empresaId}::uuid and sucursal_id=any(${branches})`);
      settings.impuestos = await query("settings.impuestos",sql`select id,codigo,nombre,tasa,es_retencion,activo from impuestos where empresa_id=${user.empresaId}::uuid`);
      settings.formas_pago = await query("settings.formas_pago",sql`select id,codigo,nombre,cuenta_financiera_id,requiere_referencia,activa from formas_pago where empresa_id=${user.empresaId}::uuid`);
      if(!settings.cuentas)settings.cuentas = await query("settings.cuentas",cuentasConSaldoContableQuery(user.empresaId,sucursalIds));
      settings.secuencias = await query("settings.secuencias",sql`select id,tipo_documento_id,prefijo,siguiente_numero,rango_inicial,rango_final,autorizacion,fecha_limite,activa from secuencias_fiscales where empresa_id=${user.empresaId}::uuid and (sucursal_id is null or sucursal_id=any(${branches}))`);
      settings.documentos = await query("settings.documentos",sql`select id,codigo,nombre from tipos_documento where empresa_id=${user.empresaId}::uuid`);
      settings.configuraciones = await query("settings.configuraciones",sql`select id,clave,valor from configuraciones where empresa_id=${user.empresaId}::uuid and clave in ('politicas_negocio','configuracion_negocio')`);
    }
    if (empresa) returned.add(`empresa_config:${user.empresaId}`);
    const state: DesktopCursorState = hasMore && previous ? { snapshot: previous.snapshot, until, after: String(page.at(-1)!.seq) } : { snapshot: until, after: "0" };
    const versions = previous ? page.map((row) => ({ table: String(row.entity_type), id: String(row.entity_id), version: String(row.seq) }))
      : [...await tx.execute(sql`select entity_type,entity_id,max(seq)::text as version from desktop_change_log where empresa_id=${user.empresaId}::uuid group by entity_type,entity_id`)]
        .filter((row) => returned.has(`${String(row.entity_type)}:${String(row.entity_id)}`))
        .map((row) => ({ table: String(row.entity_type), id: String(row.entity_id), version: String(row.version) }));
    const tombstones = page.filter((row) => !returned.has(`${String(row.entity_type)}:${String(row.entity_id)}`)).map((row) => ({ table: String(row.entity_type), id: String(row.entity_id), version: String(row.seq) }));
    return { empresaId: user.empresaId, delta: Boolean(previous), serverCursor: options ? signDesktopCursor(state, cursorScope) : null, hasMore, tombstones, versions,
      confirmedOperations: receipts.map((row) => ({ id:String(row.operation_id), result:row.result })),
      empresa_config: empresa && (!previous || changes.empresa_config?.includes(user.empresaId)) ? [empresa] : [], sucursales, cajas, rrhh, settings, compras, compra_detalle, sesiones_caja, cuentas_financieras, gastos,
      productos, clientes, impuestos, formas_pago, proveedores, ventas, venta_detalle, pagos_venta, movimientos_inventario, inventario_base, inventario_almacenes,transferencias_pendientes,
      facturas, cuentas_por_cobrar, cuentas_por_pagar, catalogo_cuentas, periodos_contables, asientos_contables, asiento_partidas };
  }, { isolationLevel: "repeatable read" });
}
