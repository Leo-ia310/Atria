import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const snapshot = z.string().regex(/^\d+:\d+:(\d+(,\d+)*)?$/).max(200000);
export const cursorStateSchema = z.object({ snapshot, until: snapshot.optional(), after: z.string().regex(/^\d+$/).default("0") });
export type DesktopCursorState = z.infer<typeof cursorStateSchema>;
export function desktopScopeHash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function secret() { if (!process.env.AUTH_SECRET) throw new Error("Falta configuración de autenticación."); return process.env.AUTH_SECRET; }
export function signDesktopCursor(state: DesktopCursorState, scope: { empresaId: string; userId: string; deviceId: string; scopeHash: string }): string {
  const payload = Buffer.from(JSON.stringify({ ...state, ...scope, exp: Date.now() + 30 * 86400000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function readDesktopCursor(cursor: string, scope: { empresaId: string; userId: string; deviceId: string; scopeHash: string }): DesktopCursorState {
  const [payload, signature, extra] = cursor.split(".");
  const expected = createHmac("sha256", secret()).update(payload ?? "").digest();
  const received = Buffer.from(signature ?? "", "base64url");
  if (extra || expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error("RESET_REQUIRED");
  let value: unknown; try { value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw new Error("RESET_REQUIRED"); }
  const parsed = cursorStateSchema.extend({ empresaId: z.literal(scope.empresaId), userId: z.literal(scope.userId), deviceId: z.literal(scope.deviceId), scopeHash: z.literal(scope.scopeHash), exp: z.number().min(Date.now()) }).safeParse(value);
  if (!parsed.success) throw new Error("RESET_REQUIRED");
  return { snapshot: parsed.data.snapshot, until: parsed.data.until, after: parsed.data.after };
}
