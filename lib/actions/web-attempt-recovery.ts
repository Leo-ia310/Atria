"use server";
import {z} from 'zod';
import {sql} from 'drizzle-orm';
import {requireSession} from './session-helpers';
import {executeBusinessAction} from '../business-action';
import {dbConEmpresa} from '../db';
import {validarAccion} from '../server-access';
const schema=z.object({kind:z.enum(['venta','compra','compra_lector']),key:z.string().uuid(),discard:z.boolean().optional()});
export async function recoverWebAttempt(input:unknown){
  const value=schema.parse(input),user=await requireSession();
  return executeBusinessAction(user,async()=>{
    const [actor]=await dbConEmpresa(user.empresaId,tx=>tx.execute(sql`select u.id from usuarios u join empresas e on e.id=u.empresa_id where u.id=${user.id}::uuid and u.empresa_id=${user.empresaId}::uuid and u.activo and u.eliminado_en is null and e.activa`));
    if(!actor)return {ok:false as const,error:'La sesión ya no está autorizada.'};
    const access=await validarAccion(user,value.kind==='venta'?{modulo:'pos',permisos:'ventas.crear'}:{modulo:'compras',permisos:'compras.crear'});
    if(!access.ok)return access;
    return dbConEmpresa(user.empresaId,async tx=>{
      const [row]=await tx.execute(sql`select result from web_operation_attempts where empresa_id=${user.empresaId}::uuid and user_id=${user.id}::uuid and kind=${value.kind} and attempt_key=${value.key}::uuid`);
      if(row){
        const result=row.result as Record<string,unknown>;
        if(result.discarded===true)return {ok:true as const,state:'discarded' as const};
        const id=result.ventaId??result.compraId;
        if(typeof id!=='string')return {ok:false as const,error:'El resultado requiere revisión antes de continuar.'};
        const source=value.kind==='venta'?sql`select sucursal_id from ventas where id=${id}::uuid and empresa_id=${user.empresaId}::uuid`:sql`select coalesce(c.sucursal_id,a.sucursal_id) as sucursal_id from compras c join almacenes a on a.id=c.almacen_id where c.id=${id}::uuid and c.empresa_id=${user.empresaId}::uuid`;
        const [doc]=await tx.execute(source);
        const assigned=await tx.execute(sql`select u.sucursal_id from usuario_sucursales u join sucursales s on s.id=u.sucursal_id where u.usuario_id=${user.id}::uuid and s.empresa_id=${user.empresaId}::uuid`);
        if(!doc||assigned.length&&!assigned.some(branch=>branch.sucursal_id===doc.sucursal_id))return {ok:false as const,error:'Sucursal del intento no autorizada.'};
        if(result.pendienteVerificacion){const extra=await validarAccion(user,{modulo:'cxc',permisos:['ventas.ver','ventas.crear']});if(!extra.ok)return extra;}
        return {ok:true as const,state:'confirmed' as const,result};
      }
      if(value.discard){
        // A tombstone under the same root lock prevents a delayed original request from committing later.
        await tx.execute(sql`insert into web_operation_attempts(empresa_id,user_id,kind,attempt_key,request_hash,result) values(${user.empresaId}::uuid,${user.id}::uuid,${value.kind},${value.key}::uuid,'discarded','{"ok":false,"discarded":true,"error":"Intento descartado explícitamente. Inicia una operación nueva."}'::jsonb)`);
        return {ok:true as const,state:'discarded' as const};
      }
      return {ok:true as const,state:'pending' as const};
    });
  });
}
