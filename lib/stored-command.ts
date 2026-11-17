import { sql } from "drizzle-orm";
import { currentBusinessContext } from "./business-context";
export { commandHash } from "./operation-hash";
import { commandHash } from "./operation-hash";
type Scope = { branch: string; kind: string; requestId: string };
/** Uses the existing commercial attempt registry and root transaction, never another queue. */
export async function storedCommand<T extends { ok: boolean }>(
  scope: Scope,
  input: unknown,
  execute: () => Promise<T>,
): Promise<T> {
  const context = currentBusinessContext();
  if (!context) throw new Error("Falta transacción.");
  const { tx, user } = context,
    hash = commandHash(input);
  const [previous] = await tx.execute(
    sql`select hash,resultado,sucursal_id,clase from comercial_intentos where empresa_id=${user.empresaId}::uuid and usuario_id=${user.id}::uuid and request_id=${scope.requestId}::uuid`,
  );
  if (previous) {
    if (
      previous.hash !== hash ||
      previous.sucursal_id !== scope.branch ||
      previous.clase !== scope.kind
    )
      throw new Error(
        "La clave ya corresponde a otro contenido o fue descartada.",
      );
    return previous.resultado as T;
  }
  const result = await execute();
  if (result.ok)
    await tx.execute(
      sql`insert into comercial_intentos(empresa_id,usuario_id,request_id,sucursal_id,clase,hash,resultado) values(${user.empresaId}::uuid,${user.id}::uuid,${scope.requestId}::uuid,${scope.branch}::uuid,${scope.kind},${hash},${JSON.stringify(result)}::jsonb)`,
    );
  return result;
}
export async function recoverStored<T>(
  scope: Scope,
  attemptId: string,
): Promise<T | { ok: true; discarded: true }> {
  const context = currentBusinessContext();
  if (!context) throw new Error("Falta transacción.");
  const { tx, user } = context;
  const [previous] = await tx.execute(
    sql`select resultado,sucursal_id,clase from comercial_intentos where empresa_id=${user.empresaId}::uuid and usuario_id=${user.id}::uuid and request_id=${attemptId}::uuid`,
  );
  if (previous) {
    if (previous.sucursal_id !== scope.branch || previous.clase !== scope.kind)
      throw new Error("Intento de otro contexto.");
    return previous.resultado as T;
  }
  const result = { ok: true as const, discarded: true as const };
  await tx.execute(
    sql`insert into comercial_intentos(empresa_id,usuario_id,request_id,sucursal_id,clase,hash,resultado) values(${user.empresaId}::uuid,${user.id}::uuid,${attemptId}::uuid,${scope.branch}::uuid,${scope.kind},'discarded',${JSON.stringify(result)}::jsonb)`,
  );
  return result;
}
