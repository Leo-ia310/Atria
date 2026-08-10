import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { dbSuperAdmin } from "@/lib/db";
import { empresas, pagosSuscripcion, planes, suscripciones } from "@/lib/db/schema";
import { DIAS_GRACIA_PAGO, type PlanId } from "@/lib/pricing";

type EstadoSuscripcion = (typeof suscripciones.estado.enumValues)[number];

const ESTADOS_CON_PERIODO_VIVO: EstadoSuscripcion[] = ["activa", "trial"];
const ESTADOS_PURGABLES: EstadoSuscripcion[] = ["trial", "vencida"];
const PLANES_PAGADOS: PlanId[] = ["pro", "enterprise"];

export function suscripcionVigente(
  estado: EstadoSuscripcion,
  finPeriodo: Date,
  ahora: Date = new Date(),
): boolean {
  if (!ESTADOS_CON_PERIODO_VIVO.includes(estado)) return false;
  return finPeriodo.getTime() > ahora.getTime();
}

export async function expirarSuscripcionesVencidas({
  ahora = new Date(),
}: { ahora?: Date } = {}): Promise<{ expiradas: number; eliminadas: number }> {
  return dbSuperAdmin(async (tx) => {
    const vencidas = await tx
      .select({ id: suscripciones.id })
      .from(suscripciones)
      .innerJoin(planes, eq(planes.id, suscripciones.planId))
      .where(
        and(
          inArray(suscripciones.estado, ESTADOS_CON_PERIODO_VIVO),
          inArray(planes.codigo, PLANES_PAGADOS),
          lt(suscripciones.finPeriodo, ahora),
        ),
      );

    let expiradas = 0;
    const vencidasIds = vencidas.map((row) => row.id);
    if (vencidasIds.length > 0) {
      const filas = await tx
        .update(suscripciones)
        .set({ estado: "vencida" })
        .where(inArray(suscripciones.id, vencidasIds))
        .returning({ id: suscripciones.id });
      expiradas = filas.length;
    }

    const corteEliminacion = new Date(ahora);
    corteEliminacion.setDate(corteEliminacion.getDate() - DIAS_GRACIA_PAGO);

    const candidatas = await tx
      .select({
        suscripcionId: suscripciones.id,
        empresaId: suscripciones.empresaId,
      })
      .from(suscripciones)
      .innerJoin(planes, eq(planes.id, suscripciones.planId))
      .where(
        and(
          inArray(suscripciones.estado, ESTADOS_PURGABLES),
          inArray(planes.codigo, PLANES_PAGADOS),
          lt(suscripciones.finPeriodo, corteEliminacion),
        ),
      );

    let eliminadas = 0;
    for (const candidata of candidatas) {
      const [ultima] = await tx
        .select({ id: suscripciones.id })
        .from(suscripciones)
        .where(eq(suscripciones.empresaId, candidata.empresaId))
        .orderBy(desc(suscripciones.creadoEn))
        .limit(1);

      if (ultima?.id !== candidata.suscripcionId) continue;

      const [pago] = await tx
        .select({ id: pagosSuscripcion.id })
        .from(pagosSuscripcion)
        .where(
          and(
            eq(pagosSuscripcion.empresaId, candidata.empresaId),
            eq(pagosSuscripcion.estado, "completado"),
          ),
        )
        .limit(1);

      if (pago) continue;

      const borradas = await tx
        .delete(empresas)
        .where(eq(empresas.id, candidata.empresaId))
        .returning({ id: empresas.id });
      eliminadas += borradas.length;
    }

    return { expiradas, eliminadas };
  });
}
