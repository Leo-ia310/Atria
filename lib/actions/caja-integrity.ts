"use server";

import { z } from "zod";
import { sql } from "drizzle-orm";
import { executeBusinessAction, revalidateBusinessPath } from "../business-action";
import { currentBusinessContext, businessEntityId } from "../business-context";
import { requireSession } from "./session-helpers";
import { validarAccion } from "../server-access";
import { dbConEmpresa } from "../db";
import { cashSession, cashEntry, cashTotals } from "../cash-service";

const movementSchema=z.object({
  id:z.string().uuid(),sesionId:z.string().uuid(),
  tipo:z.enum(["entrada","salida","retiro","devolucion"]),
  monto:z.coerce.number().finite().positive().max(999999999),
  motivo:z.string().trim().min(3).max(300),ventaId:z.string().uuid().optional(),
});
export async function registrarMovimientoCaja(input:unknown) {
  const user=await requireSession();
  return executeBusinessAction(user,async()=>{
    const permission=await validarAccion(user,{modulo:"caja",permisos:"ventas.crear"});
    if(!permission.ok)return permission;
    const value=movementSchema.parse(input);
    const session=await cashSession(user,value.sesionId);
    const origin=businessEntityId("caja_movimiento")??value.id;
    const signed=["entrada"].includes(value.tipo)?value.monto:-value.monto;
    const existing=await dbConEmpresa(user.empresaId,tx=>tx.execute(sql`select * from caja_movimientos where empresa_id=${user.empresaId}::uuid and origen_tipo='movimiento' and origen_id=${origin}::uuid`));
    if(existing.length){
      const row=existing[0],detail=row.detalle as Record<string,unknown>;
      if(row.sesion_id!==session.id || row.usuario_id!==user.id || Number(row.monto)!==signed ||
        row.tipo!==value.tipo || detail.motivo!==value.motivo || (detail.ventaId??null)!==(value.ventaId??null)) {
        return {ok:false as const,error:"El identificador ya corresponde a otro movimiento."};
      }
      return {ok:true as const,id:String(row.id)};
    }
    if(session.estado!=="abierta" && currentBusinessContext()?.identity?.type!=="caja_movimiento")return {ok:false as const,error:"El turno ya fue cerrado."};
    if(value.tipo==="devolucion"){
      if(!value.ventaId)return {ok:false as const,error:"Selecciona la venta del reintegro de efectivo."};
      // Different physical boxes may refund the same sale concurrently; serialize on its source document.
      const [sale]=await dbConEmpresa(user.empresaId,tx=>tx.execute(sql`select id from ventas where id=${value.ventaId}::uuid and empresa_id=${user.empresaId}::uuid and sucursal_id=${session.sucursal_id}::uuid for update`));
      if(!sale)return {ok:false as const,error:"Venta no disponible en esta sucursal."};
      const [cash]=await dbConEmpresa(user.empresaId,tx=>tx.execute(sql`
        select coalesce(sum(p.monto),0) as pagado,
          (select coalesce(-sum(m.monto),0) from caja_movimientos m
            where m.empresa_id=${user.empresaId}::uuid and m.tipo='devolucion' and m.detalle->>'ventaId'=${value.ventaId}) as devuelto
        from pagos_venta p join ventas v on v.id=p.venta_id
          join formas_pago f on f.id=p.forma_pago_id and f.empresa_id=v.empresa_id
        where v.id=${value.ventaId}::uuid and v.empresa_id=${user.empresaId}::uuid and v.sucursal_id=${session.sucursal_id}::uuid
          and (p.payment_source='cash' or (p.payment_source='legacy' and upper(f.codigo) in ('EFE','EFECTIVO')))
      `));
      if(value.monto>Number(cash.pagado)-Number(cash.devuelto)+0.0001)return {ok:false as const,error:"El reintegro supera el efectivo cobrado disponible."};
    }
    const entry=await cashEntry(user,session,"movimiento",origin,signed,{motivo:value.motivo,ventaId:value.ventaId??null},value.tipo);
    revalidateBusinessPath("/caja");
    revalidateBusinessPath(`/caja/${session.id}`);
    return {ok:true as const,id:entry.id};
  });
}
export async function estadoTurnoCaja(sesionId:string) {
  const user=await requireSession();
  return executeBusinessAction(user,async()=>{
    const access=await validarAccion(user,{modulo:"caja",permisos:"ventas.crear"});
    if(!access.ok)return access;
    const session=await cashSession(user,z.string().uuid().parse(sesionId));
    const totals=await cashTotals(user,session);
    const [movimientos,revisiones]=await dbConEmpresa(user.empresaId,async tx=>Promise.all([
      tx.execute(sql`select * from caja_movimientos where empresa_id=${user.empresaId}::uuid and sesion_id=${session.id}::uuid order by registrado_en,id limit 300`),
      tx.execute(sql`select * from caja_revisiones where empresa_id=${user.empresaId}::uuid and sesion_id=${session.id}::uuid order by id limit 300`),
    ]));
    return {ok:true as const,totals,movimientos:[...movimientos],revisiones:[...revisiones]};
  });
}
export async function revisarIncidenciaCaja(input:unknown) {
  const user=await requireSession();
  return executeBusinessAction(user,async()=>{
    const access=await validarAccion(user,{modulo:"caja",soloAdmin:true});
    if(!access.ok)return access;
    const value=z.object({id:z.string().uuid(),resolucion:z.string().trim().min(5).max(1000)}).parse(input);
    const [review]=await dbConEmpresa(user.empresaId,tx=>tx.execute(sql`select * from caja_revisiones where id=${value.id}::uuid and empresa_id=${user.empresaId}::uuid for update`));
    if(!review)return {ok:false as const,error:"Incidencia no disponible."};
    await cashSession(user,String(review.sesion_id));
    if(!review.resuelta_en)await dbConEmpresa(user.empresaId,tx=>tx.execute(sql`update caja_revisiones set resuelta_en=now(),resuelta_por=${user.id}::uuid,resolucion=${value.resolucion} where id=${value.id}::uuid and empresa_id=${user.empresaId}::uuid`));
    revalidateBusinessPath("/caja");revalidateBusinessPath(`/caja/${review.sesion_id}`);
    return {ok:true as const};
  });
}


export async function turnosCajaDisponibles() {
  const user=await requireSession();
  return executeBusinessAction(user,async()=>{
    const access=await validarAccion(user,{permisos:"ventas.crear"});
    if(!access.ok)return access;
    const rows=await dbConEmpresa(user.empresaId,tx=>tx.execute(sql`
      select s.id,c.nombre from sesiones_caja s join cajas c on c.id=s.caja_id and c.empresa_id=s.empresa_id
      where s.empresa_id=${user.empresaId}::uuid and s.estado='abierta' and c.activa=true
        and (not exists(select 1 from usuario_sucursales u join sucursales b on b.id=u.sucursal_id where u.usuario_id=${user.id}::uuid and b.empresa_id=s.empresa_id)
          or exists(select 1 from usuario_sucursales u where u.usuario_id=${user.id}::uuid and u.sucursal_id=c.sucursal_id))
      order by c.nombre,s.id
    `));
    return {ok:true as const,turnos:rows.map(row=>({id:String(row.id),nombre:String(row.nombre)}))};
  });
}
