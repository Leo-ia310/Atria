"use server";

import { revalidatePath } from "next/cache";
import { invalidarModulos } from "@/lib/redis/cache";
import { MODULOS } from "@/lib/redis/keys";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuentasFinancieras, categoriasGasto, gastosRecurrentes } from "@/lib/db/schema";
import {
  crearCuentaFinancieraSchema,
  crearCategoriaGastoSchema,
  crearGastoSchema,
  actualizarGastoRecurrenteSchema,
} from "@/lib/validations/tesoreria";
import { requireSession } from "@/lib/actions/session-helpers";
import { validarAccion } from "@/lib/server-access";
import { aDecimalStr } from "@/lib/contabilidad/helpers";
import {
  registrarGastoEnTransaccion,
  siguienteFechaMensual,
} from "@/lib/tesoreria/gastos-recurrentes";

type Resultado = { ok: true } | { ok: false; error: string };

export async function crearCuentaFinanciera(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { modulo: "tesoreria", permisos: "tesoreria.ver" });
  if (!acceso.ok) return acceso;
  const parsed = crearCuentaFinancieraSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  await db.insert(cuentasFinancieras).values({
    empresaId: user.empresaId,
    tipo: data.tipo,
    nombre: data.nombre,
    banco: data.banco || null,
    numeroCuenta: data.numeroCuenta || null,
    moneda: data.moneda,
    saldoActual: aDecimalStr(data.saldoInicial),
    cuentaContableId: data.cuentaContableId || null,
    activa: true,
  });

  revalidatePath("/tesoreria");
  revalidatePath("/tesoreria/cuentas");
  return { ok: true };
}

export async function crearCategoriaGasto(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { modulo: "tesoreria", permisos: "tesoreria.ver" });
  if (!acceso.ok) return acceso;
  const parsed = crearCategoriaGastoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  await db.insert(categoriasGasto).values({
    empresaId: user.empresaId,
    nombre: data.nombre,
    cuentaContableId: data.cuentaContableId,
    activa: true,
  });

  revalidatePath("/tesoreria/gastos");
  return { ok: true };
}

export async function crearGasto(
  input: unknown,
): Promise<{ ok: true; gastoId: string } | { ok: false; error: string }> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { modulo: "tesoreria", permisos: "tesoreria.ver" });
  if (!acceso.ok) return acceso;
  const parsed = crearGastoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  // Verify ownership before entering transaction (prevents cross-tenant FK injection)
  const [categoria] = await db
    .select({ id: categoriasGasto.id })
    .from(categoriasGasto)
    .where(and(eq(categoriasGasto.id, data.categoriaId), eq(categoriasGasto.empresaId, user.empresaId)))
    .limit(1);
  if (!categoria) return { ok: false, error: "Categoría de gasto no encontrada" };

  const [cuenta] = await db
    .select({ id: cuentasFinancieras.id })
    .from(cuentasFinancieras)
    .where(and(eq(cuentasFinancieras.id, data.cuentaFinancieraId), eq(cuentasFinancieras.empresaId, user.empresaId)))
    .limit(1);
  if (!cuenta) return { ok: false, error: "Cuenta financiera no encontrada" };

  try {
    const gastoId = await db.transaction(async (tx) => {
      let recurrenteId: string | null = null;
      if (data.recurrenteMensual) {
        const diaMes = Number(data.fecha.slice(8, 10));
        const [recurrente] = await tx
          .insert(gastosRecurrentes)
          .values({
            empresaId: user.empresaId,
            categoriaId: data.categoriaId,
            cuentaFinancieraId: data.cuentaFinancieraId,
            descripcion: data.descripcion,
            referencia: data.referencia || null,
            subtotal: aDecimalStr(data.subtotal),
            impuesto: aDecimalStr(data.impuesto),
            diaMes,
            proximaFecha: siguienteFechaMensual(data.fecha, diaMes),
            usuarioId: user.id,
          })
          .returning({ id: gastosRecurrentes.id });
        recurrenteId = recurrente.id;
      }

      return registrarGastoEnTransaccion(tx, {
        empresaId: user.empresaId,
        usuarioId: user.id,
        categoriaId: data.categoriaId,
        cuentaFinancieraId: data.cuentaFinancieraId,
        fecha: data.fecha,
        descripcion: data.descripcion,
        referencia: data.referencia,
        subtotal: data.subtotal,
        impuesto: data.impuesto,
        recurrenteId,
        periodoRecurrente: recurrenteId ? data.fecha : null,
      });
    });

    revalidatePath("/tesoreria");
    revalidatePath("/tesoreria/gastos");
    revalidatePath("/tesoreria/gastos/recurrentes");
    await invalidarModulos(user.empresaId, [MODULOS.CONTABILIDAD]);
    return { ok: true, gastoId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al registrar gasto",
    };
  }
}

export async function actualizarGastoRecurrente(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { modulo: "tesoreria", permisos: "tesoreria.ver" });
  if (!acceso.ok) return acceso;
  const parsed = actualizarGastoRecurrenteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const [categoria, cuenta, recurrente] = await Promise.all([
    db
      .select({ id: categoriasGasto.id })
      .from(categoriasGasto)
      .where(and(eq(categoriasGasto.id, data.categoriaId), eq(categoriasGasto.empresaId, user.empresaId)))
      .limit(1),
    db
      .select({ id: cuentasFinancieras.id })
      .from(cuentasFinancieras)
      .where(and(eq(cuentasFinancieras.id, data.cuentaFinancieraId), eq(cuentasFinancieras.empresaId, user.empresaId)))
      .limit(1),
    db
      .select({ id: gastosRecurrentes.id })
      .from(gastosRecurrentes)
      .where(and(eq(gastosRecurrentes.id, data.id), eq(gastosRecurrentes.empresaId, user.empresaId)))
      .limit(1),
  ]);
  if (!categoria[0]) return { ok: false, error: "Categoría de gasto no encontrada" };
  if (!cuenta[0]) return { ok: false, error: "Cuenta financiera no encontrada" };
  if (!recurrente[0]) return { ok: false, error: "Gasto recurrente no encontrado" };

  try {
    await db
      .update(gastosRecurrentes)
      .set({
        categoriaId: data.categoriaId,
        cuentaFinancieraId: data.cuentaFinancieraId,
        descripcion: data.descripcion,
        referencia: data.referencia || null,
        subtotal: aDecimalStr(data.subtotal),
        impuesto: aDecimalStr(data.impuesto),
        diaMes: data.diaMes,
        proximaFecha: data.proximaFecha,
        activa: data.activa,
        actualizadoEn: new Date(),
      })
      .where(and(eq(gastosRecurrentes.id, data.id), eq(gastosRecurrentes.empresaId, user.empresaId)));
  } catch (error) {
    console.error(`[gasto-recurrente:${data.id}] No se pudo actualizar`, error);
    return { ok: false, error: "No se pudo actualizar el gasto recurrente" };
  }

  revalidatePath("/tesoreria");
  revalidatePath("/tesoreria/gastos");
  revalidatePath("/tesoreria/gastos/recurrentes");
  return { ok: true };
}
