import { getAccessContext } from "./server-access";
import { modulosPermitidos } from "./access-control";
import type { SessionUser } from "./actions/session-helpers";
import type { DesktopAccess } from "./desktop-access";

export async function desktopAccessFor(user: SessionUser, deviceId: string, expiresAt: string, sucursalIds: string[]): Promise<DesktopAccess> {
  const access = await getAccessContext(user);
  return {
    version: 1, userId: user.id, empresaId: user.empresaId, deviceId, expiresAt,
    sucursalIds, modules: access.suscripcionBloqueada ? [] : modulosPermitidos(access),
    permissions: access.permisos, admin: access.esAdminEmpresa, blocked: access.suscripcionBloqueada,
  };
}
