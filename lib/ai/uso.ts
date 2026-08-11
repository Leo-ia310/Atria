import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { asistenteIaUso } from "@/lib/db/schema";
import type { PlanId } from "@/lib/pricing";

export function contarPalabras(texto: string): number {
  return texto.trim().match(/\S+/g)?.length ?? 0;
}

export async function reservarUsoIA({
  empresaId,
  usuarioId,
  planId,
  fecha,
  palabras,
  limiteDiario,
  planNombre,
}: {
  empresaId: string;
  usuarioId: string;
  planId: PlanId;
  fecha: string;
  palabras: number;
  limiteDiario: number | null;
  planNombre: string;
}): Promise<
  | { ok: true; restantesDia: number | null }
  | { ok: false; error: string; tipo?: "error" | "warning" }
> {
  await db
    .insert(asistenteIaUso)
    .values({
      empresaId,
      usuarioId,
      planCodigo: planId,
      fecha,
      preguntas: 0,
      palabrasEntrada: 0,
    })
    .onConflictDoNothing({
      target: [asistenteIaUso.empresaId, asistenteIaUso.usuarioId, asistenteIaUso.fecha],
    });

  const [row] = await db
    .update(asistenteIaUso)
    .set({
      planCodigo: planId,
      preguntas: sql`${asistenteIaUso.preguntas} + 1`,
      palabrasEntrada: sql`${asistenteIaUso.palabrasEntrada} + ${palabras}`,
      actualizadoEn: new Date(),
    })
    .where(
      and(
        eq(asistenteIaUso.empresaId, empresaId),
        eq(asistenteIaUso.usuarioId, usuarioId),
        eq(asistenteIaUso.fecha, fecha),
        limiteDiario === null ? undefined : sql`${asistenteIaUso.preguntas} < ${limiteDiario}`,
      ),
    )
    .returning({ preguntas: asistenteIaUso.preguntas });

  if (!row) {
    return {
      ok: false,
      error: `Tu plan ${planNombre} permite ${limiteDiario} usos de IA al dia. Vuelve manana o cambia a Pro para usarlo sin limite diario.`,
      tipo: "warning",
    };
  }

  return {
    ok: true,
    restantesDia: limiteDiario === null ? null : Math.max(0, limiteDiario - row.preguntas),
  };
}

export async function liberarUsoIA({
  empresaId,
  usuarioId,
  fecha,
  palabras,
}: {
  empresaId: string;
  usuarioId: string;
  fecha: string;
  palabras: number;
}) {
  try {
    await db
      .update(asistenteIaUso)
      .set({
        preguntas: sql`GREATEST(${asistenteIaUso.preguntas} - 1, 0)`,
        palabrasEntrada: sql`GREATEST(${asistenteIaUso.palabrasEntrada} - ${palabras}, 0)`,
        actualizadoEn: new Date(),
      })
      .where(
        and(
          eq(asistenteIaUso.empresaId, empresaId),
          eq(asistenteIaUso.usuarioId, usuarioId),
          eq(asistenteIaUso.fecha, fecha),
        ),
      );
  } catch (err) {
    console.error("[ia:uso:rollback]", err);
  }
}
