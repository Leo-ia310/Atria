/**
 * Login para la app de escritorio (Arca Desktop).
 *
 * Ruta AISLADA y ADITIVA: no modifica el flujo de NextAuth del sitio web.
 * Reutiliza el mismo verificador de credenciales (bcrypt contra `usuarios`) y
 * emite un "offline grant" firmado con AUTH_SECRET que el escritorio guarda
 * para operar sin conexion hasta su vencimiento.
 */

import bcrypt from "bcryptjs";
import { and, eq, isNull, sql } from "drizzle-orm";
import { dbSuperAdmin } from "@/lib/db";
import {
  empresas,
  roles,
  sucursales,
  usuarioSucursales,
  usuarios,
} from "@/lib/db/schema";
import { loginSchema } from "@/lib/validations/auth";
import { rateLimit } from "@/lib/redis/rate-limit";
import { firmarGrantCanonico } from "@/lib/desktop-grant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRANT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
const LOGIN_MAX = 10;
const LOGIN_WINDOW_SEG = 5 * 60;
const LOGIN_MAX_IP = 40;

function obtenerIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "desconocida";
}

export async function POST(request: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "Servidor sin AUTH_SECRET" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Cuerpo invalido" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Credenciales invalidas" }, { status: 401 });
  }
  const email = parsed.data.email;
  const { password } = parsed.data;
  const deviceId =
    typeof (body as { deviceId?: unknown }).deviceId === "string"
      ? ((body as { deviceId: string }).deviceId || "desconocido")
      : "desconocido";

  const ip = obtenerIp(request);
  const [limEmail, limIp] = await Promise.all([
    rateLimit("desktop-login", email, LOGIN_MAX, LOGIN_WINDOW_SEG),
    rateLimit("desktop-login-ip", ip, LOGIN_MAX_IP, LOGIN_WINDOW_SEG),
  ]);
  if (!limEmail.permitido || !limIp.permitido) {
    return Response.json({ ok: false, error: "Demasiados intentos" }, { status: 429 });
  }

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
      .where(and(sql`lower(trim(${usuarios.email})) = ${email}`, isNull(usuarios.eliminadoEn)))
      .limit(1),
  );

  const user = filas[0];
  if (!user || !user.activo || !user.empresaActiva) {
    return Response.json({ ok: false, error: "Credenciales invalidas" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return Response.json({ ok: false, error: "Credenciales invalidas" }, { status: 401 });
  }

  // Rol + sucursales asignadas (o todas las de la empresa si no tiene asignacion explicita).
  const [rolFilas, sucursalesAsignadas] = await Promise.all([
    user.rolId
      ? dbSuperAdmin((tx) =>
          tx.select({ nombre: roles.nombre }).from(roles).where(eq(roles.id, user.rolId!)).limit(1),
        )
      : Promise.resolve([] as { nombre: string }[]),
    dbSuperAdmin((tx) =>
      tx
        .select({ id: sucursales.id, nombre: sucursales.nombre })
        .from(usuarioSucursales)
        .innerJoin(sucursales, eq(usuarioSucursales.sucursalId, sucursales.id))
        .where(eq(usuarioSucursales.usuarioId, user.id)),
    ),
  ]);

  const listaSucursales =
    sucursalesAsignadas.length > 0
      ? sucursalesAsignadas
      : await dbSuperAdmin((tx) =>
          tx
            .select({ id: sucursales.id, nombre: sucursales.nombre })
            .from(sucursales)
            .where(eq(sucursales.empresaId, user.empresaId)),
        );

  await dbSuperAdmin((tx) =>
    tx.update(usuarios).set({ ultimoLogin: new Date() }).where(eq(usuarios.id, user.id)),
  );

  const rolNombre = rolFilas[0]?.nombre ?? null;
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + GRANT_TTL_MS).toISOString();
  const signature = firmarGrantCanonico(secret, {
    userId: user.id,
    empresaId: user.empresaId,
    sucursalIds: listaSucursales.map((s) => s.id),
    deviceId,
    issuedAt,
    expiresAt,
  });

  return Response.json({
    ok: true,
    user: {
      id: user.id,
      empresaId: user.empresaId,
      nombre: user.nombre,
      email: user.email,
      rol: rolNombre,
      esSuperAdmin: user.esSuperAdmin,
    },
    sucursales: listaSucursales,
    roles: rolNombre ? [rolNombre] : [],
    permissions: [],
    grant: { issuedAt, expiresAt, signature },
  });
}
