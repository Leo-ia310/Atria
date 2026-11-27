import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { SessionUser } from "./actions/session-helpers";
import { currentBusinessContext } from "./business-context";
import { webOperationAttempts } from "./db/schema";
import { validarAccion } from "./server-access";

type Failure = { ok: false; error: string };

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

export async function executeWebAttempt<T extends { ok: boolean }>(
  user: SessionUser,
  kind: "venta" | "compra" | "compra_lector",
  key: string | undefined,
  input: { almacenId: string; sucursalId?: string },
  execute: () => Promise<T>,
): Promise<T | Failure> {
  if (key === undefined) return execute();
  const parsed = z.guid().safeParse(key);
  if (!parsed.success) return { ok: false, error: "Clave de intento invalida." };

  const context = currentBusinessContext();
  if (!context || context.identity) return { ok: false, error: "Contexto de intento web invalido." };
  const { tx } = context;
  const [warehouse] = await tx.execute(sql`
    select a.sucursal_id from almacenes a
    join sucursales s on s.id = a.sucursal_id and s.empresa_id = a.empresa_id
    where a.id = ${input.almacenId}::uuid and a.empresa_id = ${user.empresaId}::uuid
      and a.activo and s.activa and s.eliminado_en is null
      and (
        not exists (select 1 from usuario_sucursales us join sucursales assigned on assigned.id = us.sucursal_id
          where us.usuario_id = ${user.id}::uuid and assigned.empresa_id = a.empresa_id)
        or exists (select 1 from usuario_sucursales us
          where us.usuario_id = ${user.id}::uuid and us.sucursal_id = s.id)
      )
  `);
  if (!warehouse || (input.sucursalId && warehouse.sucursal_id !== input.sucursalId)) {
    return { ok: false, error: "Almacen o sucursal no autorizados." };
  }

  const requestHash = createHash("sha256").update(JSON.stringify(canonical(input))).digest("hex");
  const scope = { empresaId: user.empresaId, userId: user.id, kind, attemptKey: parsed.data };
  const [previous] = await tx.select().from(webOperationAttempts).where(and(
    eq(webOperationAttempts.empresaId, scope.empresaId),
    eq(webOperationAttempts.userId, scope.userId),
    eq(webOperationAttempts.kind, scope.kind),
    eq(webOperationAttempts.attemptKey, scope.attemptKey),
  ));
  if (previous) {
    if((previous.result as {discarded?:boolean}).discarded)return previous.result as T;
    if (previous.requestHash !== requestHash) {
      return { ok: false, error: "La clave ya corresponde a otro intento. Revisa la operacion original." };
    }
    if ((previous.result as { pendienteVerificacion?: boolean }).pendienteVerificacion) {
      const permission = await validarAccion(user, { modulo: "cxc", permisos: ["ventas.ver", "ventas.crear"] });
      if (!permission.ok) return permission;
    }
    return previous.result as T;
  }

  const result = await execute();
  if (result.ok) await tx.insert(webOperationAttempts).values({ ...scope, requestHash, result });
  return result;
}
