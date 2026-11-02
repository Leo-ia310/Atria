import { sql } from "drizzle-orm";
import { dbConEmpresa } from "./db";
import type { SessionUser } from "./actions/session-helpers";
import {
  desktopScopeHash,
  readDesktopCursor,
  signDesktopCursor,
} from "./desktop-cursor";
/** Snapshot cursors include transactions which were in flight at the last check. */
export async function readWebChanges(
  user: Pick<SessionUser, "id" | "empresaId">,
  cursor: string | null,
) {
  const scope = {
    empresaId: user.empresaId,
    userId: user.id,
    deviceId: "web",
    scopeHash: desktopScopeHash(["web-changes-v1", user.id, user.empresaId]),
  };
  let previous = null,
    reset = false;
  if (cursor)
    try {
      previous = readDesktopCursor(cursor, scope);
    } catch {
      reset = true;
    }
  return dbConEmpresa(user.empresaId, async (tx) => {
    const [snapshot] = await tx.execute(
        sql`select pg_current_snapshot()::text as value`,
      ),
      until = String(snapshot.value);
    const changed = previous
      ? await tx.execute(
          sql`select 1 from desktop_change_log where empresa_id=${user.empresaId}::uuid and change_tx>=${previous.snapshot.split(":")[0]}::xid8 and not pg_visible_in_snapshot(change_tx,${previous.snapshot}::pg_snapshot) and pg_visible_in_snapshot(change_tx,${until}::pg_snapshot) limit 1`,
        )
      : [];
    return {
      changed: reset || changed.length > 0,
      cursor: signDesktopCursor({ snapshot: until, after: "0" }, scope),
    };
  });
}
