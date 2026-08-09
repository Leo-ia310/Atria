"use server";

import { and, eq } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import { periodosContables } from "@/lib/db/schema";
import { requireSession } from "./session-helpers";
import { crearPeriodoSchema, periodoIdSchema } from "@/lib/validations/periodos";
import { validarAccion } from "@/lib/server-access";

function fechasPeriodo(anio: number, mes: number): { fechaInicio: string; fechaFin: string } {
  // UTC to avoid timezone-shifted days
  const inicio = new Date(Date.UTC(anio, mes - 1, 1));
  const fin = new Date(Date.UTC(anio, mes, 0)); // day-0 of next month = last day of this month
  return {
    fechaInicio: inicio.toISOString().slice(0, 10),
    fechaFin: fin.toISOString().slice(0, 10),
  };
}

export async function crearPeriodo(data: unknown) {
  const user = await requireSession();
  const acceso = await validarAccion(user, {
    modulo: "contabilidad",
    permisos: "contabilidad.cerrar_periodo",
  });
  if (!acceso.ok) return acceso;
  const parsed = crearPeriodoSchema.safeParse(data);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };

  const { anio, mes } = parsed.data;

  const [existente] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({ id: periodosContables.id })
      .from(periodosContables)
      .where(
        and(
          eq(periodosContables.empresaId, user.empresaId),
          eq(periodosContables.anio, anio),
          eq(periodosContables.mes, mes),
        ),
      )
      .limit(1),
  );

  if (existente) return { ok: false as const, error: "Ya existe un período para ese mes" };

  const { fechaInicio, fechaFin } = fechasPeriodo(anio, mes);

  const [nuevo] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .insert(periodosContables)
      .values({
        empresaId: user.empresaId,
        anio,
        mes,
        fechaInicio,
        fechaFin,
        estado: "abierto",
      })
      .returning({ id: periodosContables.id }),
  );

  return { ok: true as const, id: nuevo.id };
}

export async function cerrarPeriodo(data: unknown) {
  const user = await requireSession();
  const acceso = await validarAccion(user, {
    modulo: "contabilidad",
    permisos: "contabilidad.cerrar_periodo",
  });
  if (!acceso.ok) return acceso;
  const parsed = periodoIdSchema.safeParse(data);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };

  const { periodoId } = parsed.data;

  const [periodo] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({ id: periodosContables.id, estado: periodosContables.estado })
      .from(periodosContables)
      .where(
        and(
          eq(periodosContables.id, periodoId),
          eq(periodosContables.empresaId, user.empresaId),
        ),
      )
      .limit(1),
  );

  if (!periodo) return { ok: false as const, error: "Período no encontrado" };
  if (periodo.estado === "cerrado") return { ok: false as const, error: "El período ya está cerrado" };

  await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .update(periodosContables)
      .set({ estado: "cerrado", cerradoEn: new Date(), cerradoPor: user.id })
      .where(eq(periodosContables.id, periodoId)),
  );

  return { ok: true as const };
}

export async function reabrirPeriodo(data: unknown) {
  const user = await requireSession();
  const acceso = await validarAccion(user, {
    modulo: "contabilidad",
    permisos: "contabilidad.cerrar_periodo",
  });
  if (!acceso.ok) return acceso;
  const parsed = periodoIdSchema.safeParse(data);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };

  const { periodoId } = parsed.data;

  const [periodo] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({ id: periodosContables.id, estado: periodosContables.estado })
      .from(periodosContables)
      .where(
        and(
          eq(periodosContables.id, periodoId),
          eq(periodosContables.empresaId, user.empresaId),
        ),
      )
      .limit(1),
  );

  if (!periodo) return { ok: false as const, error: "Período no encontrado" };
  if (periodo.estado === "abierto") return { ok: false as const, error: "El período ya está abierto" };

  await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .update(periodosContables)
      .set({ estado: "abierto", cerradoEn: null, cerradoPor: null })
      .where(eq(periodosContables.id, periodoId)),
  );

  return { ok: true as const };
}
