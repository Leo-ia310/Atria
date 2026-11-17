import {createHash} from 'node:crypto';
export function canonicalReceipt(value:unknown):unknown {
  if(Array.isArray(value))return value.map(canonicalReceipt);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonicalReceipt(item)]));
  return value;
}
export const receiptHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(canonicalReceipt(value))).digest('hex');
export type ReceiptIdentity={empresaId:string;userId:string;deviceId:string;operationId:string;idempotencyKey:string;entityType:string;entityId:string;operation:string;requestHash:string};
export function bindDesktopReceipt(result:Record<string,unknown>,identity:ReceiptIdentity,branch:string|null=null,policy?:Record<string,unknown>){
  const {receipt:_old,...value}=result;void _old;
  return {...value,receipt:{version:1,...identity,resultHash:receiptHash(value),branch,policy}};
}
export function validDesktopReceipt(result:unknown,expected:ReceiptIdentity):boolean {
  if(!result||typeof result!=='object')return false;
  const {receipt,...value}=result as Record<string,unknown>;
  if(value.ok!==true||!receipt||typeof receipt!=='object')return false;
  const meta=receipt as Record<string,unknown>;
  if(meta.version!==1||meta.resultHash!==receiptHash(value)||Object.entries(expected).some(([key,item])=>meta[key]!==item))return false;
  const fields:Record<string,string>={venta:'ventaId',compra:'compraId',abono_cliente:'abonoId',pago_proveedor:'pagoId'};
  if(fields[expected.entityType]&&value[fields[expected.entityType]]!==expected.entityId)return false;
  return !['venta','compra','abono_cliente','pago_proveedor'].includes(expected.entityType)||typeof value.asientoId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.asientoId);
}
