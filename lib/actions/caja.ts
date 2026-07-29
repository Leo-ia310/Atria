"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { cajas, sesionesCaja, sucursales, ventas } from "@/lib/db/schema";
import { crearCajaSchema, abrirSesionSchema, cerrarSesionSchema } from "@/lib/validations/caja";
import { requireSession } from "@/lib/actions/session-helpers";
import { validarAccion } from "@/lib/server-access";
import { aDecimalStr, dinero } from "@/lib/contabilidad/helpers";

type Resultado = { ok: true } | { ok: false; error: string };

export async function crearCaja(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;
  const parsed = crearCajaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;
  const codigo = data.codigo.trim().toUpperCase();

  const [sucursal] = await db
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
    .limit(1);
  if (!sucursal) return { ok: false, error: "Sucursal no valida" };

  const duplicada = await db
    .select({ id: cajas.id })
    .from(cajas)
    .where(and(eq(cajas.empresaId, user.empresaId), eq(cajas.codigo, codigo)))
    .limit(1);
  if (duplicada.length > 0) {
    return { ok: false, error: "Ya existe una caja con ese codigo" };
  }

  try {
    await db.insert(cajas).values({
      empresaId: user.empresaId,
      sucursalId: sucursal.id,
      codigo,
      nombre: data.nombre.trim(),
      activa: true,
    });

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
  const user = await requireSession();
  const acceso = await validarAccion(user, { modulo: "caja", permisos: "ventas.crear" });
  if (!acceso.ok) return acceso;
  const parsed = abrirSesionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const [caja] = await db
    .select({ id: cajas.id, nombre: cajas.nombre })
    .from(cajas)
    .where(and(eq(cajas.id, data.cajaId), eq(cajas.empresaId, user.empresaId)))
    .limit(1);
  if (!caja) return { ok: false, error: "Caja no encontrada" };

  const [sesionAbierta] = await db
    .select({ id: sesionesCaja.id })
    .from(sesionesCaja)
    .where(
      and(
        eq(sesionesCaja.cajaId, data.cajaId),
        eq(sesionesCaja.estado, "abierta"),
      ),
    )
    .limit(1);
  if (sesionAbierta) {
    return { ok: false, error: `La caja "${caja.nombre}" ya tiene una sesión abierta` };
  }

  const [sesion] = await db
    .insert(sesionesCaja)
    .values({
      empresaId: user.empresaId,
      cajaId: data.cajaId,
      usuarioId: user.id,
      estado: "abierta",
      montoInicial: aDecimalStr(data.montoInicial),
    })
    .returning({ id: sesionesCaja.id });

  revalidatePath("/caja");
  return { ok: true, sesionId: sesion.id };
}

export async function cerrarSesion(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { modulo: "caja", permisos: "ventas.crear" });
  if (!acceso.ok) return acceso;
  const parsed = cerrarSesionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const [sesion] = await db
    .select({
      id: sesionesCaja.id,
      estado: sesionesCaja.estado,
      montoInicial: sesionesCaja.montoInicial,
    })
    .from(sesionesCaja)
    .where(
      and(
        eq(sesionesCaja.id, data.sesionId),
        eq(sesionesCaja.empresaId, user.empresaId),
      ),
    )
    .limit(1);

  if (!sesion) return { ok: false, error: "Sesión no encontrada" };
  if (sesion.estado === "cerrada") return { ok: false, error: "La sesión ya está cerrada" };

  // Sum cash sales (esCredito=false, not voided) linked to this session
  // TODO: refine once POS tracks per-payment-method when it's built
  const [resumen] = await db
    .select({ totalContado: sum(ventas.total) })
    .from(ventas)
    .where(
      and(
        eq(ventas.sesionCajaId, data.sesionId),
        eq(ventas.esCredito, false),
        isNull(ventas.anuladoEn),
      ),
    );

  const totalVentasContado = dinero(resumen?.totalContado ?? 0);
  const montoInicial = dinero(sesion.montoInicial);
  const montoFinalEsperado = dinero(montoInicial + totalVentasContado);
  const montoFinalReal = dinero(data.montoFinalReal);
  const diferencia = dinero(montoFinalReal - montoFinalEsperado);

  await db
    .update(sesionesCaja)
    .set({
      estado: "cerrada",
      montoFinalEsperado: aDecimalStr(montoFinalEsperado),
      montoFinalReal: aDecimalStr(montoFinalReal),
      diferencia: aDecimalStr(diferencia),
      cerradaEn: new Date(),
      notas: data.notas || null,
    })
    .where(eq(sesionesCaja.id, data.sesionId));

  revalidatePath("/caja");
  revalidatePath(`/caja/${data.sesionId}`);
  return { ok: true };
}
