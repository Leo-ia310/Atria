import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { dbSuperAdmin } from "./db";
import { empresas, usuarios, sucursales, usuarioSucursales } from "./db/schema";
import { firmarGrantCanonico } from "./desktop-grant";
import { ensureDesktopSchema } from "./desktop-schema";
import type { SessionUser } from "./actions/session-helpers";

export const desktopGrantSchema = z.object({ userId: z.string().uuid(), empresaId: z.string().uuid(), deviceId: z.string().uuid(),
  sucursalIds: z.array(z.string().uuid()).max(1000), issuedAt: z.string().datetime(), expiresAt: z.string().datetime(), signature: z.string().regex(/^[a-f0-9]{64}$/) });
export type DesktopGrant = z.infer<typeof desktopGrantSchema>;
export class DesktopAuthError extends Error { readonly status = 401; }

export async function authorizeDesktop(grant: DesktopGrant, deviceId: string): Promise<{ user: SessionUser; sucursalIds: string[] }> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Servidor sin configuración de autenticación.");
  const expected = Buffer.from(firmarGrantCanonico(secret, grant), "hex");
  const received = Buffer.from(grant.signature, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected) || deviceId !== grant.deviceId
    || Date.parse(grant.expiresAt) <= Date.now() || Date.parse(grant.issuedAt) > Date.now() + 60000) throw new DesktopAuthError("La autorización del equipo venció. Inicia sesión con conexión.");
  await ensureDesktopSchema();
  return dbSuperAdmin(async (tx) => {
    const [user] = await tx.select({ id: usuarios.id, empresaId: usuarios.empresaId, rolId: usuarios.rolId,
      esSuperAdmin: usuarios.esSuperAdmin, nombre: usuarios.nombre, email: usuarios.email }).from(usuarios)
      .innerJoin(empresas, eq(empresas.id, usuarios.empresaId)).where(and(eq(usuarios.id, grant.userId), eq(usuarios.empresaId, grant.empresaId), eq(usuarios.activo, true), isNull(usuarios.eliminadoEn), eq(empresas.activa,true))).limit(1);
    if (!user) throw new DesktopAuthError("El usuario o la empresa ya no tienen acceso.");
    const device = await tx.execute(sql`select 1 from desktop_devices d join desktop_device_users u using(empresa_id,device_id)
      where d.empresa_id=${user.empresaId}::uuid and d.device_id=${deviceId}::uuid and u.user_id=${user.id}::uuid
      and d.revoked_at is null and u.revoked_at is null and u.offline_access_valid_until > now()`);
    if (!device.length) throw new DesktopAuthError("Este dispositivo no está autorizado. Inicia sesión con conexión para registrarlo.");
    const assigned = await tx.select({ id: sucursales.id, activa: sucursales.activa, eliminadoEn: sucursales.eliminadoEn }).from(usuarioSucursales).innerJoin(sucursales,eq(sucursales.id,usuarioSucursales.sucursalId))
      .where(and(eq(usuarioSucursales.usuarioId,user.id),eq(sucursales.empresaId,user.empresaId)));
    const current = assigned.length ? assigned.filter((s)=>s.activa && !s.eliminadoEn) : await tx.select({ id: sucursales.id }).from(sucursales).where(and(eq(sucursales.empresaId,user.empresaId),eq(sucursales.activa,true),isNull(sucursales.eliminadoEn)));
    return { user, sucursalIds: current.map((row) => row.id).filter((id) => grant.sucursalIds.includes(id)) };
  });
}
