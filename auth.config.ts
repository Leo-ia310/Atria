/**
 * Edge-safe NextAuth config. NO importes nada que toque DB o Node-only APIs aquí.
 * Es lo que consume el middleware. La config completa (con DB) vive en auth.ts.
 *
 * Las extensiones de tipos (Session, User, JWT) viven aquí para que el middleware
 * y los componentes server las vean sin importar auth.ts (que es Node-only).
 */

import type { NextAuthConfig, DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      empresaId: string;
      rolId: string | null;
      esSuperAdmin: boolean;
      nombre: string;
    } & DefaultSession["user"];
  }

  interface User {
    empresaId: string;
    rolId: string | null;
    esSuperAdmin: boolean;
    nombre: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    empresaId: string;
    rolId: string | null;
    esSuperAdmin: boolean;
    nombre: string;
  }
}

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.empresaId = user.empresaId;
        token.rolId = user.rolId;
        token.esSuperAdmin = user.esSuperAdmin;
        token.nombre = user.nombre;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (token && session.user) {
        session.user.id = token.sub ?? "";
        session.user.empresaId = token.empresaId;
        session.user.rolId = token.rolId;
        session.user.esSuperAdmin = token.esSuperAdmin;
        session.user.nombre = token.nombre;
      }
      return session;
    },
  },
};
