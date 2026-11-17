import { requireSession } from "@/lib/actions/session-helpers";
import { executeCommercial } from "@/lib/commercial-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  let sameOrigin = false;
  try {
    sameOrigin =
      !!origin && new URL(origin).origin === new URL(request.url).origin;
  } catch {
    /* malformed origin fails closed */
  }
  if (!sameOrigin)
    return Response.json(
      { ok: false, error: "Origen no autorizado." },
      { status: 403 },
    );
  const text = await request.text();
  if (text.length > 200000)
    return Response.json(
      { ok: false, error: "Documento demasiado grande." },
      { status: 413 },
    );
  try {
    return Response.json(
      await executeCommercial(await requireSession(), JSON.parse(text)),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, error: "No se pudo completar la solicitud." },
      { status: 400 },
    );
  }
}
