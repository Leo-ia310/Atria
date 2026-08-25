import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const THEME_SCRIPT_HASH =
  "'sha256-fj3uVOKymipvmZN6ABubq+sYuMwg7OqNj44K2e4/QwI='";

function buildContentSecurityPolicy(nonce: string, strictScripts: boolean): string {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = strictScripts
    ? [
        "'self'",
        `'nonce-${nonce}'`,
        THEME_SCRIPT_HASH,
        "'strict-dynamic'",
        "https:",
        "https://www.paypal.com",
        "https://www.paypalobjects.com",
        isDev ? "'unsafe-eval'" : "",
        isDev ? "http:" : "",
      ].filter(Boolean)
    : [
        "'self'",
        "'unsafe-inline'",
        "https://www.paypal.com",
        "https://www.paypalobjects.com",
        isDev ? "'unsafe-eval'" : "",
      ].filter(Boolean);

  const connectSrc = ["'self'", "https:", "wss:", isDev ? "http:" : "", isDev ? "ws:" : ""]
    .filter(Boolean)
    .join(" ");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-src 'self' https://www.paypal.com https://www.sandbox.paypal.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "form-action 'self' https://www.paypal.com https://www.sandbox.paypal.com",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    isDev ? "" : "upgrade-insecure-requests",
  ].filter(Boolean);

  return directives.join("; ");
}

function withContentSecurityPolicy<T extends Response>(response: T, csp: string): T {
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-arca-pathname", pathname);

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
    "restaurante",
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

  // Las rutas protegidas se renderizan por request y pueden usar nonce estricto.
  // Las publicas incluyen paginas estaticas prerenderizadas; ahi evitamos exigir
  // nonce para no bloquear los scripts que ya vienen en el HTML estatico.
  const csp = buildContentSecurityPolicy(nonce, !esRutaPublica);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-nonce", nonce);
  const continuar = () =>
    withContentSecurityPolicy(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
      csp,
    );

  // Un usuario ya autenticado no debe ver pantallas de invitado (login /
  // recuperar): se le manda a su panel en vez de renderizar el formulario.
  const RUTAS_SOLO_INVITADO = ["/login", "/recuperar"];
  const esRutaSoloInvitado = RUTAS_SOLO_INVITADO.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
  );
  if (esRutaSoloInvitado && session?.user) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return withContentSecurityPolicy(NextResponse.redirect(url), csp);
  }

  if (esRutaPublica) return continuar();

  if (!session?.user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return withContentSecurityPolicy(NextResponse.redirect(url), csp);
  }

  if (pathname.startsWith("/superadmin") && !session.user.esSuperAdmin) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return withContentSecurityPolicy(NextResponse.redirect(url), csp);
  }

  return continuar();
});

export const config = {
  // Se excluyen los assets estaticos de /public (por extension): sin esto el
  // middleware redirige `/LogoARCA-mark.png` a /login (302) para visitantes no
  // autenticados, y el optimizador de Next recibe el redirect en vez de la
  // imagen y responde 400.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|bmp|woff|woff2|ttf|otf|css|js|map|txt|xml|mp4|webm|pdf)$).*)",
  ],
};
