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

export type NotificarVentaReferidaResultado =
  | { ok: true; duplicada: boolean }
  | { ok: false; error: string; code?: string };

export async function notificarVentaReferida(input: {
  codigoReferido?: string | null;
  referenciaExterna: string;
  cliente: string;
  clienteEmail?: string | null;
  clienteTelefono?: string | null;
  empresaCliente?: string | null;
  empresaTelefono?: string | null;
  empresaPais?: string | null;
  tipoEmpresa?: string | null;
  plan: string;
  monto: number;
  tipoVenta: "primera" | "renovacion";
  origen: string;
  fechaVenta?: Date;
}): Promise<NotificarVentaReferidaResultado> {
  const codigoReferido = normalizarCodigoReferido(input.codigoReferido);
  if (!codigoReferido) {
    return {
      ok: false,
      code: "CODIGO_REFERIDO_INVALIDO",
      error: "Codigo referido vacio.",
    };
  }

  const url = process.env.VENDEDORES_ATRIA_BACKEND_URL;
  const secret = process.env.VENDEDORES_ATRIA_WEBHOOK_SECRET;
  if (!url || !secret) {
    console.warn("[referidos] Puente a Vendedores ATRIA no configurado.");
    return {
      ok: false,
      code: "PUENTE_NO_CONFIGURADO",
      error: "VENDEDORES_ATRIA_BACKEND_URL o VENDEDORES_ATRIA_WEBHOOK_SECRET no esta configurado.",
    };
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
          clienteTelefono: input.clienteTelefono || "",
          empresaCliente: input.empresaCliente || input.cliente,
          empresaTelefono: input.empresaTelefono || "",
          empresaPais: input.empresaPais || "",
          tipoEmpresa: input.tipoEmpresa || "",
          plan: input.plan,
          monto: input.monto,
          tipoVenta: input.tipoVenta,
          origen: input.origen,
          fechaVenta: (input.fechaVenta || new Date()).toISOString(),
          comprobante: `Pago confirmado en Atria (${input.origen})`,
        },
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      console.warn("[referidos] Vendedores ATRIA rechazo la venta referida.", json);
      return {
        ok: false,
        code: json?.code || String(res.status),
        error: json?.error || res.statusText || "Vendedores ATRIA rechazo la venta referida.",
      };
    }

    const json = await res.json().catch(() => null);
    if (!json?.ok) {
      console.warn("[referidos] Vendedores ATRIA rechazo la venta referida.", json);
      return {
        ok: false,
        code: json?.code || String(res.status),
        error: json?.error || res.statusText || "Vendedores ATRIA rechazo la venta referida.",
      };
    }
    return { ok: true, duplicada: Boolean(json.data?.duplicada) };
  } catch (error) {
    console.warn("[referidos] No se pudo notificar la venta referida.", error);
    return {
      ok: false,
      code: "FETCH_ERROR",
      error: error instanceof Error ? error.message : "No se pudo notificar la venta referida.",
    };
  }
}
