"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type SessionUser = {
  id: string;
  empresaId: string;
  rolId: string | null;
  esSuperAdmin: boolean;
  nombre: string;
  email: string;
};

/**
 * Garantiza que hay sesión activa. Redirige a /login si no.
 * Devuelve los datos del usuario tipados — usar en server components/actions.
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return {
    id: session.user.id,
    empresaId: session.user.empresaId,
    rolId: session.user.rolId,
    esSuperAdmin: session.user.esSuperAdmin,
    nombre: session.user.nombre,
    email: session.user.email ?? "",
  };
}

export async function getSessionOrNull(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    empresaId: session.user.empresaId,
    rolId: session.user.rolId,
    esSuperAdmin: session.user.esSuperAdmin,
    nombre: session.user.nombre,
    email: session.user.email ?? "",
  };
}
