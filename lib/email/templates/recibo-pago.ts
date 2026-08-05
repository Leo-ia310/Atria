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

function metaCol(label: string, valor: string): string {
  return `
    <td style="padding:0 14px 0 0;vertical-align:top;">
      <div style="color:${COLORES.textMuted};font-size:10px;letter-spacing:1px;text-transform:uppercase;">${label}</div>
      <div style="color:${COLORES.textPrimary};font-size:13px;font-weight:600;margin-top:3px;">${valor}</div>
    </td>`;
}

function totalFila(label: string, valor: string, opts: { fuerte?: boolean } = {}): string {
  return `
    <tr>
      <td style="padding:6px 0;color:${opts.fuerte ? COLORES.textPrimary : COLORES.textMuted};font-size:${opts.fuerte ? 14 : 13}px;font-weight:${opts.fuerte ? 700 : 400};">${label}</td>
      <td align="right" style="padding:6px 0 6px 40px;color:${COLORES.textPrimary};font-size:${opts.fuerte ? 14 : 13}px;font-weight:${opts.fuerte ? 700 : 500};white-space:nowrap;">${valor}</td>
    </tr>`;
}

export function reciboPagoHtml(recibo: ReciboData): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://atria.app";
  const soporte = process.env.RESEND_REPLY_TO_EMAIL || "soporte@arca.onl";
  const cicloTexto = recibo.ciclo === "anual" ? "Anual" : "Mensual";
  const monto = formatearMontoUSD(recibo.monto, recibo.moneda);
  const cero = formatearMontoUSD(0, recibo.moneda);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>Factura ${recibo.numeroRecibo}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORES.neutral};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Factura ${recibo.numeroRecibo} — ${monto} pagado. Plan ${recibo.planNombre} ${cicloTexto}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORES.neutral};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${COLORES.surface};border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(43,31,58,0.10);">

          <!-- Encabezado: emisor + FACTURA -->
          <tr>
            <td style="padding:36px 40px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:top;">
                    <div style="color:${COLORES.primary};font-size:22px;font-weight:800;letter-spacing:3px;">ARCA</div>
                    <div style="color:${COLORES.textMuted};font-size:11px;letter-spacing:0.5px;margin-top:4px;line-height:1.6;">
                      Sistema operativo para el comercio<br />
                      ${appUrl.replace(/^https?:\/\//, "")}<br />
                      ${soporte}
                    </div>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <div style="color:${COLORES.primary};font-size:26px;font-weight:800;letter-spacing:2px;">FACTURA</div>
                    <div style="margin-top:8px;">
                      <span style="display:inline-block;background:${COLORES.successBg};color:${COLORES.success};font-size:12px;font-weight:700;letter-spacing:1px;padding:5px 14px;border-radius:999px;border:1px solid ${COLORES.success};">PAGADO</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Meta: fecha, numero, terminos -->
          <tr>
            <td style="padding:0 40px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORES.surface2};border-radius:10px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        ${metaCol("Fecha", formatearFechaLarga(recibo.fechaISO))}
                        ${metaCol("Factura No.", recibo.numeroRecibo)}
                        ${metaCol("Terminos", `Pagado · ${recibo.metodoPago}`)}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cobrar a -->
          <tr>
            <td style="padding:0 40px 8px;">
              <div style="color:${COLORES.textMuted};font-size:10px;letter-spacing:1px;text-transform:uppercase;">Cobrar a</div>
              <div style="color:${COLORES.textPrimary};font-size:15px;font-weight:700;margin-top:4px;">${recibo.empresaNombre}</div>
              ${
                recibo.pagadorNombre || recibo.pagadorEmail
                  ? `<div style="color:${COLORES.textSecondary};font-size:13px;margin-top:2px;">${[recibo.pagadorNombre, recibo.pagadorEmail].filter(Boolean).join(" · ")}</div>`
                  : ""
              }
            </td>
          </tr>

          <!-- Tabla de conceptos -->
          <tr>
            <td style="padding:18px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px 0;border-bottom:2px solid ${COLORES.primary};color:${COLORES.primary};font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Descripcion</td>
                  <td align="center" style="padding:10px 0;border-bottom:2px solid ${COLORES.primary};color:${COLORES.primary};font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Cant.</td>
                  <td align="right" style="padding:10px 0;border-bottom:2px solid ${COLORES.primary};color:${COLORES.primary};font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Precio unit.</td>
                  <td align="right" style="padding:10px 0;border-bottom:2px solid ${COLORES.primary};color:${COLORES.primary};font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Total</td>
                </tr>
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid ${COLORES.border};color:${COLORES.textPrimary};font-size:13px;">
                    <strong>Suscripcion ARCA — Plan ${recibo.planNombre}</strong>
                    <div style="color:${COLORES.textMuted};font-size:12px;margin-top:2px;">Facturacion ${cicloTexto.toLowerCase()} · vigente hasta ${formatearFechaLarga(recibo.vigenteHastaISO)}</div>
                  </td>
                  <td align="center" style="padding:14px 0;border-bottom:1px solid ${COLORES.border};color:${COLORES.textPrimary};font-size:13px;">1</td>
                  <td align="right" style="padding:14px 0;border-bottom:1px solid ${COLORES.border};color:${COLORES.textPrimary};font-size:13px;white-space:nowrap;">${monto}</td>
                  <td align="right" style="padding:14px 0;border-bottom:1px solid ${COLORES.border};color:${COLORES.textPrimary};font-size:13px;font-weight:600;white-space:nowrap;">${monto}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Totales -->
          <tr>
            <td style="padding:14px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:top;padding-right:20px;">
                    <div style="color:${COLORES.textMuted};font-size:10px;letter-spacing:1px;text-transform:uppercase;">Observaciones</div>
                    <div style="color:${COLORES.textSecondary};font-size:12px;margin-top:4px;line-height:1.6;">
                      Pago recibido via ${recibo.metodoPago}.<br />
                      Ref. transaccion: ${recibo.ordenId}
                    </div>
                  </td>
                  <td width="240" style="vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${totalFila("Total parcial", monto)}
                      ${totalFila("Descuento", cero)}
                      ${totalFila("Impuestos (0%)", cero)}
                      <tr><td colspan="2" style="border-top:1px solid ${COLORES.border};font-size:0;line-height:0;">&nbsp;</td></tr>
                      ${totalFila("Total", monto, { fuerte: true })}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Saldo adeudado destacado -->
          <tr>
            <td style="padding:22px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,${COLORES.primary} 0%,${COLORES.secondary} 100%);border-radius:12px;">
                <tr>
                  <td style="padding:18px 22px;color:#FFFFFF;font-size:14px;font-weight:600;">Saldo adeudado</td>
                  <td align="right" style="padding:18px 22px;color:#FFFFFF;font-size:22px;font-weight:800;">${cero}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:26px 40px 8px;">
              <a href="${appUrl}/dashboard" style="display:inline-block;background:${COLORES.primary};color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;">Ir a mi panel</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 40px 34px;">
              <p style="margin:0;color:${COLORES.textMuted};font-size:12px;line-height:1.6;text-align:center;">
                Gracias por tu compra. Esta factura se genero automaticamente por tu pago.<br />
                ¿Dudas? Responde a este correo y te ayudamos.
              </p>
            </td>
          </tr>

        </table>
        <p style="margin:20px 0 0;color:${COLORES.textMuted};font-size:11px;">© ${new Date().getFullYear()} ARCA · Hecho para el comercio de Latinoamerica</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function reciboPagoTexto(recibo: ReciboData): string {
  const cicloTexto = recibo.ciclo === "anual" ? "Anual" : "Mensual";
  const monto = formatearMontoUSD(recibo.monto, recibo.moneda);
  const cero = formatearMontoUSD(0, recibo.moneda);
  return [
    `ARCA — FACTURA ${recibo.numeroRecibo}  [PAGADO]`,
    ``,
    `Fecha: ${formatearFechaLarga(recibo.fechaISO)}`,
    `Terminos: Pagado · ${recibo.metodoPago}`,
    ``,
    `Cobrar a: ${recibo.empresaNombre}`,
    recibo.pagadorEmail ? `Contacto: ${recibo.pagadorEmail}` : ``,
    ``,
    `Concepto: Suscripcion ARCA — Plan ${recibo.planNombre} (${cicloTexto})`,
    `Cantidad: 1   Precio: ${monto}   Total: ${monto}`,
    `Vigente hasta: ${formatearFechaLarga(recibo.vigenteHastaISO)}`,
    ``,
    `Total parcial: ${monto}`,
    `Descuento: ${cero}`,
    `Impuestos (0%): ${cero}`,
    `TOTAL: ${monto}`,
    `Saldo adeudado: ${cero}`,
    ``,
    `Ref. transaccion: ${recibo.ordenId}`,
    `Panel: ${process.env.NEXT_PUBLIC_APP_URL || "https://atria.app"}/dashboard`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}
