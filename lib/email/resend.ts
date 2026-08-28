import "server-only";

import { Resend } from "resend";

/**
 * Envío de emails vía Resend. FAIL-SAFE: si no hay API key o Resend falla,
 * no se lanza excepción (un pago exitoso no debe romperse porque el correo
 * no salió). Devuelve `ok: false` para que el caller decida si reintentar.
 */

let cliente: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!cliente) cliente = new Resend(apiKey);
  return cliente;
}

function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function enviarEmail(input: {
  para: string;
  asunto: string;
  html: string;
  texto?: string;
  respuestaA?: string;
}): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY no configurado; no se envió el correo.");
    return { ok: false, error: "Email no configurado." };
  }

  const from = process.env.RESEND_FROM_EMAIL || "Arca <no-reply@arca.onl>";
  const replyTo = input.respuestaA || process.env.RESEND_REPLY_TO_EMAIL || undefined;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: input.para,
      subject: input.asunto,
      html: input.html,
      text: input.texto,
      replyTo,
    });
    if (error) {
      console.error("[email] Resend rechazó el envío.", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id ?? null };
  } catch (error) {
    console.error("[email] Error inesperado enviando correo.", error);
    return { ok: false, error: "Error inesperado enviando correo." };
  }
}
