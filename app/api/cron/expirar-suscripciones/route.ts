import { expirarSuscripcionesVencidas } from "@/lib/suscripciones/expiracion";
import { withLock } from "@/lib/redis/lock";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const resultado = await withLock(
    "cron:expirar-suscripciones",
    () => expirarSuscripcionesVencidas(),
    120,
  );
  if (resultado === null) {
    return Response.json({ ok: true, omitido: "ya en ejecución" });
  }
  return Response.json({ ok: true, ...resultado });
}
