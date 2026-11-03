import { and, eq } from "drizzle-orm";
import { dbConEmpresa } from "./db";
import { usuarios, roles, empresas } from "./db/schema";
import { inBusinessContext } from "./business-context";
import { getAccessContext } from "./server-access";
import { getLimitesIA } from "./pricing";
import { actualizarPerfil, cambiarMiPassword } from "./actions/configuracion";
import { responderSoporte } from "./actions/soporte";
import { inAuthenticatedUserContext } from "./authenticated-user-context";
import type { SessionUser } from "./actions/session-helpers";
import {
  selfServiceSchema,
  type SelfServiceCommand,
  type SelfServiceResult,
} from "./desktop-self-service-contract";

/** Never enqueue or persist a request: account secrets remain in request memory only. */
export async function executeDesktopSelfService(
  user: SessionUser,
  branches: string[],
  command: SelfServiceCommand,
): Promise<SelfServiceResult> {
  const parsed = selfServiceSchema.parse(command);
  const access = await getAccessContext(user);
  if (access.suscripcionBloqueada)
    return {
      ok: false,
      error: "Tu cuenta requiere revisión en ARCA web antes de continuar.",
    };
  if (parsed.action === "support")
    return inAuthenticatedUserContext(user, () =>
      responderSoporte(parsed.input),
    );
  return dbConEmpresa(user.empresaId, (tx) =>
    inBusinessContext(
      { user, tx, sucursalIds: branches, invalidations: new Set() },
      async (): Promise<SelfServiceResult> => {
        if (parsed.action === "password")
          return cambiarMiPassword(parsed.input);
        if (parsed.action === "profile") {
          const result = await actualizarPerfil(parsed.input);
          if (!result.ok) return result;
        }
        const [row] = await tx
          .select({
            nombre: usuarios.nombre,
            email: usuarios.email,
            telefono: usuarios.telefono,
            rol: roles.nombre,
            empresa: empresas.razonSocial,
            comercial: empresas.nombreComercial,
          })
          .from(usuarios)
          .leftJoin(roles, eq(roles.id, usuarios.rolId))
          .innerJoin(empresas, eq(empresas.id, usuarios.empresaId))
          .where(
            and(
              eq(usuarios.id, user.id),
              eq(usuarios.empresaId, user.empresaId),
            ),
          )
          .limit(1);
        if (!row) return { ok: false, error: "Usuario no encontrado." };
        const limits = getLimitesIA(access.plan.id);
        return {
          ok: true,
          profile: {
            nombre: row.nombre,
            email: row.email,
            telefono: row.telefono ?? "",
            rol: row.rol,
            empresa: row.comercial || row.empresa,
            planNombre: access.plan.nombre,
            preguntasDiarias: limits.preguntasDiarias,
            palabrasPorPregunta: limits.palabrasPorPregunta,
          },
        };
      },
    ),
  );
}
