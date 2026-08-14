"use server";

import { revalidatePath } from "next/cache";
import { invalidarModulos } from "@/lib/redis/cache";
import { MODULOS } from "@/lib/redis/keys";
import { and, eq } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import { cuentasPorPagar, pagosProveedor, cuentasFinancieras, compras } from "@/lib/db/schema";
import { registrarPagoSchema } from "@/lib/validations/cxp";
import { requireSession } from "@/lib/actions/session-helpers";
import { validarAccion } from "@/lib/server-access";
import { registrarPagoProveedor } from "@/lib/contabilidad/motor-asientos";
import { dinero, aDecimalStr } from "@/lib/contabilidad/helpers";

export async function registrarPago(
  input: unknown,
): Promise<{ ok: true; pagoId: string } | { ok: false; error: string }> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { modulo: "cxp", permisos: "compras.crear" });
  if (!acceso.ok) return acceso;
  const parsed = registrarPagoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  // Validate cuenta financiera ownership before entering transaction
  const [cuenta] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({ id: cuentasFinancieras.id })
      .from(cuentasFinancieras)
      .where(
        and(
          eq(cuentasFinancieras.id, data.cuentaFinancieraId),
          eq(cuentasFinancieras.empresaId, user.empresaId),
        ),
      )
      .limit(1),
  );
  if (!cuenta) return { ok: false, error: "Cuenta financiera no encontrada" };

  try {
    const pagoId = await dbConEmpresa(user.empresaId, async (tx) => {
      const [cxp] = await tx
        .select({
          id: cuentasPorPagar.id,
          saldo: cuentasPorPagar.saldo,
          estado: cuentasPorPagar.estado,
          sucursalId: compras.sucursalId,
        })
        .from(cuentasPorPagar)
        .leftJoin(compras, eq(compras.id, cuentasPorPagar.compraId))
        .where(
          and(
            eq(cuentasPorPagar.id, data.cxpId),
            eq(cuentasPorPagar.empresaId, user.empresaId),
          ),
        )
        .for("update", { of: cuentasPorPagar })
        .limit(1);

      if (!cxp) throw new Error("Cuenta por pagar no encontrada");
      if (cxp.estado === "pagada") throw new Error("Esta cuenta ya está saldada");

      const saldoActual = dinero(cxp.saldo);
      const monto = dinero(data.monto);
      if (monto > saldoActual + 0.0001) {
        throw new Error(
          `El pago (${monto.toFixed(2)}) supera el saldo pendiente (${saldoActual.toFixed(2)})`,
        );
      }

      const nuevoSaldo = dinero(saldoActual - monto);
      const nuevoEstado =
        nuevoSaldo <= 0.0001 ? "pagada" : cxp.estado === "vencida" ? "vencida" : "parcial";

      const fecha = new Date(data.fecha + "T12:00:00Z");

      const [pago] = await tx
        .insert(pagosProveedor)
        .values({
          empresaId: user.empresaId,
          cxpId: data.cxpId,
          cuentaFinancieraId: data.cuentaFinancieraId,
          fecha: data.fecha,
          monto: aDecimalStr(monto),
          referencia: data.referencia || null,
          notas: data.notas || null,
          usuarioId: user.id,
        })
        .returning({ id: pagosProveedor.id });

      await tx
        .update(cuentasPorPagar)
        .set({
          saldo: aDecimalStr(nuevoSaldo <= 0.0001 ? 0 : nuevoSaldo),
          estado: nuevoEstado,
        })
        .where(eq(cuentasPorPagar.id, data.cxpId));

      const asientoId = await registrarPagoProveedor(
        {
          empresaId: user.empresaId,
          usuarioId: user.id,
          pagoId: pago.id,
          cxpId: data.cxpId,
          fecha,
          monto,
          cuentaFinancieraId: data.cuentaFinancieraId,
          sucursalId: cxp.sucursalId,
          referencia: data.referencia || undefined,
        },
        tx,
      );

      await tx
        .update(pagosProveedor)
        .set({ asientoId })
        .where(eq(pagosProveedor.id, pago.id));

      return pago.id;
    });

    revalidatePath("/cxp");
    revalidatePath(`/cxp/${data.cxpId}`);
    await invalidarModulos(user.empresaId, [MODULOS.CONTABILIDAD]);
    return { ok: true, pagoId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al registrar pago",
    };
  }
}
