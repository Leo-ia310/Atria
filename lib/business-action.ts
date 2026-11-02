import { revalidatePath as nextRevalidatePath, revalidateTag as nextRevalidateTag } from "next/cache";
import { sql } from "drizzle-orm";
import { dbConEmpresa } from "./db";
import { currentBusinessContext, inBusinessContext } from "./business-context";
import type { SessionUser } from "./actions/session-helpers";

class RejectedAction extends Error {
  constructor(readonly result: unknown) { super("Business action rejected"); }
}

/** One transaction for the existing service, its payments, stock and accounting. */
export async function executeBusinessAction<T extends { ok: boolean }>(user: SessionUser, action: () => Promise<T>): Promise<T> {
  const active = currentBusinessContext();
  if (active) {
    if (active.user.id !== user.id || active.user.empresaId !== user.empresaId) throw new Error("Contexto de operación inválido.");
    return action();
  }
  const invalidations = new Set<string>();
  try {
    const result = await dbConEmpresa(user.empresaId, async (tx) => {
      // Web and Desktop use the same company lock: stock/counters read after it.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`arca-business:${user.empresaId}`}, 0))`);
      return inBusinessContext({ user, tx, invalidations }, async () => {
        const value = await action();
        if (!value.ok) throw new RejectedAction(value);
        return value;
      });
    });
    flushBusinessInvalidations(invalidations);
    return result;
  } catch (error) {
    if (error instanceof RejectedAction) return error.result as T;
    throw error;
  }
}

export function revalidateBusinessPath(path: string, type?:"layout"|"page") {
  const context = currentBusinessContext();
  if (context) context.invalidations.add(type?`\0path:${JSON.stringify([path,type])}`:path);
  else nextRevalidatePath(path,type);
}

export function revalidateBusinessTag(tag:string) {
  const context=currentBusinessContext();
  if(context)context.invalidations.add(`\0tag:${tag}`);
  else nextRevalidateTag(tag);
}

export function flushBusinessInvalidations(paths: Iterable<string>) {
  if (process.env.NODE_ENV === "test") return;
  for (const path of paths) {
    try {
      if(path.startsWith("\0tag:"))nextRevalidateTag(path.slice(5));
      else if(path.startsWith("\0path:")){const [value,type]=JSON.parse(path.slice(6)) as [string,"layout"|"page"];nextRevalidatePath(value,type);}
      else nextRevalidatePath(path);
    }
    catch { console.error("[business-action] No se pudo invalidar una ruta tras confirmar la transacción."); }
  }
}
