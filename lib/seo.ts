const RAW_SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://arca.onl";

export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, "");

export const SITE_NAME = "ARCA";

export const SITE_DESCRIPTION =
  "Punto de venta, inventario y contabilidad en un solo motor. ARCA conecta ventas, stock y finanzas para negocios reales de Latinoamérica.";

export function urlAbsoluta(path = "/"): string {
  return new URL(path, `${SITE_URL}/`).toString();
}
