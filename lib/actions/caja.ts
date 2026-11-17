"use server";

import { businessEntityId, businessEventDate, currentBusinessContext } from "@/lib/business-context";

import { executeBusinessAction, revalidateBusinessPath as revalidatePath } from "@/lib/business-action";
import { and, eq, isNull, sql } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import { cajas, sesionesCaja, sucursales, cajaRevisiones } from "@/lib/db/schema";
import { crearCajaSchema, abrirSesionSchema, cerrarSesionSchema } from "@/lib/validations/caja";
import { requireSession } from "@/lib/actions/session-helpers";
import { validarAccion } from "@/lib/server-access";
import { aDecimalStr, dinero } from "@/lib/contabilidad/helpers";

import { cashEntry, cashSession, cashTotals } from "../cash-service";
import { CASH_CLOSE_NOTICE } from "../cash-core";

type Resultado = { ok: true; revisionPendiente?: boolean; aviso?: string } | { ok: false; error: string };

export async function crearCaja(input: unknown): Promise<Resultado> {
  return executeBusinessAction(await requireSession(), () => crearCajaBusiness(input));
}

async function crearCajaBusiness(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;
  const parsed = crearCajaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;
  const codigo = data.codigo.trim().toUpperCase();

  const [sucursal] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({ id: sucursales.id })
      .from(sucursales)
      .where(
        and(
          eq(sucursales.id, data.sucursalId),
          eq(sucursales.empresaId, user.empresaId),
          eq(sucursales.activa, true),
          isNull(sucursales.eliminadoEn),
        ),
      )
      .limit(1),
  );
  if (!sucursal) return { ok: false, error: "Sucursal no valida" };

  const duplicada = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({ id: cajas.id })
      .from(cajas)
      .where(and(eq(cajas.empresaId, user.empresaId), eq(cajas.codigo, codigo)))
      .limit(1),
  );
  if (duplicada.length > 0) {
    return { ok: false, error: "Ya existe una caja con ese codigo" };
  }

  try {
    await dbConEmpresa(user.empresaId, (tx) =>
      tx.insert(cajas).values({
        empresaId: user.empresaId,
        sucursalId: sucursal.id,
        codigo,
        nombre: data.nombre.trim(),
        activa: true,
      }),
    );

    revalidatePath("/caja");
    revalidatePath("/configuracion/cajas");
    return { ok: true };
  } catch (err) {
    console.error("[crearCaja]", err);
    return { ok: false, error: "No pudimos crear la caja." };
  }
}

export async function abrirSesion(
  input: unknown,
): Promise<{ ok: true; sesionId: string } | { ok: false; error: string }> {
  return executeBusinessAction(await requireSession(), () => abrirSesionBusiness(input));
}

async function abrirSesionBusiness(
  input: unknown,
): Promise<{ ok: true; sesionId: string } | { ok: false; error: string }> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { modulo: "caja", permisos: "ventas.crear" });
  if (!acceso.ok) return acceso;
  const parsed = abrirSesionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const [caja] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({ id: cajas.id, nombre: cajas.nombre, sucursalId: cajas.sucursalId })
      .from(cajas)
      .where(and(eq(cajas.id, data.cajaId), eq(cajas.empresaId, user.empresaId),eq(cajas.activa,true)))
      .limit(1),
  );
  if (!caja) return { ok: false, error: "Caja no encontrada" };

  const context=currentBusinessContext();
  if(context?.sucursalIds && !context.sucursalIds.includes(caja.sucursalId))return {ok:false,error:"Sucursal no autorizada."};
  const assigned=await dbConEmpresa(user.empresaId,tx=>tx.execute(sql`select u.sucursal_id from usuario_sucursales u join sucursales s on s.id=u.sucursal_id where u.usuario_id=${user.id}::uuid and s.empresa_id=${user.empresaId}::uuid`));
  if(assigned.length && !assigned.some(row=>row.sucursal_id===caja.sucursalId))return {ok:false,error:"Sucursal no autorizada."};
  await dbConEmpresa(user.empresaId,tx=>tx.execute(sql`select id from cajas where id=${caja.id}::uuid and empresa_id=${user.empresaId}::uuid for update`));
  const [sesionAbierta] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({ id: sesionesCaja.id })
      .from(sesionesCaja)
      .where(
        and(
          eq(sesionesCaja.cajaId, data.cajaId),
          eq(sesionesCaja.estado, "abierta"),
        ),
      )
      .limit(1),
  );
  if (sesionAbierta) {
    await cashSession(user,sesionAbierta.id);
    const offlineId=businessEntityId("sesion_caja");
    if (offlineId && offlineId!==sesionAbierta.id) return {ok:false,error:"La caja tiene otro turno abierto. Sincroniza y revisa la apertura offline."};
    return {ok:true,sesionId:sesionAbierta.id};
  }

  const [sesion] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .insert(sesionesCaja)
      .values({
          id: businessEntityId("sesion_caja"),
        abiertaEn: businessEventDate(),
        empresaId: user.empresaId,
        cajaId: data.cajaId,
        usuarioId: user.id,
        estado: "abierta",
        montoInicial: aDecimalStr(data.montoInicial),
      })
      .returning({ id: sesionesCaja.id }),
  );

  await cashEntry(user,await cashSession(user,sesion.id),"apertura",sesion.id,0,{fondoInicial:data.montoInicial});
  revalidatePath("/caja");
  return { ok: true, sesionId: sesion.id };
}

export async function cerrarSesion(input: unknown): Promise<Resultado> {
  return executeBusinessAction(await requireSession(), () => cerrarSesionBusiness(input));
}

async function cerrarSesionBusiness(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { modulo: "caja", permisos: "ventas.crear" });
  if (!acceso.ok) return acceso;
  const parsed = cerrarSesionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const sesion=await cashSession(user,data.sesionId);
  if(sesion.estado==="cerrada") {
    if(Number(sesion.monto_final_real)===data.montoFinalReal)return {ok:true,aviso:CASH_CLOSE_NOTICE};
    const repeated=await dbConEmpresa(user.empresaId,tx=>tx.execute(sql`select id from caja_movimientos
      where empresa_id=${user.empresaId}::uuid and sesion_id=${sesion.id}::uuid and tipo='cierre_reintento'
        and usuario_id=${user.id}::uuid and detalle->>'declarado'=${String(data.montoFinalReal)}
        and detalle->>'notas'=${data.notas??""} limit 1`));
    if(repeated.length)return {ok:true,revisionPendiente:true,aviso:"El conteo alternativo ya fue registrado para revisión."};
    await cashEntry(user,sesion,"cierre_reintento",currentBusinessContext()?.operationId??data.attemptId??crypto.randomUUID(),0,
      {declarado:data.montoFinalReal,notas:data.notas??""},"cierre_reintento");
    return {ok:true,revisionPendiente:true,aviso:"El cierre original se conservó. El conteo alternativo requiere revisión."};
  }
  const totals=await cashTotals(user,sesion);
  const diferencia=dinero(data.montoFinalReal-totals.esperado);
  await dbConEmpresa(user.empresaId,async tx=>{
    await tx.update(sesionesCaja).set({
      estado:"cerrada",montoFinalEsperado:aDecimalStr(totals.esperado),montoFinalReal:aDecimalStr(data.montoFinalReal),
      diferencia:aDecimalStr(diferencia),cerradaEn:businessEventDate(),notas:data.notas||null,
    }).where(and(eq(sesionesCaja.id,sesion.id),eq(sesionesCaja.empresaId,user.empresaId),eq(sesionesCaja.estado,"abierta")));
    const esperadoLocal=currentBusinessContext()?.identity?.type==="sesion_caja" ? data.esperadoLocal : undefined;
    const entry=await cashEntry(user,sesion,"cierre",sesion.id,0,{declarado:data.montoFinalReal,esperado:totals.esperado,esperadoLocal:esperadoLocal??null,diferencia,aviso:CASH_CLOSE_NOTICE});
    if(esperadoLocal!==undefined && dinero(esperadoLocal)!==totals.esperado)await tx.insert(cajaRevisiones).values({
      empresaId:user.empresaId,sucursalId:sesion.sucursal_id,sesionId:sesion.id,movimientoId:entry.id,
      motivo:"El efectivo esperado offline difiere de los movimientos recibidos por Cloud. Se conservan ambos cálculos y el conteo declarado.",
    });
  });

  revalidatePath("/caja");
  revalidatePath(`/caja/${data.sesionId}`);
  return { ok: true, aviso:CASH_CLOSE_NOTICE };
}
