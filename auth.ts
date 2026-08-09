/**
 * NextAuth v5 — Configuración completa (Node-only).
 * Importa este archivo desde server components, server actions y rutas API.
 * El middleware usa `auth.config.ts` (edge-safe) en su lugar.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq, and, isNull } from "drizzle-orm";
import { dbSuperAdmin } from "@/lib/db";
import { usuarios, empresas } from "@/lib/db/schema";
import { loginSchema } from "@/lib/validations/auth";
import { authConfig } from "@/auth.config";
import { rateLimit } from "@/lib/redis/rate-limit";

const LOGIN_MAX_INTENTOS = 10;
const LOGIN_VENTANA_SEG = 5 * 60;
// Límite por IP: frena el "password spraying" (una IP probando muchos correos
// distintos), que el límite por-email no detecta. Más holgado que el de email
// porque una IP puede ser NAT/oficina compartida con varios usuarios legítimos.
const LOGIN_MAX_INTENTOS_IP = 40;

function obtenerIp(request: unknown): string {
  const headers = (request as { headers?: Headers } | undefined)?.headers;
  const forwarded = headers?.get?.("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim();
  return ip || headers?.get?.("x-real-ip")?.trim() || "desconocida";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credentials, request) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Rate limiting por email + por IP (fail-open si Redis no está
        // disponible). El de email frena fuerza bruta contra una cuenta; el de
        // IP frena el spraying (una IP contra muchas cuentas).
        const ip = obtenerIp(request);
        const [limiteEmail, limiteIp] = await Promise.all([
          rateLimit("login", email.toLowerCase(), LOGIN_MAX_INTENTOS, LOGIN_VENTANA_SEG),
          rateLimit("login-ip", ip, LOGIN_MAX_INTENTOS_IP, LOGIN_VENTANA_SEG),
        ]);
        if (!limiteEmail.permitido || !limiteIp.permitido) return null;

        // Login corre SIN sesión (no hay empresa aún): bypass de RLS.
        const filas = await dbSuperAdmin((tx) =>
          tx
            .select({
              id: usuarios.id,
              empresaId: usuarios.empresaId,
              rolId: usuarios.rolId,
              nombre: usuarios.nombre,
              email: usuarios.email,
              passwordHash: usuarios.passwordHash,
              activo: usuarios.activo,
              esSuperAdmin: usuarios.esSuperAdmin,
              empresaActiva: empresas.activa,
            })
            .from(usuarios)
            .innerJoin(empresas, eq(usuarios.empresaId, empresas.id))
            .where(and(eq(usuarios.email, email), isNull(usuarios.eliminadoEn)))
            .limit(1),
        );

        const user = filas[0];
        if (!user || !user.activo || !user.empresaActiva) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        await dbSuperAdmin((tx) =>
          tx
            .update(usuarios)
            .set({ ultimoLogin: new Date() })
            .where(eq(usuarios.id, user.id)),
        );

        return {
          id: user.id,
          email: user.email,
          name: user.nombre,
          empresaId: user.empresaId,
          rolId: user.rolId,
          nombre: user.nombre,
          esSuperAdmin: user.esSuperAdmin,
        };
      },
    }),
  ],
});
