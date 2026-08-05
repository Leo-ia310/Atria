"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { planes as planesTable, suscripciones } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { asegurarPlanes } from "@/lib/actions/registro";
import { validarAccion } from "@/lib/server-access";
import { getPlan, type PlanId } from "@/lib/pricing";
import { activarSuscripcion, validarUsoActual } from "@/lib/suscripciones/core";

type Resultado =
  | { ok: true; plan: string }
  | { ok: false; error: string };

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

  const [planRow] = await db
    .select({ id: planesTable.id })
    .from(planesTable)
    .where(and(eq(planesTable.codigo, planId), eq(planesTable.activo, true)))
    .limit(1);

  if (!planRow) {
    return { ok: false, error: "No encontramos ese plan activo." };
  }

  const plan = getPlan(planId);

  const [actual] = await db
    .select({ planCodigo: planesTable.codigo })
    .from(suscripciones)
    .innerJoin(planesTable, eq(planesTable.id, suscripciones.planId))
    .where(eq(suscripciones.empresaId, user.empresaId))
    .orderBy(desc(suscripciones.creadoEn))
    .limit(1);

  if (actual?.planCodigo === planId) {
    return { ok: true, plan: plan.nombre };
  }

  const limite = await validarUsoActual(user.empresaId, plan, {
    usuarios: 0,
    sucursales: 0,
  });
  if (!limite.ok) return limite;

  await db.transaction(async (tx) => {
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
