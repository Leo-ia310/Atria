import { z } from "zod";
import {
  authorizeDesktop,
  desktopGrantSchema,
  DesktopAuthError,
} from "@/lib/desktop-auth";
import { executeDesktopSelfService } from "@/lib/desktop-self-service";
import { selfServiceSchema } from "@/lib/desktop-self-service-contract";
import { rateLimit } from "@/lib/redis/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z
  .object({
    deviceId: z.string().uuid(),
    auth: desktopGrantSchema,
    command: selfServiceSchema,
  })
  .strict();
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 20000)
      return Response.json(
        { ok: false, error: "Solicitud demasiado larga." },
        { status: 413, headers },
      );
    const body = schema.parse(JSON.parse(text));
    const { user, sucursalIds } = await authorizeDesktop(
      body.auth,
      body.deviceId,
    );
    const limit = await rateLimit(
      `desktop-self-${body.command.action}`,
      `${user.empresaId}:${user.id}:${body.deviceId}`,
      body.command.action === "password" ? 5 : 30,
      60,
    );
    if (!limit.permitido)
      return Response.json(
        { ok: false, error: "Espera antes de reintentar." },
        { status: 429, headers },
      );
    return Response.json(
      await executeDesktopSelfService(user, sucursalIds, body.command),
      { headers },
    );
  } catch (error) {
    if (error instanceof DesktopAuthError)
      return Response.json(
        { ok: false, error: error.message },
        { status: 401, headers },
      );
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return Response.json(
        { ok: false, error: "Solicitud inválida." },
        { status: 400, headers },
      );
    return Response.json(
      {
        ok: false,
        error:
          "No se pudo completar la solicitud. Si cambiaste tu contraseña y no recibiste confirmación, prueba iniciar sesión con la nueva.",
      },
      { status: 503, headers },
    );
  }
}
