"use server";
import { sql,eq } from "drizzle-orm";
import { dbConEmpresa } from "../db";
import { requireSession,type SessionUser } from "./session-helpers";
import { validarAccion } from "../server-access";
import { executeBusinessAction,revalidateBusinessPath } from "../business-action";
import { currentBusinessContext } from "../business-context";
import { getSucursalScope } from "../sucursal-scope";
import { resolveTransferSchema,type PendingTransfer } from "../pending-transfer";
import { registrarAbono } from "./cxc";
import { fechaISOEnZona } from "../dates";
import { empresas } from "../db/schema";

async function branchesFor(user:SessionUser){
  const scope=currentBusinessContext()?.sucursalIds ?? (await getSucursalScope(user)).sucursalIds;
  const assigned=await dbConEmpresa(user.empresaId,(tx)=>tx.execute(sql`select s.id from usuario_sucursales u join sucursales s on s.id=u.sucursal_id where u.usuario_id=${user.id}::uuid and s.empresa_id=${user.empresaId}::uuid`));
  return assigned.length?scope.filter((id)=>assigned.some((row)=>row.id===id)):scope;
}

export async function listarTransferenciasPendientes():Promise<{ok:true;rows:PendingTransfer[]}|{ok:false;error:string}>{
  const user=await requireSession();const access=await validarAccion(user,{modulo:"tesoreria",permisos:"tesoreria.ver"});if(!access.ok)return access;
  const branches=await branchesFor(user);
  const rows=await dbConEmpresa(user.empresaId,(tx)=>tx.execute(sql`select t.*,v.numero,c.nombre as cliente from transferencias_pendientes t join ventas v on v.id=t.venta_id and v.empresa_id=t.empresa_id left join clientes c on c.id=v.cliente_id and c.empresa_id=t.empresa_id where t.empresa_id=${user.empresaId}::uuid and t.sucursal_id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(branches)}::jsonb)::uuid)) and t.status='pending_verification' order by t.created_at,t.id limit 250`));
  return {ok:true,rows:rows.map((row)=>({id:String(row.id),empresaId:user.empresaId,sucursalId:String(row.sucursal_id),ventaId:String(row.venta_id),formaPagoId:String(row.forma_pago_id),monto:Number(row.monto),referencia:String(row.referencia),status:row.status as PendingTransfer["status"],version:Number(row.version),createdAt:new Date(String(row.created_at)).toISOString(),clienteNombre:String(row.cliente??""),numeroVenta:String(row.numero)}))};
}

export async function resolverTransferencia(input:unknown):Promise<{ok:true;abonoId?:string}|{ok:false;error:string}>{
  const user=await requireSession();
  return executeBusinessAction(user,async()=>{
    for(const rule of [{modulo:"tesoreria" as const,permisos:"tesoreria.ver"},{modulo:"cxc" as const,permisos:["ventas.crear","ventas.ver"]}]){const access=await validarAccion(user,rule);if(!access.ok)return access;}
    const parsed=resolveTransferSchema.safeParse(input);if(!parsed.success)return {ok:false,error:parsed.error.issues[0]?.message??"Solicitud inválida."};
    const value=parsed.data,branches=await branchesFor(user);
    try{
      return await dbConEmpresa(user.empresaId,async(tx)=>{
        const [pending]=await tx.execute(sql`select * from transferencias_pendientes where id=${value.id}::uuid and empresa_id=${user.empresaId}::uuid for update`);
        if(!pending||!branches.includes(String(pending.sucursal_id)))throw new Error("Transferencia no autorizada para esta sucursal.");
        if(pending.status!=="pending_verification"||Number(pending.version)!==value.expectedVersion)throw new Error("La transferencia cambió o ya fue resuelta. Actualiza los datos.");
        let abonoId:string|undefined,accountId:string|undefined;
        const bankReference=value.bankReference.trim().toUpperCase();
        if(value.decision==="verify"){
          const [method]=await tx.execute(sql`select f.cuenta_financiera_id from formas_pago f join cuentas_financieras c on c.id=f.cuenta_financiera_id and c.empresa_id=f.empresa_id where f.id=${String(pending.forma_pago_id)}::uuid and f.empresa_id=${user.empresaId}::uuid and f.activa and upper(f.codigo) in ('TRA','TRANSFERENCIA') and c.activa and c.tipo='banco' and (c.sucursal_id is null or c.sucursal_id=${String(pending.sucursal_id)}::uuid)`);
          if(!method)throw new Error("La transferencia requiere una forma bancaria y cuenta activa de esta sucursal.");accountId=String(method.cuenta_financiera_id);
          const duplicate=await tx.execute(sql`select id from transferencias_pendientes where empresa_id=${user.empresaId}::uuid and cuenta_financiera_id=${accountId}::uuid and bank_reference=${bankReference} and status='verified'`);
          if(duplicate.length)throw new Error("Esta referencia bancaria ya fue verificada.");
          const receivables=await tx.execute(sql`select id from cuentas_por_cobrar where empresa_id=${user.empresaId}::uuid and venta_id=${String(pending.venta_id)}::uuid`);
          if(receivables.length!==1)throw new Error("La cuenta por cobrar requiere revisión antes de verificar.");
          const [company]=await tx.select({zona:empresas.zonaHoraria}).from(empresas).where(eq(empresas.id,user.empresaId));
          const result=await registrarAbono({cxcId:receivables[0].id,formaPagoId:pending.forma_pago_id,monto:Number(pending.monto),fecha:fechaISOEnZona(new Date(),company?.zona||"America/Managua"),referencia:bankReference,notas:`Verificación de transferencia ${value.id}`});
          if(!result.ok)throw new Error(result.error);abonoId=result.abonoId;
        }
        await tx.execute(sql`update transferencias_pendientes set status=${value.decision==="verify"?"verified":"rejected"},version=version+1,bank_reference=${value.decision==="verify"?bankReference:null},cuenta_financiera_id=${accountId??null}::uuid,resolution_reason=${value.reason||null},abono_id=${abonoId??null}::uuid,resolved_by=${user.id}::uuid,resolved_at=now() where id=${value.id}::uuid and empresa_id=${user.empresaId}::uuid`);
        const [document]=await tx.execute(sql`select id,snapshot from facturas where venta_id=${String(pending.venta_id)}::uuid and empresa_id=${user.empresaId}::uuid for update`);
        if(document){const snapshot=document.snapshot as Record<string,unknown>;const pagos=Array.isArray(snapshot.pagos)?snapshot.pagos as Record<string,unknown>[]:[];await tx.execute(sql`update facturas set snapshot=${JSON.stringify({...snapshot,pagos:pagos.map((payment)=>payment.transferId===value.id?{...payment,paymentStatus:value.decision==="verify"?"verified":"rejected",bankReference:bankReference||null}:payment)})}::jsonb where id=${String(document.id)}::uuid and empresa_id=${user.empresaId}::uuid`);}
        revalidateBusinessPath("/tesoreria");revalidateBusinessPath("/facturas");revalidateBusinessPath("/facturas/cobradas");revalidateBusinessPath("/cxc");revalidateBusinessPath("/ventas");
        return {ok:true as const,abonoId};
      });
    }catch(error){return {ok:false,error:error instanceof Error?error.message:"No se pudo resolver la transferencia."};}
  });
}
