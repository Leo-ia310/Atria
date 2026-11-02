import { z } from "zod";
import { authorizeDesktop, desktopGrantSchema, DesktopAuthError } from "@/lib/desktop-auth";
import { applyDesktopOperation, desktopOperationSchema, DesktopOperationError, operationPriority } from "@/lib/desktop-operations";
import { rateLimit } from "@/lib/redis/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const bodySchema = z.object({ deviceId: z.string().uuid(), auth: desktopGrantSchema, operations: z.array(desktopOperationSchema).max(50) });

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 5000000) return Response.json({ ok: false, error: "Lote demasiado grande" }, { status: 413 });
    const body = bodySchema.parse(JSON.parse(raw));
    const { user, sucursalIds } = await authorizeDesktop(body.auth,body.deviceId);
    const limit = await rateLimit("desktop-push",`${user.empresaId}:${body.deviceId}`,60,60);
    if (!limit.permitido) return Response.json({ ok: false, error: "Espera antes de reintentar" }, { status: 429 });
    const accepted: Array<{ id: string; result: unknown }> = [];
    const conflicts: Array<{ id: string; reason: string; code: string }> = [];
    const errors: Array<{ id: string; error: string; code: string; retryable: boolean }> = [];
    for (const op of body.operations.slice().sort((a,b) => operationPriority(a)-operationPriority(b))) {
      try {
        accepted.push({ id: op.id, result: await applyDesktopOperation(user,body.deviceId,sucursalIds,op) });
      } catch (error) {
        if (error instanceof DesktopOperationError && !error.retryable) conflicts.push({ id: op.id, reason: error.message, code: error.code });
        else if (error instanceof z.ZodError) conflicts.push({ id: op.id, reason: "La operación contiene datos incompatibles. Requiere revisión.", code: "INVALID_PAYLOAD" });
        else {
          errors.push({ id: op.id, error: error instanceof DesktopOperationError ? error.message : "No se pudo aplicar la operación. Se conservará para reintentar.", code: error instanceof DesktopOperationError ? error.code : "SERVER_ERROR", retryable: true });
          if (!(error instanceof DesktopOperationError)) console.error("[desktop-push] Operación revertida por error del servidor.");
        }
      }
    }
    return Response.json({ ok: true, applied: true, accepted, conflicts, errors }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DesktopAuthError) return Response.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ ok: false, error: "Solicitud de sincronización inválida" }, { status: 400 });
    console.error("[desktop-push] No se pudo preparar la sincronización.");
    return Response.json({ ok: false, error: "Servidor temporalmente no disponible" }, { status: 503 });
  }
}
