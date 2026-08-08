const COLORES = {
  primary: "#2B1F3A",
  secondary: "#5C4B75",
  surface: "#FFFFFF",
  surface2: "#F2F0F7",
  neutral: "#F8F7FA",
  border: "#E2DFF0",
  textPrimary: "#2B1F3A",
  textSecondary: "#5C4B75",
  textMuted: "#8B7FA8",
};

export function codigoRecuperacionHtml(input: {
  nombre: string;
  codigo: string;
  minutosValidez: number;
}): string {
  const codigoEspaciado = input.codigo.split("").join(" ");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>Tu código de recuperación</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORES.neutral};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Tu código para restablecer la contraseña de ARCA: ${input.codigo}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORES.neutral};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:${COLORES.surface};border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(43,31,58,0.10);">
          <tr>
            <td style="padding:36px 40px 8px;">
              <div style="color:${COLORES.primary};font-size:20px;font-weight:800;letter-spacing:3px;">ARCA</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 0;">
              <h1 style="margin:0;color:${COLORES.textPrimary};font-size:20px;font-weight:700;">Recuperar contraseña</h1>
              <p style="margin:10px 0 0;color:${COLORES.textSecondary};font-size:14px;line-height:1.6;">
                Hola ${input.nombre}, usa este código para continuar con el restablecimiento de tu contraseña.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORES.surface2};border-radius:12px;">
                <tr>
                  <td align="center" style="padding:22px;">
                    <span style="color:${COLORES.primary};font-size:34px;font-weight:800;letter-spacing:6px;">${codigoEspaciado}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;color:${COLORES.textMuted};font-size:12px;line-height:1.6;">
                Este código vence en ${input.minutosValidez} minutos y solo se puede usar una vez.
                Si tú no solicitaste este cambio, ignora este correo — tu contraseña actual sigue siendo válida.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 34px;border-top:1px solid ${COLORES.border};">
              <p style="margin:20px 0 0;color:${COLORES.textMuted};font-size:12px;line-height:1.6;">
                ¿No fuiste tú? Responde a este correo y te ayudamos.
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

export function codigoRecuperacionTexto(input: {
  nombre: string;
  codigo: string;
  minutosValidez: number;
}): string {
  return [
    `ARCA — Recuperar contraseña`,
    ``,
    `Hola ${input.nombre}, tu código para restablecer la contraseña es:`,
    ``,
    `  ${input.codigo}`,
    ``,
    `Vence en ${input.minutosValidez} minutos y solo se puede usar una vez.`,
    `Si tú no solicitaste este cambio, ignora este correo.`,
  ].join("\n");
}
