import { auth } from "@/auth";
import { readWebChanges } from "@/lib/web-changes";
import { revalidateTag } from "next/cache";
import { layoutNotificationTag } from "@/lib/layout-notification-items";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Sesión requerida" }, { status: 401 });
  const parsed = z
    .object({ cursor: z.string().max(300000).nullable() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  try {
    const result = await readWebChanges(
      { id: session.user.id, empresaId: session.user.empresaId },
      parsed.data.cursor,
    );
    if (result.changed)
      revalidateTag(layoutNotificationTag(session.user.empresaId));
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json(
      { error: "Actualización temporalmente no disponible" },
      {
        status: 503,
        headers: { "Retry-After": "60", "Cache-Control": "no-store" },
      },
    );
  }
}
