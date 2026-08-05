import {
  formatearFechaLarga,
  formatearMontoUSD,
  type ReciboData,
} from "@/lib/pagos/recibo";

const COLORES = {
  primary: "#2B1F3A",
  secondary: "#5C4B75",
  tertiary: "#A18BCF",
  tertiaryLight: "#D4C8F0",
  success: "#16A34A",
  successBg: "#F0FDF4",
  surface: "#FFFFFF",
  surface2: "#F2F0F7",
  neutral: "#F8F7FA",
  border: "#E2DFF0",
  textPrimary: "#2B1F3A",
  textSecondary: "#5C4B75",
  textMuted: "#8B7FA8",
};

function fila(label: string, valor: string, opts: { fuerte?: boolean } = {}): string {
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${COLORES.border};color:${COLORES.textMuted};font-size:14px;">${label}</td>
      <td align="right" style="padding:12px 0;border-bottom:1px solid ${COLORES.border};color:${COLORES.textPrimary};font-size:14px;font-weight:${opts.fuerte ? 700 : 500};">${valor}</td>
    </tr>`;
}

export function reciboPagoHtml(recibo: ReciboData): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://atria.app";
  const cicloTexto = recibo.ciclo === "anual" ? "Anual" : "Mensual";
  const monto = formatearMontoUSD(recibo.monto, recibo.moneda);
  const pagador = recibo.pagadorNombre || recibo.pagadorEmail || recibo.empresaNombre;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>Recibo ${recibo.numeroRecibo}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORES.neutral};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Recibo ${recibo.numeroRecibo} — ${monto} ${cicloTexto}. Gracias por tu pago.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORES.neutral};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${COLORES.surface};border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(43,31,58,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${COLORES.primary} 0%,${COLORES.secondary} 100%);padding:36px 40px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:#FFFFFF;font-size:22px;font-weight:800;letter-spacing:3px;">ARCA</span>
                    <div style="color:${COLORES.tertiaryLight};font-size:12px;letter-spacing:1px;margin-top:2px;">SISTEMA OPERATIVO PARA EL COMERCIO</div>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background:rgba(255,255,255,0.15);color:#FFFFFF;font-size:12px;font-weight:600;padding:6px 12px;border-radius:999px;">Recibo</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Confirmación -->
          <tr>
            <td align="center" style="padding:36px 40px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="width:64px;height:64px;background-color:${COLORES.successBg};border-radius:50%;">
                    <span style="color:${COLORES.success};font-size:34px;line-height:64px;">&#10003;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:20px 0 6px;color:${COLORES.textPrimary};font-size:24px;font-weight:800;">Pago confirmado</h1>
              <p style="margin:0;color:${COLORES.textMuted};font-size:15px;">Gracias, ${pagador}. Tu plan ya está activo.</p>
            </td>
          </tr>

          <!-- Monto destacado -->
          <tr>
            <td style="padding:24px 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORES.surface2};border-radius:12px;">
                <tr>
                  <td align="center" style="padding:22px;">
                    <div style="color:${COLORES.textMuted};font-size:13px;text-transform:uppercase;letter-spacing:1px;">Total pagado</div>
                    <div style="color:${COLORES.primary};font-size:36px;font-weight:800;margin-top:4px;">${monto}</div>
                    <div style="color:${COLORES.textSecondary};font-size:13px;margin-top:2px;">Plan ${recibo.planNombre} · ${cicloTexto}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Detalle -->
          <tr>
            <td style="padding:16px 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${fila("Número de recibo", recibo.numeroRecibo)}
                ${fila("Fecha", formatearFechaLarga(recibo.fechaISO))}
                ${fila("Empresa", recibo.empresaNombre)}
                ${fila("Plan", `${recibo.planNombre} (${cicloTexto})`)}
                ${fila("Método de pago", recibo.metodoPago)}
                ${fila("Vigente hasta", formatearFechaLarga(recibo.vigenteHastaISO))}
                ${fila("Total", monto, { fuerte: true })}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:28px 40px 8px;">
              <a href="${appUrl}/dashboard" style="display:inline-block;background:${COLORES.primary};color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;">Ir a mi panel</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 40px 36px;">
              <p style="margin:0 0 6px;color:${COLORES.textMuted};font-size:12px;line-height:1.6;text-align:center;">
                Este recibo se generó automáticamente por tu pago vía ${recibo.metodoPago}.<br />
                Referencia de la transacción: ${recibo.ordenId}
              </p>
              <p style="margin:12px 0 0;color:${COLORES.textMuted};font-size:12px;text-align:center;">
                ¿Dudas? Escríbenos respondiendo a este correo.
              </p>
            </td>
          </tr>

        </table>
        <p style="margin:20px 0 0;color:${COLORES.textMuted};font-size:11px;">© ${new Date().getFullYear()} ARCA · Hecho para el comercio de Latinoamérica</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function reciboPagoTexto(recibo: ReciboData): string {
  const cicloTexto = recibo.ciclo === "anual" ? "Anual" : "Mensual";
  return [
    `ARCA — Recibo ${recibo.numeroRecibo}`,
    ``,
    `Pago confirmado. Gracias, ${recibo.pagadorNombre || recibo.empresaNombre}.`,
    ``,
    `Total pagado: ${formatearMontoUSD(recibo.monto, recibo.moneda)}`,
    `Plan: ${recibo.planNombre} (${cicloTexto})`,
    `Fecha: ${formatearFechaLarga(recibo.fechaISO)}`,
    `Empresa: ${recibo.empresaNombre}`,
    `Método de pago: ${recibo.metodoPago}`,
    `Vigente hasta: ${formatearFechaLarga(recibo.vigenteHastaISO)}`,
    `Referencia: ${recibo.ordenId}`,
    ``,
    `Panel: ${process.env.NEXT_PUBLIC_APP_URL || "https://atria.app"}/dashboard`,
  ].join("\n");
}
