import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { gastos, gastosRecurrentes } from "@/lib/db/schema";
import { registrarGasto } from "@/lib/contabilidad/motor-asientos";
import { aDecimalStr, dinero, type TX } from "@/lib/contabilidad/helpers";

export type DatosGasto = {
  empresaId: string;
  usuarioId: string;
  categoriaId: string;
  cuentaFinancieraId: string;
  fecha: string;
  descripcion: string;
  referencia?: string | null;
  subtotal: number;
  impuesto: number;
  recurrenteId?: string | null;
  periodoRecurrente?: string | null;
};

export function siguienteFechaMensual(fecha: string, diaMes: number): string {
  const [anio, mes] = fecha.split("-").map(Number);
  const ultimoDiaSiguienteMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const dia = Math.min(Math.max(diaMes, 1), ultimoDiaSiguienteMes);
  return new Date(Date.UTC(anio, mes, dia)).toISOString().slice(0, 10);
}

export async function registrarGastoEnTransaccion(tx: TX, data: DatosGasto): Promise<string> {
  const subtotal = dinero(data.subtotal);
  const impuesto = dinero(data.impuesto);
  const total = dinero(subtotal + impuesto);
  const [gasto] = await tx
    .insert(gastos)
    .values({
      empresaId: data.empresaId,
      categoriaId: data.categoriaId,
      cuentaFinancieraId: data.cuentaFinancieraId,
      recurrenteId: data.recurrenteId ?? null,
      periodoRecurrente: data.periodoRecurrente ?? null,
      fecha: data.fecha,
      descripcion: data.descripcion,
      referencia: data.referencia || null,
      subtotal: aDecimalStr(subtotal),
      impuesto: aDecimalStr(impuesto),
      total: aDecimalStr(total),
      usuarioId: data.usuarioId,
    })
    .onConflictDoNothing({
      target: [gastos.recurrenteId, gastos.periodoRecurrente],
    })
    .returning({ id: gastos.id });

  if (!gasto) return "";

  const asientoId = await registrarGasto(
    {
      empresaId: data.empresaId,
      usuarioId: data.usuarioId,
      gastoId: gasto.id,
      categoriaGastoId: data.categoriaId,
      cuentaFinancieraId: data.cuentaFinancieraId,
      fecha: new Date(`${data.fecha}T12:00:00Z`),
      descripcion: data.descripcion,
      subtotal,
      impuesto,
      total,
    },
    tx,
  );
  await tx.update(gastos).set({ asientoId }).where(eq(gastos.id, gasto.id));
  return gasto.id;
}

export async function procesarGastosRecurrentesPendientes({
  empresaId,
  fechaCorte = new Date().toISOString().slice(0, 10),
}: {
  empresaId?: string;
  fechaCorte?: string;
} = {}): Promise<{ generados: number; errores: number }> {
  const condiciones = [
    eq(gastosRecurrentes.activa, true),
    lte(gastosRecurrentes.proximaFecha, fechaCorte),
  ];
  if (empresaId) condiciones.push(eq(gastosRecurrentes.empresaId, empresaId));

  const pendientes = await db
    .select({ id: gastosRecurrentes.id })
    .from(gastosRecurrentes)
    .where(and(...condiciones))
    .limit(200);

  let generados = 0;
  let errores = 0;
  for (const pendiente of pendientes) {
    try {
      generados += await db.transaction(async (tx) => {
        const [plantilla] = await tx
          .select()
          .from(gastosRecurrentes)
          .where(eq(gastosRecurrentes.id, pendiente.id))
          .for("update")
          .limit(1);
        if (!plantilla?.activa || plantilla.proximaFecha > fechaCorte || !plantilla.usuarioId) {
          return 0;
        }

        let proximaFecha = plantilla.proximaFecha;
        let creados = 0;
        let ciclos = 0;
        while (proximaFecha <= fechaCorte && ciclos < 24) {
          const gastoId = await registrarGastoEnTransaccion(tx, {
            empresaId: plantilla.empresaId,
            usuarioId: plantilla.usuarioId,
            categoriaId: plantilla.categoriaId,
            cuentaFinancieraId: plantilla.cuentaFinancieraId,
            fecha: proximaFecha,
            descripcion: plantilla.descripcion,
            referencia: plantilla.referencia,
            subtotal: Number(plantilla.subtotal),
            impuesto: Number(plantilla.impuesto),
            recurrenteId: plantilla.id,
            periodoRecurrente: proximaFecha,
          });
          if (gastoId) creados += 1;
          proximaFecha = siguienteFechaMensual(proximaFecha, plantilla.diaMes);
          ciclos += 1;
        }

        await tx
          .update(gastosRecurrentes)
          .set({
            proximaFecha,
            ultimoGeneradoEn: creados > 0 ? new Date() : plantilla.ultimoGeneradoEn,
            actualizadoEn: new Date(),
          })
          .where(eq(gastosRecurrentes.id, plantilla.id));
        return creados;
      });
    } catch (error) {
      errores += 1;
      console.error(`[gasto-recurrente:${pendiente.id}]`, error);
    }
  }

  return { generados, errores };
}
