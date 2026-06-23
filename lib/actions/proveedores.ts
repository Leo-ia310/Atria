"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proveedores } from "@/lib/db/schema";
import { proveedorSchema } from "@/lib/validations/proveedores";
import { requireSession } from "@/lib/actions/session-helpers";

type Resultado = { ok: true; id: string } | { ok: false; error: string };

export async function crearProveedor(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const parsed = proveedorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;
  try {
    const [creado] = await db
      .insert(proveedores)
      .values({
        empresaId: user.empresaId,
        razonSocial: d.razonSocial,
        nombreComercial: d.nombreComercial || null,
        identificacionFiscal: d.identificacionFiscal || null,
        email: d.email || null,
        telefono: d.telefono || null,
        direccion: d.direccion || null,
        diasCredito: d.diasCredito,
        contacto: d.contacto || null,
        notas: d.notas || null,
        activo: true,
      })
      .returning({ id: proveedores.id });
    revalidatePath("/compras/proveedores");
    return { ok: true, id: creado.id };
  } catch (err) {
    console.error("[crearProveedor]", err);
    return { ok: false, error: "No pudimos crear el proveedor." };
  }
}

export async function actualizarProveedor(id: string, input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const parsed = proveedorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;
  try {
    await db
      .update(proveedores)
      .set({
        razonSocial: d.razonSocial,
        nombreComercial: d.nombreComercial || null,
        identificacionFiscal: d.identificacionFiscal || null,
        email: d.email || null,
        telefono: d.telefono || null,
        direccion: d.direccion || null,
        diasCredito: d.diasCredito,
        contacto: d.contacto || null,
        notas: d.notas || null,
      })
      .where(and(eq(proveedores.id, id), eq(proveedores.empresaId, user.empresaId)));
    revalidatePath("/compras/proveedores");
    return { ok: true, id };
  } catch (err) {
    console.error("[actualizarProveedor]", err);
    return { ok: false, error: "No pudimos actualizar el proveedor." };
  }
}
