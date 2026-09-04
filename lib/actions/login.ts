"use server";

import { and, isNull, sql } from "drizzle-orm";
import { dbSuperAdmin } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";

export async function verificarCorreoLogin(
  emailInput: string,
): Promise<{ existe: boolean }> {
  const email = emailInput.trim().toLowerCase();
  if (!email) return { existe: false };

  const filas = await dbSuperAdmin((tx) =>
    tx
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(sql`lower(trim(${usuarios.email})) = ${email}`, isNull(usuarios.eliminadoEn)))
      .limit(1),
  );

  return { existe: filas.length > 0 };
}
