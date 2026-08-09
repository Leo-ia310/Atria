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

  // Allowlist explícita de prefijos públicos. Todo lo demás requiere sesión.
  // No abrimos rutas "por defecto": añadir un módulo nuevo queda protegido
  // automáticamente hasta que se liste aquí de forma consciente.
  const PREFIJOS_PUBLICOS = [
    "/precios",
    "/legal",
    "/login",
    "/registro",
    "/recuperar",
    "/api/auth",
    "/api/cron",
    "/_next",
  ];

  // Rutas de módulos internos: NUNCA son menús públicos aunque tengan forma de
  // slug. Cualquier módulo top-level debe estar aquí para no quedar expuesto.
  const RUTAS_INTERNAS = new Set([
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

  // Los menús virtuales de restaurantes viven en `/<slug>` (un solo segmento con
  // forma de slug). Se validan contra el mismo formato que impone el registro
  // del menú y se excluyen las rutas internas, en lugar de abrir cualquier
  // segmento suelto.
  const segmentos = pathname.split("/").filter(Boolean);
  const primerSegmento = segmentos[0] ?? "";
  const esMenuPublico =
    segmentos.length === 1 &&
    !RUTAS_INTERNAS.has(primerSegmento) &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(primerSegmento);

  const esRutaPublica =
    pathname === "/" ||
    esMenuPublico ||
    PREFIJOS_PUBLICOS.some((prefijo) => pathname.startsWith(prefijo));

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
