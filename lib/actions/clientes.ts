"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import { clientes } from "@/lib/db/schema";
import { clienteSchema } from "@/lib/validations/clientes";
import { requireSession } from "@/lib/actions/session-helpers";
import { validarAccion, validarLimitePlan } from "@/lib/server-access";

type Resultado = { ok: true; id: string } | { ok: false; error: string };

export async function crearCliente(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, {
    modulo: "clientes",
    permisos: ["ventas.crear", "ventas.ver"],
  });
  if (!acceso.ok) return acceso;
  const parsed = clienteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  const limite = await validarLimitePlan(acceso.access, user.empresaId, "clientes");
  if (!limite.ok) return limite;
  try {
    const [creado] = await dbConEmpresa(user.empresaId, (tx) =>
      tx
        .insert(clientes)
        .values({
          empresaId: user.empresaId,
          nombre: d.nombre,
          identificacionFiscal: d.identificacionFiscal || null,
          email: d.email || null,
          telefono: d.telefono || null,
          direccion: d.direccion || null,
          limiteCredito: d.limiteCredito.toString(),
          diasCredito: d.diasCredito,
          esConsumidorFinal: d.esConsumidorFinal,
          notas: d.notas || null,
          activo: true,
        })
        .returning({ id: clientes.id }),
    );
    revalidatePath("/clientes");
    return { ok: true, id: creado.id };
  } catch (err) {
    console.error("[crearCliente]", err);
    return { ok: false, error: "No pudimos crear el cliente." };
  }
}

export async function actualizarCliente(id: string, input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, {
    modulo: "clientes",
    permisos: ["ventas.crear", "ventas.ver"],
  });
  if (!acceso.ok) return acceso;
  const parsed = clienteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    await dbConEmpresa(user.empresaId, (tx) =>
      tx
        .update(clientes)
        .set({
          nombre: d.nombre,
          identificacionFiscal: d.identificacionFiscal || null,
          email: d.email || null,
          telefono: d.telefono || null,
          direccion: d.direccion || null,
          limiteCredito: d.limiteCredito.toString(),
          diasCredito: d.diasCredito,
          esConsumidorFinal: d.esConsumidorFinal,
          notas: d.notas || null,
        })
        .where(and(eq(clientes.id, id), eq(clientes.empresaId, user.empresaId))),
    );
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${id}`);
    return { ok: true, id };
  } catch (err) {
    console.error("[actualizarCliente]", err);
    return { ok: false, error: "No pudimos actualizar el cliente." };
  }
}
