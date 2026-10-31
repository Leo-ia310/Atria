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
    const proveedores = puedeAccederModulo(access, "compras") ? await tx.execute(sql`select id, empresa_id, nombre, identificacion_fiscal, telefono, email, activo, eliminado_en from proveedores where empresa_id = ${user.empresaId}::uuid`) : [];
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
    return { empresaId: user.empresaId, empresa_config: empresa ? [empresa] : [], sucursales,
      productos, clientes, impuestos, formas_pago, proveedores, ventas, venta_detalle, pagos_venta, movimientos_inventario };
  });
}
