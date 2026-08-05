import { formatearMontoUSD, type ReciboData } from "@/lib/pagos/recibo";

/** Aviso interno (para el dueño del SaaS) cuando entra un pago de suscripción. */
export function alertaPagoHtml(recibo: ReciboData): string {
  const cicloTexto = recibo.ciclo === "anual" ? "Anual" : "Mensual";
  const monto = formatearMontoUSD(recibo.monto, recibo.moneda);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://atria.app";

  const fila = (label: string, valor: string) => `
    <tr>
      <td style="padding:8px 0;color:#8B7FA8;font-size:13px;">${label}</td>
      <td align="right" style="padding:8px 0;color:#2B1F3A;font-size:13px;font-weight:600;">${valor}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8" /><meta name="color-scheme" content="light" /></head>
<body style="margin:0;padding:24px;background:#F8F7FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #E2DFF0;">
        <tr>
          <td style="background:linear-gradient(135deg,#16A34A 0%,#15803D 100%);padding:22px 28px;">
            <span style="color:#FFFFFF;font-size:17px;font-weight:800;">💰 Nuevo pago recibido</span>
            <div style="color:#DCFCE7;font-size:13px;margin-top:2px;">${monto} · ${recibo.planNombre} ${cicloTexto}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${fila("Empresa", recibo.empresaNombre)}
              ${fila("Plan", `${recibo.planNombre} (${cicloTexto})`)}
              ${fila("Monto", monto)}
              ${fila("Pagador", recibo.pagadorNombre || recibo.pagadorEmail || "—")}
              ${fila("Recibo", recibo.numeroRecibo)}
              ${fila("Referencia", recibo.ordenId)}
            </table>
            <a href="${appUrl}/superadmin/tenants" style="display:inline-block;margin-top:16px;background:#2B1F3A;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:600;padding:11px 20px;border-radius:8px;">Ver en el panel</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function alertaPagoTexto(recibo: ReciboData): string {
  const cicloTexto = recibo.ciclo === "anual" ? "Anual" : "Mensual";
  return [
    `Nuevo pago recibido: ${formatearMontoUSD(recibo.monto, recibo.moneda)}`,
    `Empresa: ${recibo.empresaNombre}`,
    `Plan: ${recibo.planNombre} (${cicloTexto})`,
    `Pagador: ${recibo.pagadorNombre || recibo.pagadorEmail || "—"}`,
    `Recibo: ${recibo.numeroRecibo}`,
    `Referencia: ${recibo.ordenId}`,
  ].join("\n");
}
