import { NextResponse, type NextRequest } from "next/server";

const COOKIE_ACCESS = "atria_access";

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const esRutaPublica =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/registro") ||
    pathname.startsWith("/recuperar") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".");

  if (esRutaPublica) return NextResponse.next();

  const tokenCookie = req.cookies.get(COOKIE_ACCESS);
  if (!tokenCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
