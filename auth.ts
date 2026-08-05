/**
 * NextAuth v5 — Configuración completa (Node-only).
 * Importa este archivo desde server components, server actions y rutas API.
 * El middleware usa `auth.config.ts` (edge-safe) en su lugar.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { usuarios, empresas } from "@/lib/db/schema";
import { loginSchema } from "@/lib/validations/auth";
import { authConfig } from "@/auth.config";
import { rateLimit } from "@/lib/redis/rate-limit";

const LOGIN_MAX_INTENTOS = 10;
const LOGIN_VENTANA_SEG = 5 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Rate limiting por email (fail-open si Redis no está disponible).
        // Frena fuerza bruta de contraseñas sin tocar la fuente de verdad.
        const limite = await rateLimit(
          "login",
          email.toLowerCase(),
          LOGIN_MAX_INTENTOS,
          LOGIN_VENTANA_SEG,
        );
        if (!limite.permitido) return null;

        const filas = await db
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
          .limit(1);

        const user = filas[0];
        if (!user || !user.activo || !user.empresaActiva) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        await db
          .update(usuarios)
          .set({ ultimoLogin: new Date() })
          .where(eq(usuarios.id, user.id));

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
