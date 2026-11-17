import { z } from "zod";
import {
  authorizeDesktop,
  desktopGrantSchema,
  DesktopAuthError,
} from "@/lib/desktop-auth";
import { commercialCommandSchema } from "@/lib/commercial-core";
import { executeCommercial } from "@/lib/commercial-service";
import { rateLimit } from "@/lib/redis/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z
  .object({
    deviceId: z.string().uuid(),
    auth: desktopGrantSchema,
    command: commercialCommandSchema,
    capability: z.literal("commercial-v1"),
  })
  .strict();
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const text = await request.text();
    if (text.length > 200000)
      return Response.json(
        { ok: false, error: "Documento demasiado grande." },
        { status: 413, headers },
      );
    const b = schema.parse(JSON.parse(text));
    const { user, sucursalIds } = await authorizeDesktop(b.auth, b.deviceId);
    const limit = await rateLimit(
      "commercial",
      `${user.empresaId}:${user.id}:${b.deviceId}`,
      120,
      60,
    );
    if (!limit.permitido)
      return Response.json(
        { ok: false, error: "Espera antes de reintentar." },
        { status: 429, headers },
      );
    return Response.json(
      await executeCommercial(user, b.command, b.deviceId, sucursalIds),
      { headers },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof DesktopAuthError
            ? error.message
            : "Solicitud comercial inválida.",
      },
      { status: error instanceof DesktopAuthError ? 401 : 400, headers },
    );
  }
}
