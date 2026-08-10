"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { crearOrdenPlan, capturarOrdenPlan } from "@/lib/actions/pagos";
import { cn } from "@/lib/utils";
import type { PlanId } from "@/lib/pricing";
import type { ReciboData } from "@/lib/pagos/recibo";
import type { Ciclo } from "@/lib/suscripciones/core";

/* El SDK de PayPal expone un global sin tipos; se aísla el `any` aquí. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PayPalSdk = any;
declare global {
  interface Window {
    paypal?: PayPalSdk;
  }
}

let sdkPromise: Promise<void> | null = null;

function cargarSdk(clientId: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("sin window"));
  if (window.paypal) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const params = new URLSearchParams({
      "client-id": clientId,
      currency: "USD",
      intent: "capture",
      components: "buttons",
    });
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("No se pudo cargar el SDK de PayPal."));
    };
    document.body.appendChild(script);
  });
  return sdkPromise;
}

export function PayPalCheckout({
  planId,
  ciclo,
  onExito,
  onError,
}: {
  planId: PlanId;
  ciclo: Ciclo;
  onExito: (recibo: ReciboData) => void;
  onError?: (mensaje: string) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "procesando" | "error">(
    "cargando",
  );
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cbExito = useRef(onExito);
  const cbError = useRef(onError);
  cbExito.current = onExito;
  cbError.current = onError;

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  useEffect(() => {
    let cancelado = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let botones: any;

    if (!clientId) {
      setEstado("error");
      setMensaje("Los pagos no están configurados.");
      return;
    }

    setEstado("cargando");
    setMensaje(null);

    cargarSdk(clientId)
      .then(() => {
        if (cancelado || !contenedor.current || !window.paypal) return;
        contenedor.current.innerHTML = "";

        botones = window.paypal.Buttons({
          style: { layout: "vertical", color: "black", shape: "rect", label: "pay", height: 46 },
          createOrder: async () => {
            setMensaje(null);
            const res = await crearOrdenPlan(planId, ciclo, readReferralCode());
            if (!res.ok) {
              setMensaje(res.error);
              throw new Error(res.error);
            }
            return res.orderId;
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onApprove: async (data: any) => {
            setEstado("procesando");
            const res = await capturarOrdenPlan(data.orderID, readReferralCode());
            if (!res.ok) {
              setEstado("listo");
              setMensaje(res.error);
              cbError.current?.(res.error);
              return;
            }
            cbExito.current(res.recibo);
          },
          onCancel: () => setMensaje("Pago cancelado. Puedes intentarlo de nuevo."),
          onError: () => {
            setEstado("listo");
            setMensaje("Ocurrió un error con PayPal. Intenta de nuevo.");
          },
        });

        botones
          .render(contenedor.current)
          .then(() => {
            if (!cancelado) setEstado("listo");
          })
          .catch(() => {
            if (!cancelado) {
              setEstado("error");
              setMensaje("No se pudo mostrar el botón de PayPal.");
            }
          });
      })
      .catch(() => {
        if (!cancelado) {
          setEstado("error");
          setMensaje("No se pudo cargar PayPal. Revisa tu conexión.");
        }
      });

    return () => {
      cancelado = true;
      try {
        botones?.close();
      } catch {
        /* el botón ya se desmontó */
      }
    };
  }, [clientId, planId, ciclo]);

  return (
    <div>
      {estado === "cargando" && (
        <div className="flex items-center justify-center gap-2 py-6 text-small text-[color:var(--color-text-muted)]">
          <Loader2 size={16} className="animate-spin" />
          Cargando pago seguro…
        </div>
      )}

      {estado === "procesando" && (
        <div className="flex items-center justify-center gap-2 py-6 text-small font-medium text-[color:var(--color-text-primary)]">
          <Loader2 size={16} className="animate-spin" />
          Confirmando tu pago…
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden rounded-lg",
          estado === "listo" && "bg-black/90 p-1",
          estado === "procesando" && "hidden",
        )}
      >
        <div ref={contenedor} />
      </div>

      {mensaje && (
        <p className="mt-3 rounded-md bg-[color:var(--color-error-bg)] px-3 py-2 text-center text-[12px] text-[color:var(--color-error)]">
          {mensaje}
        </p>
      )}

      {estado !== "error" && (
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[color:var(--color-text-muted)]">
          <ShieldCheck size={13} className="text-[color:var(--color-success)]" />
          Pago protegido por PayPal · No guardamos tu tarjeta
        </div>
      )}
    </div>
  );
}

function readReferralCode() {
  if (typeof window === "undefined") return "";
  return String(window.localStorage.getItem("atria_referral_code") || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 80);
}
