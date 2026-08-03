import "server-only";

import { cookies } from "next/headers";

const REFERRAL_COOKIE = "atria_referral_code";

export function normalizarCodigoReferido(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 80);
}

export async function leerCodigoReferidoDesdeCookie() {
  const store = await cookies();
  return normalizarCodigoReferido(store.get(REFERRAL_COOKIE)?.value);
}

export async function notificarVentaReferida(input: {
  codigoReferido?: string | null;
  referenciaExterna: string;
  cliente: string;
  clienteEmail?: string | null;
  empresaCliente?: string | null;
  plan: string;
  monto: number;
  tipoVenta: "primera" | "renovacion";
  origen: string;
  fechaVenta?: Date;
}) {
  const codigoReferido = normalizarCodigoReferido(input.codigoReferido);
  if (!codigoReferido) return;

  const url = process.env.VENDEDORES_ATRIA_BACKEND_URL;
  const secret = process.env.VENDEDORES_ATRIA_WEBHOOK_SECRET;
  if (!url || !secret) {
    console.warn("[referidos] Puente a Vendedores ATRIA no configurado.");
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "registrarVentaReferida",
        payload: {
          secret,
          codigoReferido,
          referenciaExterna: input.referenciaExterna,
          cliente: input.cliente,
          clienteEmail: input.clienteEmail || "",
          empresaCliente: input.empresaCliente || input.cliente,
          plan: input.plan,
          monto: input.monto,
          tipoVenta: input.tipoVenta,
          origen: input.origen,
          fechaVenta: (input.fechaVenta || new Date()).toISOString(),
          comprobante: `Pago confirmado en Atria (${input.origen})`,
        },
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      console.warn("[referidos] Vendedores ATRIA rechazo la venta referida.", json);
    }
  } catch (error) {
    console.warn("[referidos] No se pudo notificar la venta referida.", error);
  }
}
