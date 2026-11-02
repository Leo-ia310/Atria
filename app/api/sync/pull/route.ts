import { z } from "zod";
import { authorizeDesktop, desktopGrantSchema, DesktopAuthError } from "@/lib/desktop-auth";
import { desktopBootstrap } from "@/lib/desktop-bootstrap";
import { rateLimit } from "@/lib/redis/rate-limit";
import { desktopAccessFor } from "@/lib/desktop-access-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ deviceId: z.string().uuid(), auth: desktopGrantSchema, cursor: z.string().max(300000).optional(), pendingKeys:z.array(z.string().max(200)).max(500).default([]) });
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const { user, sucursalIds } = await authorizeDesktop(body.auth,body.deviceId);
    const limit = await rateLimit("desktop-pull",`${user.empresaId}:${body.deviceId}`,60,60);
    if (!limit.permitido) return Response.json({ ok: false, error: "Espera antes de reintentar" }, { status: 429 });
    const access = await desktopAccessFor(user, body.deviceId, body.auth.expiresAt, sucursalIds);
    if (access.blocked) return Response.json({ ok: false, access, error: "La suscripción no permite operar." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    const bootstrap = await desktopBootstrap(user,sucursalIds,{ deviceId: body.deviceId, cursor: body.cursor, pendingKeys:body.pendingKeys });
    return Response.json({ ok: true, bootstrap, access }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DesktopAuthError) return Response.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof Error && error.message === "RESET_REQUIRED") return Response.json({ ok: false, code: "RESET_REQUIRED", error: "Se requiere renovar la descarga autorizada." }, { status: 409 });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ ok: false, error: "Solicitud inválida" }, { status: 400 });
    console.error("[desktop-pull] No se pudieron descargar los cambios.");
    return Response.json({ ok: false, error: "No se pudieron descargar los cambios" }, { status: 503 });
  }
}
