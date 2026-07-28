"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuentasFinancieras, categoriasGasto, gastos } from "@/lib/db/schema";
import {
  crearCuentaFinancieraSchema,
  crearCategoriaGastoSchema,
  crearGastoSchema,
} from "@/lib/validations/tesoreria";
import { requireSession } from "@/lib/actions/session-helpers";
import { validarAccion } from "@/lib/server-access";
import { registrarGasto } from "@/lib/contabilidad/motor-asientos";
import { dinero, aDecimalStr } from "@/lib/contabilidad/helpers";

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

  const subtotal = dinero(data.subtotal);
  const impuesto = dinero(data.impuesto);
  const total = dinero(subtotal + impuesto);
  // Noon UTC to avoid timezone date-shift
  const fecha = new Date(data.fecha + "T12:00:00Z");

  try {
    const gastoId = await db.transaction(async (tx) => {
      const [gasto] = await tx
        .insert(gastos)
        .values({
          empresaId: user.empresaId,
          categoriaId: data.categoriaId,
          cuentaFinancieraId: data.cuentaFinancieraId,
          fecha: data.fecha,
          descripcion: data.descripcion,
          referencia: data.referencia || null,
          subtotal: aDecimalStr(subtotal),
          impuesto: aDecimalStr(impuesto),
          total: aDecimalStr(total),
          usuarioId: user.id,
        })
        .returning({ id: gastos.id });

      const asientoId = await registrarGasto(
        {
          empresaId: user.empresaId,
          usuarioId: user.id,
          gastoId: gasto.id,
          categoriaGastoId: data.categoriaId,
          cuentaFinancieraId: data.cuentaFinancieraId,
          fecha,
          descripcion: data.descripcion,
          subtotal,
          impuesto,
          total,
        },
        tx,
      );

      await tx.update(gastos).set({ asientoId }).where(eq(gastos.id, gasto.id));
      return gasto.id;
    });

    revalidatePath("/tesoreria");
    revalidatePath("/tesoreria/gastos");
    return { ok: true, gastoId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al registrar gasto",
    };
  }
}
