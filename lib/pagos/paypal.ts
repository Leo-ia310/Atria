import "server-only";

/**
 * Cliente mínimo de la REST API de PayPal (Orders v2).
 * No usa SDK: solo fetch, para no arrastrar dependencias.
 *
 * Modo controlado por PAYPAL_MODE ("sandbox" | "live").
 */

const MODO = process.env.PAYPAL_MODE === "live" ? "live" : "sandbox";

const BASE_URL =
  MODO === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export class PayPalError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly detalle?: unknown,
  ) {
    super(message);
    this.name = "PayPalError";
  }
}

function credenciales(): { clientId: string; secret: string } {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new PayPalError("PayPal no está configurado (falta client id o secret).");
  }
  return { clientId, secret };
}

async function accessToken(): Promise<string> {
  const { clientId, secret } = credenciales();
  const basic = Buffer.from(`${clientId}:${secret}`).toString("base64");

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    const detalle = await res.json().catch(() => null);
    throw new PayPalError("No se pudo autenticar con PayPal.", res.status, detalle);
  }
  const json = (await res.json().catch(() => null)) as { access_token?: string } | null;
  if (!json?.access_token) {
    throw new PayPalError("No se pudo autenticar con PayPal.", res.status, json);
  }
  return json.access_token;
}

export type OrdenPayPal = {
  id: string;
  status: string;
};

export type CapturaPayPal = {
  id: string;
  status: string;
  capturaId: string | null;
  monto: string | null;
  moneda: string | null;
  pagadorEmail: string | null;
  pagadorNombre: string | null;
};

export async function crearOrden(input: {
  monto: string;
  moneda?: string;
  descripcion: string;
  referencia: string;
  customId?: string;
}): Promise<OrdenPayPal> {
  const token = await accessToken();
  const moneda = input.moneda ?? "USD";

  const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.referencia,
          description: input.descripcion.slice(0, 127),
          custom_id: input.customId?.slice(0, 127),
          amount: {
            currency_code: moneda,
            value: input.monto,
          },
        },
      ],
      application_context: {
        brand_name: "ARCA",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
    }),
  });

  if (!res.ok) {
    const detalle = await res.json().catch(() => null);
    throw new PayPalError("PayPal no pudo crear la orden.", res.status, detalle);
  }
  const json = (await res.json().catch(() => null)) as
    | { id?: string; status?: string }
    | null;
  if (!json?.id) {
    throw new PayPalError("PayPal no pudo crear la orden.", res.status, json);
  }
  return { id: json.id, status: json.status ?? "CREATED" };
}

type CaptureResponse = {
  id?: string;
  status?: string;
  payer?: {
    email_address?: string;
    name?: { given_name?: string; surname?: string };
  };
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{
        id?: string;
        amount?: { value?: string; currency_code?: string };
      }>;
    };
  }>;
};

export async function capturarOrden(ordenId: string): Promise<CapturaPayPal> {
  const token = await accessToken();

  const res = await fetch(`${BASE_URL}/v2/checkout/orders/${ordenId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const detalle = await res.json().catch(() => null);
    throw new PayPalError("PayPal no pudo capturar el pago.", res.status, detalle);
  }
  const json = (await res.json().catch(() => null)) as CaptureResponse | null;
  if (!json?.id) {
    throw new PayPalError("PayPal no pudo capturar el pago.", res.status, json);
  }

  const captura = json.purchase_units?.[0]?.payments?.captures?.[0];
  const nombre = json.payer?.name
    ? [json.payer.name.given_name, json.payer.name.surname].filter(Boolean).join(" ")
    : null;

  return {
    id: json.id,
    status: json.status ?? "",
    capturaId: captura?.id ?? null,
    monto: captura?.amount?.value ?? null,
    moneda: captura?.amount?.currency_code ?? null,
    pagadorEmail: json.payer?.email_address ?? null,
    pagadorNombre: nombre || null,
  };
}

export function paypalConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET,
  );
}
