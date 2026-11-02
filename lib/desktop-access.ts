import { z } from "zod";

/** Server-derived, device-bound authorization cached in OS-protected storage. */
export const desktopAccessSchema = z.object({
  version: z.literal(1),
  userId: z.string().min(1),
  empresaId: z.string().min(1),
  deviceId: z.string().min(1),
  expiresAt: z.string().datetime(),
  sucursalIds: z.array(z.string()).max(1000),
  modules: z.array(z.string()).max(100),
  permissions: z.array(z.string()).max(1000),
  admin: z.boolean(),
  blocked: z.boolean(),
});
export type DesktopAccess = z.infer<typeof desktopAccessSchema>;

export function desktopModuleAllowed(access: DesktopAccess | null | undefined, ...modules: string[]): boolean {
  return Boolean(access && !access.blocked && Date.parse(access.expiresAt) > Date.now()
    && modules.some((module) => access.modules.includes(module)));
}

export function desktopPermissionAllowed(access: DesktopAccess | null | undefined, ...permissions: string[]): boolean {
  return Boolean(access && !access.blocked && Date.parse(access.expiresAt) > Date.now()
    && (access.admin || permissions.some((permission) => access.permissions.includes(permission))));
}
