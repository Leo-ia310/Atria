"use server";

import bcrypt from "bcryptjs";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { dbSuperAdmin } from "@/lib/db";
import { empresas, usuarios } from "@/lib/db/schema";
import { loginSchema } from "@/lib/validations/auth";

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

export type EmpresaLoginOption = {
  id: string;
  nombre: string;
  usuario: string;
};

export type VerificarCredencialesLoginResult =
  | { ok: false; error: string }
  | { ok: true; requiereSeleccion: false; empresaId: string }
  | { ok: true; requiereSeleccion: true; empresas: EmpresaLoginOption[] };

export async function verificarCredencialesLogin(
  input: unknown,
): Promise<VerificarCredencialesLoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Correo o contraseña incorrectos" };
  }

  const { email, password, empresaId } = parsed.data;
  const filas = await dbSuperAdmin((tx) =>
    tx
      .select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        email: usuarios.email,
        passwordHash: usuarios.passwordHash,
        activo: usuarios.activo,
        empresaId: usuarios.empresaId,
        empresaActiva: empresas.activa,
        nombreComercial: empresas.nombreComercial,
        razonSocial: empresas.razonSocial,
      })
      .from(usuarios)
      .innerJoin(empresas, eq(usuarios.empresaId, empresas.id))
      .where(and(sql`lower(trim(${usuarios.email})) = ${email}`, isNull(usuarios.eliminadoEn)))
      .orderBy(desc(usuarios.creadoEn)),
  );

  const candidatos = filas.filter((fila) => fila.activo && fila.empresaActiva);
  const comparaciones = await Promise.all(
    candidatos.map(async (fila) => ({
      user: fila,
      ok: await bcrypt.compare(password, fila.passwordHash),
    })),
  );
  const coincidencias = comparaciones.filter((fila) => fila.ok).map((fila) => fila.user);
  if (coincidencias.length === 0) {
    return { ok: false, error: "Correo o contraseña incorrectos" };
  }

  if (empresaId) {
    const seleccionada = coincidencias.find((fila) => fila.empresaId === empresaId);
    if (!seleccionada) return { ok: false, error: "No pudimos validar esa empresa" };
    return { ok: true, requiereSeleccion: false, empresaId: seleccionada.empresaId };
  }

  if (coincidencias.length === 1) {
    return { ok: true, requiereSeleccion: false, empresaId: coincidencias[0].empresaId };
  }

  return {
    ok: true,
    requiereSeleccion: true,
    empresas: coincidencias.map((fila) => ({
      id: fila.empresaId,
      nombre: fila.nombreComercial || fila.razonSocial || "Empresa",
      usuario: fila.nombre,
    })),
  };
}
