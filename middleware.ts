import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-arca-pathname", pathname);
  const continuar = () =>
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

  const segmentos = pathname.split("/").filter(Boolean);
  const rutasInternas = new Set([
    "api",
    "dashboard",
    "pos",
    "caja",
    "ventas",
    "ticket",
    "menu-virtual",
    "pedidos-cocina",
    "inventario",
    "clientes",
    "compras",
    "facturas",
    "cxc",
    "cxp",
    "contabilidad",
    "tesoreria",
    "rrhh",
    "reportes",
    "configuracion",
    "mi-cuenta",
    "superadmin",
  ]);
  const esMenuPublico =
    segmentos.length === 1 && !rutasInternas.has(segmentos[0] ?? "");

  const esRutaPublica =
    pathname === "/" ||
    esMenuPublico ||
    pathname.startsWith("/precios") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/registro") ||
    pathname.startsWith("/recuperar") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".");

  if (esRutaPublica) return continuar();

  if (!session?.user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return Response.redirect(url);
  }

  if (pathname.startsWith("/superadmin") && !session.user.esSuperAdmin) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return Response.redirect(url);
  }

  return continuar();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
