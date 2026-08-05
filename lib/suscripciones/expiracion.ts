import { and, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { suscripciones } from "@/lib/db/schema";

type EstadoSuscripcion = (typeof suscripciones.estado.enumValues)[number];

const ESTADOS_CON_PERIODO_VIVO: EstadoSuscripcion[] = ["activa", "trial"];

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
}: { ahora?: Date } = {}): Promise<{ expiradas: number }> {
  const filas = await db
    .update(suscripciones)
    .set({ estado: "vencida" })
    .where(
      and(
        inArray(suscripciones.estado, ESTADOS_CON_PERIODO_VIVO),
        lt(suscripciones.finPeriodo, ahora),
      ),
    )
    .returning({ id: suscripciones.id });

  return { expiradas: filas.length };
}
