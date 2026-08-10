"use server";

import { revalidatePath } from "next/cache";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import { pagosSuscripcion, planes as planesTable, suscripciones } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { asegurarPlanes } from "@/lib/actions/registro";
import { validarAccion } from "@/lib/server-access";
import { getPlan, type PlanId } from "@/lib/pricing";
import {
  activarSuscripcion,
  finTrialPlanPago,
  validarUsoActual,
  type Ciclo,
} from "@/lib/suscripciones/core";

type Resultado =
  | { ok: true; plan: string }
  | { ok: false; error: string };

type ResultadoTrial =
  | { ok: true; plan: string; finISO: string }
  | { ok: false; error: string; requierePago?: boolean };

/**
 * Cambio de plan SIN pago. Solo válido para Demo (gratis). Los planes pagados
 * (Pro/Enterprise) pasan por el checkout de PayPal en `lib/actions/pagos.ts`.
 */
export async function cambiarPlan(planId: PlanId): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;

  if (planId !== "demo") {
    return { ok: false, error: "Este plan requiere pago. Usa el checkout de PayPal." };
  }

  await asegurarPlanes();

  const [planRow] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({ id: planesTable.id })
      .from(planesTable)
      .where(and(eq(planesTable.codigo, planId), eq(planesTable.activo, true)))
      .limit(1),
  );

  if (!planRow) {
    return { ok: false, error: "No encontramos ese plan activo." };
  }

  const plan = getPlan(planId);

  const [actual] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({ planCodigo: planesTable.codigo })
      .from(suscripciones)
      .innerJoin(planesTable, eq(planesTable.id, suscripciones.planId))
      .where(eq(suscripciones.empresaId, user.empresaId))
      .orderBy(desc(suscripciones.creadoEn))
      .limit(1),
  );

  if (actual?.planCodigo === planId) {
    return { ok: true, plan: plan.nombre };
  }

  const limite = await validarUsoActual(user.empresaId, plan, {
    usuarios: 0,
    sucursales: 0,
  });
  if (!limite.ok) return limite;

  await dbConEmpresa(user.empresaId, async (tx) => {
    await activarSuscripcion(tx, {
      empresaId: user.empresaId,
      planRowId: planRow.id,
      planId,
      ciclo: "mensual",
      usuariosExtra: 0,
      sucursalesExtra: 0,
      codigoReferido: null,
      notas: `Cambio de plan a ${plan.nombre}`,
    });
  });

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/configuracion");
  return { ok: true, plan: plan.nombre };
}

export async function iniciarTrialPlanPago(
  planId: Exclude<PlanId, "demo">,
  ciclo: Ciclo = "mensual",
): Promise<ResultadoTrial> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;

  if (planId !== "pro" && planId !== "enterprise") {
    return { ok: false, error: "Ese plan no tiene prueba pagada." };
  }

  await asegurarPlanes();

  const plan = getPlan(planId);
  const elegible = await puedeIniciarTrialPago(user.empresaId);
  if (!elegible) {
    return {
      ok: false,
      requierePago: true,
      error: "La prueba gratis de planes pagos ya fue usada. Completa el pago para activar el plan.",
    };
  }

  const limite = await validarUsoActual(user.empresaId, plan, {
    usuarios: 0,
    sucursales: 0,
  });
  if (!limite.ok) return limite;

  const [planRow] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({ id: planesTable.id })
      .from(planesTable)
      .where(and(eq(planesTable.codigo, planId), eq(planesTable.activo, true)))
      .limit(1),
  );

  if (!planRow) {
    return { ok: false, error: "No encontramos ese plan activo." };
  }

  const fin = await dbConEmpresa(user.empresaId, async (tx) => {
    const inicio = new Date();
    const finTrial = finTrialPlanPago(inicio);
    await tx
      .update(suscripciones)
      .set({ estado: "cancelada", canceladaEn: inicio })
      .where(
        and(
          eq(suscripciones.empresaId, user.empresaId),
          inArray(suscripciones.estado, ["activa", "trial", "suspendida"]),
        ),
      );

    await tx.insert(suscripciones).values({
      empresaId: user.empresaId,
      planId: planRow.id,
      estado: "trial",
      ciclo,
      inicioPeriodo: inicio,
      finPeriodo: finTrial,
      notas: `Prueba gratis de ${plan.nombre}`,
    });

    return finTrial;
  });

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/configuracion");
  return { ok: true, plan: plan.nombre, finISO: fin.toISOString() };
}

async function puedeIniciarTrialPago(empresaId: string): Promise<boolean> {
  const [[subsPagadas], [pagosCompletados]] = await Promise.all([
    dbConEmpresa(empresaId, (tx) =>
      tx
        .select({ n: count() })
        .from(suscripciones)
        .innerJoin(planesTable, eq(planesTable.id, suscripciones.planId))
        .where(
          and(
            eq(suscripciones.empresaId, empresaId),
            inArray(planesTable.codigo, ["pro", "enterprise"]),
          ),
        ),
    ),
    dbConEmpresa(empresaId, (tx) =>
      tx
        .select({ n: count() })
        .from(pagosSuscripcion)
        .where(
          and(
            eq(pagosSuscripcion.empresaId, empresaId),
            eq(pagosSuscripcion.estado, "completado"),
            inArray(pagosSuscripcion.planCodigo, ["pro", "enterprise"]),
          ),
        ),
    ),
  ]);

  return (subsPagadas?.n ?? 0) === 0 && (pagosCompletados?.n ?? 0) === 0;
}
