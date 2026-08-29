"use server";

import { z } from "zod";
import { dbConEmpresa } from "@/lib/db";
import { usuarioOnboardingModulos } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";

const moduloSchema = z.string().trim().min(1).max(80);

export async function marcarOnboardingModuloVisto(
  modulo: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = moduloSchema.safeParse(modulo);
  if (!parsed.success) return { ok: false, error: "Modulo invalido" };

  const user = await requireSession();
  try {
    await dbConEmpresa(user.empresaId, (tx) =>
      tx
        .insert(usuarioOnboardingModulos)
        .values({
          empresaId: user.empresaId,
          usuarioId: user.id,
          modulo: parsed.data,
        })
        .onConflictDoNothing({
          target: [
            usuarioOnboardingModulos.usuarioId,
            usuarioOnboardingModulos.modulo,
          ],
        }),
    );
    return { ok: true };
  } catch (err) {
    console.error("[marcarOnboardingModuloVisto]", err);
    return { ok: false, error: "No pudimos guardar el tutorial visto." };
  }
}
