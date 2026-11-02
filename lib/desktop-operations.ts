import { createHash } from "node:crypto";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { dbConEmpresa, type Tx } from "./db";
import { inBusinessContext, currentBusinessContext } from "./business-context";
import { flushBusinessInvalidations } from "./business-action";
import type { SessionUser } from "./actions/session-helpers";
import { crearCliente, actualizarCliente } from "./actions/clientes";
import { crearProveedor } from "./actions/proveedores";
import { crearProducto, registrarEntradaInventarioPorLector } from "./actions/productos";
import { procesarVenta } from "./actions/ventas";
import { procesarCompra } from "./actions/compras";
import { abrirSesion, cerrarSesion } from "./actions/caja";
import { crearGasto } from "./actions/tesoreria";
import { registrarAbono } from "./actions/cxc";
import { registrarPago } from "./actions/cxp";
import { executeDesktopRrhh, DesktopRrhhRejected } from "./desktop-rrhh";
import { executeDesktopSettings, DesktopSettingsRejected } from "./desktop-settings";
import { manualPaymentEvidenceSchema, preparePosPayment } from "./pos-payment";

export const desktopOperationSchema = z.object({ id: z.string().uuid(), idempotencyKey: z.string().min(1).max(200),
  entityType: z.string().max(80), entityId: z.string().uuid(), operation: z.enum(["create","update","command","delete"]),
  payload: z.record(z.unknown()), empresaId: z.string().optional().nullable(), sucursalId: z.string().optional().nullable(),
  usuarioId: z.string().optional().nullable(), dependsOn: z.array(z.string().uuid()).max(300).default([]) });
export type DesktopOperation = z.infer<typeof desktopOperationSchema>;
export class DesktopOperationError extends Error {
  constructor(message: string, readonly code = "BUSINESS_RULE", readonly retryable = false) { super(message); }
}
const uuid = z.string().uuid();
const text = (v: unknown) => typeof v === "string" ? v : "";
const number = (v: unknown) => z.coerce.number().finite().parse(v);
const money = (v: number) => Math.round(v * 100) / 100;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => [key,canonical(item)]));
  return value;
}

export function operationPriority(op: DesktopOperation): number {
  if (["cliente","producto","proveedor"].includes(op.entityType)) return 10;
  if (op.entityType === "sesion_caja") return op.operation === "create" ? 20 : 90;
  if (op.entityType === "movimiento_inventario") return 30;
  return 40;
}

async function dispatch(tx: Tx, user: SessionUser, op: DesktopOperation, branches: string[]): Promise<{ ok: boolean; error?: string }> {
  const p = op.payload;
  if (op.empresaId && op.empresaId !== user.empresaId || op.usuarioId && op.usuarioId !== user.id) throw new DesktopOperationError("El contexto de la operación no coincide con la sesión.", "TENANT_MISMATCH");
  const branch = text(op.sucursalId) || text(p.sucursalId);
  if (branch && !branches.includes(branch)) throw new DesktopOperationError("Sucursal no autorizada.", "BRANCH_DENIED");
  let almacenId = text(p.almacenId);
  if (!almacenId && branch && ["venta","compra","movimiento_inventario"].includes(op.entityType)) {
    const rows = await tx.execute(sql`select id from almacenes where empresa_id=${user.empresaId}::uuid and sucursal_id=${branch}::uuid and activo=true`);
    if (rows.length === 1) almacenId = String(rows[0].id);
  }
  if (almacenId) {
    uuid.parse(almacenId);
    const rows = await tx.execute(sql`select sucursal_id from almacenes where id=${almacenId}::uuid and empresa_id=${user.empresaId}::uuid and activo=true`);
    if (!rows.length || !branches.includes(String(rows[0].sucursal_id)) || branch && branch !== String(rows[0].sucursal_id)) throw new DesktopOperationError("Almacén no autorizado.", "WAREHOUSE_DENIED");
  }
  if (almacenId && ["venta","compra","movimiento_inventario"].includes(op.entityType)) {
    const products = op.entityType === "movimiento_inventario" ? [uuid.parse(p.productoId)] : z.array(z.object({productoId:uuid}).passthrough()).parse(p.lines).map((line) => line.productoId);
    const effects = currentBusinessContext()?.effects;
    if (effects) effects.stockPairs = products.map((productoId) => ({productoId,almacenId}));
  }
  switch (op.entityType) {
    case "settings_command": {
      try {return await executeDesktopSettings(tx,user,branches,p);}
      catch(error){if(error instanceof DesktopSettingsRejected)throw new DesktopOperationError(error.message,"SETTINGS_ACCESS_DENIED");throw error;}
    }
    case "rrhh_command": {
      try { return await executeDesktopRrhh(tx,user,branches,p); }
      catch(error) { if(error instanceof DesktopRrhhRejected) throw new DesktopOperationError(error.message,"HR_ACCESS_DENIED"); throw error; }
    }
    case "cliente": {
      let input: Record<string,unknown> = { ...p, identificacionFiscal: p.identificacionFiscal ?? "", email: p.email ?? "", telefono: p.telefono ?? "" };
      if (op.operation === "create") return crearCliente(input);
      if (op.operation === "update") {
        const expected = z.string().regex(/^\d+$/).safeParse(p.serverVersionExpected);
        if (!expected.success) throw new DesktopOperationError("La edición requiere la versión descargada del cliente.","VERSION_REQUIRED");
        const [version] = await tx.execute(sql`select coalesce(max(seq),0)::text as version from desktop_change_log where empresa_id=${user.empresaId}::uuid and entity_type='clientes' and entity_id=${op.entityId}`);
        if (String(version.version)!==expected.data) throw new DesktopOperationError("El cliente cambió en otro equipo. Descarga la versión actual antes de editarlo.","VERSION_CONFLICT");
        const [row] = await tx.execute(sql`select nombre,identificacion_fiscal,email,telefono,direccion,limite_credito,dias_credito,es_consumidor_final,notas from clientes where id=${op.entityId}::uuid and empresa_id=${user.empresaId}::uuid and eliminado_en is null`);
        if (!row) throw new DesktopOperationError("El cliente ya no está disponible.","RECORD_DELETED");
        input = { nombre:row.nombre,identificacionFiscal:row.identificacion_fiscal ?? "",email:row.email ?? "",telefono:row.telefono ?? "",direccion:row.direccion ?? "",limiteCredito:row.limite_credito,diasCredito:row.dias_credito,esConsumidorFinal:row.es_consumidor_final,notas:row.notas ?? "",
          ...Object.fromEntries(Object.entries(p).filter(([key])=>["nombre","identificacionFiscal","email","telefono","direccion","notas"].includes(key))) };
        return actualizarCliente(op.entityId,input);
      }
      break;
    }
    case "proveedor": return crearProveedor({ ...p, razonSocial: p.razonSocial ?? p.nombre, email: p.email ?? "", telefono: p.telefono ?? "", identificacionFiscal: p.identificacionFiscal ?? "" });
    case "producto": {
      let impuestoId = text(p.impuestoId);
      if (!impuestoId && number(p.impuestoTasa ?? 0) > 0) {
        const rates = await tx.execute(sql`select id from impuestos where empresa_id=${user.empresaId}::uuid and activo=true and tasa=${number(p.impuestoTasa)}`);
        if (rates.length !== 1) throw new DesktopOperationError("Selecciona un impuesto vigente del catálogo antes de sincronizar el producto.", "TAX_CONFLICT");
        impuestoId = String(rates[0].id);
      }
      if (impuestoId) {
        uuid.parse(impuestoId);
        if (!(await tx.execute(sql`select id from impuestos where id=${impuestoId}::uuid and empresa_id=${user.empresaId}::uuid and activo=true`)).length) throw new DesktopOperationError("Impuesto no autorizado.", "TAX_CONFLICT");
      }
      return crearProducto({ ...p, impuestoId, codigoBarras: p.codigoBarras ?? "" });
    }
    case "movimiento_inventario": {
      if (p.tipo !== "ajuste_entrada_inicial" || number(p.cantidad) <= 0) break;
      const id = uuid.parse(p.productoId);
      const [product] = await tx.execute(sql`select codigo_barras, precio_base,costo_promedio from productos where id=${id}::uuid and empresa_id=${user.empresaId}::uuid and activo=true and eliminado_en is null`);
      if (!product) throw new DesktopOperationError("El producto aún no está disponible.", "DEPENDENCY_PENDING", true);
      return registrarEntradaInventarioPorLector({ productoId: id, almacenId, codigoBarras: product.codigo_barras ?? "", cantidad: p.cantidad, precioBase: product.precio_base, costoPromedio: product.costo_promedio });
    }
    case "sesion_caja": {
      if (op.operation === "update") {
        const rows = await tx.execute(sql`select c.sucursal_id from sesiones_caja s join cajas c on c.id=s.caja_id where s.id=${op.entityId}::uuid and s.empresa_id=${user.empresaId}::uuid`);
        if (!rows.length || !branches.includes(String(rows[0].sucursal_id))) throw new DesktopOperationError("La sesión de caja no está disponible.", "CASH_DENIED");
        return cerrarSesion({ sesionId: op.entityId, montoFinalReal: p.totalDeclarado, notas: p.notas ?? "" });
      }
      const cajaId = uuid.parse(p.cajaId);
      const rows = await tx.execute(sql`select sucursal_id from cajas where id=${cajaId}::uuid and empresa_id=${user.empresaId}::uuid and activa=true`);
      if (!rows.length || !branches.includes(String(rows[0].sucursal_id))) throw new DesktopOperationError("Caja no autorizada.", "CASH_DENIED");
      return abrirSesion({ cajaId, montoInicial: p.fondoInicial });
    }
    case "venta": {
      if (op.operation !== "create") break;
      const lines = z.array(z.object({ productoId: uuid, cantidad: z.number().positive(), precioUnitario: z.number().nonnegative(), descuento: z.number().nonnegative(), impuesto: z.number().nonnegative(), costoUnitario: z.number().nonnegative() }).passthrough()).min(1).max(100).parse(p.lines);
      const payments = z.array(manualPaymentEvidenceSchema.extend({ formaPagoId: uuid, monto: z.number().positive(), referencia: z.string().nullable().optional() }).passthrough()).max(10).parse(p.payments ?? []);
      for (const payment of payments) {
        const [method] = await tx.execute(sql`select codigo from formas_pago where id=${payment.formaPagoId}::uuid and empresa_id=${user.empresaId}::uuid and activa=true`);
        if (!method) throw new DesktopOperationError("Forma de pago no autorizada.", "PAYMENT_DENIED");
        try { Object.assign(payment,preparePosPayment(String(method.codigo),payment)); }
        catch (error) { throw new DesktopOperationError(error instanceof Error ? error.message : "Pago sin confirmación.","PAYMENT_VERIFICATION_REQUIRED"); }
      }
      const esCredito = typeof p.esCredito === "boolean" ? p.esCredito : payments.length === 0;
      if (esCredito && payments.length) throw new DesktopOperationError("Una venta al crédito no puede incluir pagos confirmados.","PAYMENT_VERIFICATION_REQUIRED");
      // Sale stock and accounting share the web transaction. No absolute-stock writes.
      return procesarVenta({ sucursalId: branch, almacenId, clienteId: p.clienteId ?? "", items: lines, pagos: payments.map((item) => ({ ...item, referencia: item.referencia ?? "" })), esCredito, diasCredito: p.diasCredito ?? 0, notas: p.notas ?? "" });
    }
    case "compra": {
      const lines = z.array(z.object({ productoId: uuid, cantidad: z.number().positive(), costoUnitario: z.number().nonnegative() })).min(1).max(200).parse(p.lines);
      const totalBase = lines.reduce((sum,line) => sum + line.cantidad * line.costoUnitario,0);
      let assignedTax = 0;
      const items = lines.map((line,index) => { const impuesto = index === lines.length-1 ? money(number(p.impuesto ?? 0)-assignedTax) : money(number(p.impuesto ?? 0) * line.cantidad * line.costoUnitario / Math.max(totalBase,0.01)); assignedTax += impuesto; return { ...line, impuesto }; });
      return procesarCompra({ proveedorId: p.proveedorId, almacenId, fecha: text(p.fecha).slice(0,10), numeroFactura: p.numeroLocal ?? "", esCredito: p.esCredito ?? true, diasCredito: p.diasCredito ?? 30, items });
    }
    case "gasto": {
      const category = await tx.execute(sql`select id from categorias_gasto where empresa_id=${user.empresaId}::uuid and activa=true and nombre=${text(p.categoria)}`);
      if (category.length !== 1) throw new DesktopOperationError("Selecciona una categoría de gasto del servidor.", "CATEGORY_CONFLICT");
      return crearGasto({ categoriaId: category[0].id, cuentaFinancieraId: p.cuentaId, fecha: text(p.fecha).slice(0,10), descripcion: p.descripcion, subtotal: p.monto, impuesto: 0 });
    }
    case "abono_cliente": {
      const [method] = await tx.execute(sql`select codigo from formas_pago where id=${uuid.parse(p.formaPagoId)}::uuid and empresa_id=${user.empresaId}::uuid and activa=true`);
      if (method?.codigo !== "EFE") throw new DesktopOperationError("El cobro requiere una forma de efectivo autorizada.", "PAYMENT_VERIFICATION_REQUIRED");
      return registrarAbono({ ...p, fecha: text(p.fecha).slice(0,10) });
    }
    case "pago_proveedor": {
      const [account] = await tx.execute(sql`select tipo from cuentas_financieras where id=${uuid.parse(p.cuentaFinancieraId)}::uuid and empresa_id=${user.empresaId}::uuid and activa=true`);
      if (account?.tipo !== "caja") throw new DesktopOperationError("Este pago requiere conexión y verificación bancaria.", "PAYMENT_VERIFICATION_REQUIRED");
      return registrarPago({ ...p, fecha: text(p.fecha).slice(0,10) });
    }
  }
  throw new DesktopOperationError("La operación requiere una versión compatible de ARCA.", "UNSUPPORTED_OPERATION");
}

export async function applyDesktopOperation(user: SessionUser, deviceId: string, branches: string[], op: DesktopOperation) {
  const requestHash = createHash("sha256").update(JSON.stringify(canonical([op.entityType,op.entityId,op.operation,op.payload]))).digest("hex");
  const invalidations = new Set<string>();
  const result = await dbConEmpresa(user.empresaId, async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`arca-business:${user.empresaId}`},0))`);
    const [existing] = await tx.execute(sql`select request_hash,device_id,user_id,result from desktop_operations where empresa_id=${user.empresaId}::uuid and idempotency_key=${op.idempotencyKey}`);
    if (existing) {
      if (existing.request_hash !== requestHash || existing.device_id !== deviceId || existing.user_id !== user.id) throw new DesktopOperationError("La clave de idempotencia ya corresponde a otra operación.", "IDEMPOTENCY_CONFLICT");
      return existing.result;
    }
    if (op.dependsOn.length) {
      const dependencies = await tx.execute(sql`select distinct operation_id from desktop_operations where empresa_id=${user.empresaId}::uuid and operation_id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(op.dependsOn)}::jsonb)))`);
      if (dependencies.length !== new Set(op.dependsOn).size) throw new DesktopOperationError("Esperando operaciones previas.", "DEPENDENCY_PENDING", true);
    }
    const localIds = z.record(z.array(z.string().uuid()).max(1000)).optional().parse(op.payload.localIds);
    const eventValue = op.payload.fecha ?? op.payload.aperturaEn ?? op.payload.cierreEn;
    const eventDate = typeof eventValue === "string" ? new Date(z.string().datetime().parse(eventValue)) : undefined;
    if (eventDate && eventDate.getTime() > Date.now() + 60000) throw new DesktopOperationError("La fecha del equipo está adelantada. Revisa el reloj y la operación.", "CLOCK_CONFLICT");
    const effects = { stockPairs: [] as Array<{productoId:string;almacenId:string}> };
    const value = await inBusinessContext({ user, tx, invalidations, localIds, eventDate, effects, identity: { type: op.entityType, id: op.entityId }, sucursalIds: text(op.sucursalId) ? [text(op.sucursalId)] : branches }, () => dispatch(tx,user,op,branches));
    if (!value.ok) throw new DesktopOperationError(value.error ?? "La operación no cumple las reglas actuales de ARCA.");
    await tx.execute(sql`insert into desktop_operations(empresa_id,idempotency_key,operation_id,device_id,user_id,entity_type,entity_id,request_hash,result,stock_pairs)
      values(${user.empresaId}::uuid,${op.idempotencyKey},${op.id},${deviceId}::uuid,${user.id}::uuid,${op.entityType},${op.entityId}::uuid,${requestHash},${JSON.stringify(value)}::jsonb,${JSON.stringify(effects.stockPairs)}::jsonb)`);
    await tx.execute(sql`update desktop_devices set last_sync_at=now() where empresa_id=${user.empresaId}::uuid and device_id=${deviceId}::uuid`);
    return value;
  });
  flushBusinessInvalidations(invalidations);
  return result;
}
