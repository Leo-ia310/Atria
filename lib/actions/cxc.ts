"use server";

import { revalidatePath } from "next/cache";
import { invalidarModulos } from "@/lib/redis/cache";
import { MODULOS } from "@/lib/redis/keys";
import { and, eq } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import {
  abonosCliente,
  cuentasPorCobrar,
  formasPago,
  ventas,
} from "@/lib/db/schema";
import { registrarAbonoSchema } from "@/lib/validations/cxc";
import { requireSession } from "@/lib/actions/session-helpers";
import { validarAccion } from "@/lib/server-access";
import { registrarAbonoCliente } from "@/lib/contabilidad/motor-asientos";
import { dinero, aDecimalStr } from "@/lib/contabilidad/helpers";

export async function registrarAbono(
  input: unknown,
): Promise<{ ok: true; abonoId: string } | { ok: false; error: string }> {
  const user = await requireSession();
  const acceso = await validarAccion(user, {
    modulo: "cxc",
    permisos: ["ventas.crear", "ventas.ver"],
  });
  if (!acceso.ok) return acceso;
  const parsed = registrarAbonoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  // Validate forma de pago ownership before entering the transaction
  const [fp] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({ cuentaFinancieraId: formasPago.cuentaFinancieraId, nombre: formasPago.nombre })
      .from(formasPago)
      .where(and(eq(formasPago.id, data.formaPagoId), eq(formasPago.empresaId, user.empresaId)))
      .limit(1),
  );

  if (!fp) return { ok: false, error: "Forma de pago no encontrada" };
  if (!fp.cuentaFinancieraId) {
    return {
      ok: false,
      error: `La forma de pago "${fp.nombre}" no tiene cuenta financiera vinculada`,
    };
  }
  const cuentaFinancieraId = fp.cuentaFinancieraId;

  try {
    const abonoId = await dbConEmpresa(user.empresaId, async (tx) => {
      // SELECT FOR UPDATE locks the row for the duration of the transaction,
      // preventing concurrent abonos from reading a stale saldo.
      const [cxc] = await tx
        .select({
          id: cuentasPorCobrar.id,
          saldo: cuentasPorCobrar.saldo,
          estado: cuentasPorCobrar.estado,
          clienteId: cuentasPorCobrar.clienteId,
          sucursalId: ventas.sucursalId,
        })
        .from(cuentasPorCobrar)
        .leftJoin(ventas, eq(ventas.id, cuentasPorCobrar.ventaId))
        .where(
          and(
            eq(cuentasPorCobrar.id, data.cxcId),
            eq(cuentasPorCobrar.empresaId, user.empresaId),
          ),
        )
        .for("update", { of: cuentasPorCobrar })
        .limit(1);

      if (!cxc) throw new Error("Cuenta por cobrar no encontrada");
      if (cxc.estado === "pagada") throw new Error("Esta cuenta ya está saldada");

      const saldoActual = dinero(cxc.saldo);
      const monto = dinero(data.monto);
      if (monto > saldoActual + 0.0001) {
        throw new Error(
          `El abono (${monto.toFixed(2)}) supera el saldo pendiente (${saldoActual.toFixed(2)})`,
        );
      }

      const nuevoSaldo = dinero(saldoActual - monto);
      const nuevoEstado =
        nuevoSaldo <= 0.0001
          ? "pagada"
          : cxc.estado === "vencida" || cxc.estado === "incobrable"
            ? cxc.estado
            : "parcial";

      const fecha = new Date(data.fecha + "T12:00:00Z");

      const [abono] = await tx
        .insert(abonosCliente)
        .values({
          empresaId: user.empresaId,
          cxcId: data.cxcId,
          formaPagoId: data.formaPagoId,
          fecha: data.fecha,
          monto: aDecimalStr(monto),
          referencia: data.referencia || null,
          notas: data.notas || null,
          usuarioId: user.id,
        })
        .returning({ id: abonosCliente.id });

      await tx
        .update(cuentasPorCobrar)
        .set({
          saldo: aDecimalStr(nuevoSaldo <= 0.0001 ? 0 : nuevoSaldo),
          estado: nuevoEstado,
        })
        .where(eq(cuentasPorCobrar.id, data.cxcId));

      const asientoId = await registrarAbonoCliente(
        {
          empresaId: user.empresaId,
          usuarioId: user.id,
          abonoId: abono.id,
          cxcId: data.cxcId,
          fecha,
          monto,
          cuentaFinancieraId,
          sucursalId: cxc.sucursalId,
          referencia: data.referencia || undefined,
        },
        tx,
      );

      await tx
        .update(abonosCliente)
        .set({ asientoId })
        .where(eq(abonosCliente.id, abono.id));

      return abono.id;
    });

    revalidatePath("/cxc");
    revalidatePath(`/cxc/${data.cxcId}`);
    revalidatePath("/facturas/credito");
    await invalidarModulos(user.empresaId, [MODULOS.DASHBOARD, MODULOS.CONTABILIDAD]);
    return { ok: true, abonoId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al registrar abono",
    };
  }
}
