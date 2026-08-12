import "server-only";

export type MensajeIA = { role: "system" | "user" | "assistant"; content: string };

export type ResultadoIA =
  | { ok: true; texto: string; modelo: string }
  | { ok: false; error: string };

export function iaConfigurada(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}

export function modeloIA(): string {
  return process.env.CLOUDFLARE_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct";
}

export async function ejecutarIA(
  mensajes: MensajeIA[],
  opciones: { maxTokens: number; temperature?: number; topP?: number },
): Promise<ResultadoIA> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const modelo = modeloIA();
  if (!accountId || !apiToken) {
    return { ok: false, error: "Cloudflare AI no esta configurado." };
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelo}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: mensajes,
          max_tokens: opciones.maxTokens,
          temperature: opciones.temperature ?? 0.1,
          top_p: opciones.topP ?? 0.7,
          repetition_penalty: 1.08,
        }),
      },
    );

    const data = (await res.json().catch(() => null)) as
      | { success?: boolean; result?: { response?: unknown }; errors?: { message?: string }[] }
      | null;

    if (!res.ok || !data?.success) {
      const detalle = data?.errors?.[0]?.message ?? `HTTP ${res.status}`;
      console.error("[ia:cloudflare]", detalle);
      return { ok: false, error: "La IA no pudo responder en este momento." };
    }

    // Algunos modelos devuelven `response` como string y otros (cuando la salida
    // es JSON) como objeto/array ya parseado. Normalizamos siempre a string.
    const respuesta = data.result?.response;
    const texto =
      respuesta == null
        ? ""
        : typeof respuesta === "string"
          ? respuesta
          : JSON.stringify(respuesta);
    return { ok: true, texto, modelo };
  } catch (err) {
    console.error("[ia:cloudflare]", err);
    return { ok: false, error: "No pudimos conectar con la IA." };
  }
}

export function extraerJSON<T = unknown>(texto: unknown): T | null {
  if (texto == null) return null;
  if (typeof texto !== "string") return texto as T;
  if (!texto) return null;
  let limpio = texto.trim();
  const fence = limpio.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) limpio = fence[1].trim();

  const inicio = limpio.indexOf("{");
  const inicioArr = limpio.indexOf("[");
  const abre =
    inicioArr !== -1 && (inicio === -1 || inicioArr < inicio) ? inicioArr : inicio;
  if (abre === -1) return null;
  const cierre = limpio[abre] === "[" ? limpio.lastIndexOf("]") : limpio.lastIndexOf("}");
  if (cierre <= abre) return null;

  const candidato = limpio.slice(abre, cierre + 1);
  try {
    return JSON.parse(candidato) as T;
  } catch {
    return null;
  }
}
