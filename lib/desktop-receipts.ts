import {sql} from 'drizzle-orm';
import type {Tx} from './db';
import type {SessionUser} from './actions/session-helpers';
import {validarAccion} from './server-access';
import {bindDesktopReceipt,type ReceiptIdentity} from './desktop-receipt-core';
import {currentBusinessContext,inBusinessContext} from './business-context';
type Policy=Parameters<typeof validarAccion>[1];
export type StoredReceipt={empresa_id:unknown;user_id:unknown;device_id:unknown;operation_id:unknown;idempotency_key:unknown;entity_type:unknown;entity_id:unknown;request_hash:unknown;result:unknown};
export function receiptPolicy(type:string,payload:Record<string,unknown>={}):Policy {
  const policies:Record<string,Policy>={venta:{modulo:'pos',permisos:'ventas.crear'},compra:{modulo:'compras',permisos:'compras.crear'},proveedor:{modulo:'compras',permisos:'compras.crear'},cliente:{modulo:'clientes',permisos:['ventas.crear','ventas.ver']},producto:{modulo:'inventario',permisos:'inventario.ajustar'},movimiento_inventario:{modulo:'inventario',permisos:'inventario.ajustar'},sesion_caja:{modulo:'caja',permisos:'ventas.crear'},caja_movimiento:{modulo:'caja',permisos:'ventas.crear'},abono_cliente:{modulo:'cxc',permisos:['ventas.crear','ventas.ver']},pago_proveedor:{modulo:'cxp',permisos:'compras.crear'},gasto:{modulo:'tesoreria',permisos:'tesoreria.ver'},rrhh_command:{modulo:'rrhh',soloAdmin:true}};
  if(type==='settings_command'){
    if(['crearGastoTesoreria','actualizarGastoRecurrente'].includes(String(payload.action)))return {modulo:'tesoreria',permisos:'tesoreria.ver'};
    if(['crearProveedor','actualizarProveedor'].includes(String(payload.action)))return policies.proveedor;
    if(['crearProducto','actualizarProducto'].includes(String(payload.action)))return policies.producto;
    if(payload.action==='actualizarCliente')return policies.cliente;
    return {modulo:'configuracion',soloAdmin:true};
  }
  return policies[type]??{soloAdmin:true};
}
export async function recoverDesktopReceipt(tx:Tx,user:SessionUser,deviceId:string,branches:string[],row:StoredReceipt,operation?:string):Promise<Record<string,unknown>>{
  if(!currentBusinessContext())return inBusinessContext({tx,user,invalidations:new Set()},()=>recoverDesktopReceipt(tx,user,deviceId,branches,row,operation));
  if(row.empresa_id!==user.empresaId||row.user_id!==user.id||row.device_id!==deviceId)throw new Error('Recibo no autorizado.');
  const result=row.result as Record<string,unknown>;
  if(!result||result.ok!==true)throw new Error('Recibo incompleto; requiere revisión.');
  const meta=result.receipt as Record<string,unknown>|undefined;
  const policy=(meta?.policy??receiptPolicy(String(row.entity_type))) as Policy;
  const access=await validarAccion(user,policy);if(!access.ok)throw new Error(access.error);
  const [actor]=await tx.execute(sql`select u.id from usuarios u join empresas e on e.id=u.empresa_id where u.id=${user.id}::uuid and u.empresa_id=${user.empresaId}::uuid and u.activo and u.eliminado_en is null and e.activa`);
  if(!actor||!branches.length)throw new Error('Usuario o sucursal no autorizados.');
  let branch=typeof meta?.branch==='string'?meta.branch:null;
  const sources:Record<string,string>={venta:'select sucursal_id,asiento_id from ventas where id=$ID',compra:'select coalesce(c.sucursal_id,a.sucursal_id) as sucursal_id,c.asiento_id from compras c join almacenes a on a.id=c.almacen_id where c.id=$ID',abono_cliente:'select v.sucursal_id,p.asiento_id from abonos_cliente p join cuentas_por_cobrar c on c.id=p.cxc_id join ventas v on v.id=c.venta_id where p.id=$ID',pago_proveedor:'select coalesce(v.sucursal_id,a.sucursal_id) as sucursal_id,p.asiento_id from pagos_proveedor p join cuentas_por_pagar c on c.id=p.cxp_id join compras v on v.id=c.compra_id join almacenes a on a.id=v.almacen_id where p.id=$ID',gasto:'select sucursal_id,asiento_id from gastos where id=$ID',sesion_caja:'select c.sucursal_id from sesiones_caja s join cajas c on c.id=s.caja_id where s.id=$ID',caja_movimiento:'select sucursal_id from caja_movimientos where origen_tipo=\'movimiento\' and origen_id=$ID'};
  const source=sources[String(row.entity_type)];
  let value={...result};delete value.receipt;
  if(source){
    // Statement fragments are constant; the UUID is always bound.
    const alias=({venta:'ventas',compra:'c',abono_cliente:'p',pago_proveedor:'p',gasto:'gastos',sesion_caja:'s',caja_movimiento:'caja_movimientos'} as Record<string,string>)[String(row.entity_type)];
    const [record]=await tx.execute(sql`${sql.raw(source.split('$ID')[0])}${String(row.entity_id)}::uuid AND ${sql.raw(alias)}.empresa_id=${user.empresaId}::uuid`);
    if(!record)throw new Error('Documento original no disponible.');
    branch=record.sucursal_id?String(record.sucursal_id):branch;
    if(['venta','compra','abono_cliente','pago_proveedor'].includes(String(row.entity_type))){
      const [journal]=await tx.execute(sql`select a.id,a.total_debe,a.total_haber,count(p.id)::int as partidas,coalesce(sum(p.debe),0) as debe,coalesce(sum(p.haber),0) as haber from asientos_contables a left join asiento_partidas p on p.asiento_id=a.id where a.id=${String(record.asiento_id)}::uuid and a.empresa_id=${user.empresaId}::uuid and a.referencia_id=${String(row.entity_id)}::uuid group by a.id`);
      if(!journal||Number(journal.partidas)<1||Math.abs(Number(journal.debe)-Number(journal.haber))>0.0001||Math.abs(Number(journal.debe)-Number(journal.total_debe))>0.0001||Math.abs(Number(journal.haber)-Number(journal.total_haber))>0.0001)throw new Error('El asiento original no se pudo confirmar íntegramente.');
      value={...value,asientoId:String(journal.id)};
    }
  }
  if(branch&&!branches.includes(branch))throw new Error('Sucursal del recibo no autorizada.');
  if(!meta&&!source&&['settings_command','rrhh_command','movimiento_inventario'].includes(String(row.entity_type))){
    const all=await tx.execute(sql`select id from sucursales where empresa_id=${user.empresaId}::uuid and activa and eliminado_en is null`);
    if(all.some(item=>!branches.includes(String(item.id))))throw new Error('El recibo antiguo requiere revisión de alcance.');
  }
  const identity:ReceiptIdentity={empresaId:user.empresaId,userId:user.id,deviceId,operationId:String(row.operation_id),idempotencyKey:String(row.idempotency_key),entityType:String(row.entity_type),entityId:String(row.entity_id),operation:operation??String(meta?.operation??'create'),requestHash:String(row.request_hash)};
  return bindDesktopReceipt(value,identity,branch,policy as Record<string,unknown>);
}
