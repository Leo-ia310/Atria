"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Check, ArrowLeft } from "lucide-react";
import { cambiarPlan, iniciarTrialPlanPago } from "@/lib/actions/planes";
import {
  DIAS_TRIAL_PLAN_PAGO,
  PLANES_ARRAY,
  descripcionLimiteIA,
  type Plan,
  type PlanId,
} from "@/lib/pricing";
import { cn, formatearFecha } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { PayPalCheckout } from "@/components/pagos/PayPalCheckout";
import { ReciboExito } from "@/components/pagos/ReciboExito";
import { TransferenciaCheckout } from "@/components/pagos/TransferenciaCheckout";
import type { ReciboData } from "@/lib/pagos/recibo";

type Vista = "planes" | "checkout" | "recibo";

export function PlanesModal({
  abierto,
  onCerrar,
  planActual,
  planActualId,
  suscripcionEstado,
  suscripcionFinISO,
  suscripcionBloqueada = false,
}: {
  abierto: boolean;
  onCerrar: () => void;
  planActual: string;
  planActualId?: PlanId;
  suscripcionEstado?: "activa" | "trial" | "vencida" | "cancelada" | "suspendida" | null;
  suscripcionFinISO?: string | null;
  suscripcionBloqueada?: boolean;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [anual, setAnual] = useState(false);
  const [seleccionando, setSeleccionando] = useState<PlanId | null>(null);
  const [vista, setVista] = useState<Vista>("planes");
  const [planCheckout, setPlanCheckout] = useState<Plan | null>(null);
  const [recibo, setRecibo] = useState<ReciboData | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape" && vista !== "recibo") onCerrar();
    }
    if (abierto) {
      document.addEventListener("keydown", esc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [abierto, onCerrar, vista]);

  useEffect(() => {
    if (!abierto) {
      setVista("planes");
      setPlanCheckout(null);
      setRecibo(null);
      setSeleccionando(null);
    }
  }, [abierto]);

  if (!abierto || !montado) return null;

  async function elegirPlan(plan: Plan) {
    if (plan.id === "demo") {
      if (suscripcionBloqueada) {
        mostrar("error", "Tu cuenta esta bloqueada. Paga el plan para recuperar el acceso.");
        return;
      }
      setSeleccionando("demo");
      const res = await cambiarPlan("demo");
      setSeleccionando(null);
      if (!res.ok) {
        mostrar("error", res.error);
        return;
      }
      mostrar("success", `Plan actualizado a ${res.plan}`);
      onCerrar();
      router.refresh();
      return;
    }

    const esActual = planActualId
      ? plan.id === planActualId
      : plan.nombre.toLowerCase() === planActual.toLowerCase();
    const trialPagoActivo =
      suscripcionEstado === "trial" &&
      !suscripcionBloqueada &&
      (planActualId ? planActualId !== "demo" : planActual.toLowerCase() !== "demo");
    if (trialPagoActivo) {
      mostrar(
        "info",
        suscripcionFinISO
          ? `Tu prueba gratis esta activa hasta ${formatearFecha(suscripcionFinISO)}. No necesitas tarjeta ahora.`
          : "Tu prueba gratis esta activa. No necesitas tarjeta ahora.",
      );
      return;
    }

    const debePagarActual =
      esActual &&
      (suscripcionBloqueada || suscripcionEstado === "vencida" || suscripcionEstado === "suspendida");
    if (!debePagarActual && !suscripcionBloqueada) {
      setSeleccionando(plan.id);
      const res = await iniciarTrialPlanPago(plan.id, anual ? "anual" : "mensual");
      setSeleccionando(null);
      if (res.ok) {
        mostrar("success", `Prueba gratis de ${res.plan} activada hasta ${formatearFecha(res.finISO)}`);
        onCerrar();
        router.refresh();
        return;
      }
      if (!res.requierePago) {
        mostrar("error", res.error);
        return;
      }
    }

    setPlanCheckout(plan);
    setVista("checkout");
  }

  function onPagoExitoso(data: ReciboData) {
    setRecibo(data);
    setVista("recibo");
    router.refresh();
  }

  function cerrarTrasRecibo() {
    onCerrar();
    router.refresh();
  }

  const precioCheckout = planCheckout
    ? anual
      ? planCheckout.precioAnual
      : planCheckout.precioMensual
    : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-md sm:p-4"
      onClick={() => vista !== "recibo" && onCerrar()}
    >
      <div
        className="relative my-auto max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-[color:var(--color-text-primary)] shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {vista !== "recibo" && (
          <button
            type="button"
            onClick={onCerrar}
            className="absolute right-4 top-4 rounded-md p-1.5 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-text-primary)]"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        )}

        {vista === "planes" && (
          <VistaPlanes
            planActual={planActual}
            planActualId={planActualId}
            suscripcionEstado={suscripcionEstado}
            suscripcionFinISO={suscripcionFinISO}
            suscripcionBloqueada={suscripcionBloqueada}
            anual={anual}
            setAnual={setAnual}
            seleccionando={seleccionando}
            onElegir={elegirPlan}
          />
        )}

        {vista === "checkout" && planCheckout && (
          <VistaCheckout
            plan={planCheckout}
            anual={anual}
            setAnual={setAnual}
            precio={precioCheckout}
            onVolver={() => setVista("planes")}
            onExito={onPagoExitoso}
            onError={(m) => mostrar("error", m)}
          />
        )}

        {vista === "recibo" && recibo && (
          <ReciboExito recibo={recibo} onCerrar={cerrarTrasRecibo} />
        )}
      </div>
    </div>,
    document.body,
  );
}

function VistaPlanes({
  planActual,
  planActualId,
  suscripcionEstado,
  suscripcionFinISO,
  suscripcionBloqueada,
  anual,
  setAnual,
  seleccionando,
  onElegir,
}: {
  planActual: string;
  planActualId?: PlanId;
  suscripcionEstado?: "activa" | "trial" | "vencida" | "cancelada" | "suspendida" | null;
  suscripcionFinISO?: string | null;
  suscripcionBloqueada: boolean;
  anual: boolean;
  setAnual: (v: boolean) => void;
  seleccionando: PlanId | null;
  onElegir: (plan: Plan) => void;
}) {
  const trialPagoActivo =
    suscripcionEstado === "trial" &&
    !suscripcionBloqueada &&
    (planActualId ? planActualId !== "demo" : planActual.toLowerCase() !== "demo");
  const finTrialTexto = suscripcionFinISO ? formatearFecha(suscripcionFinISO) : null;

  return (
    <>
      <div className="mb-5 text-center">
        <h2 className="text-xl font-bold text-[color:var(--color-text-primary)]">
          Planes de ARCA
        </h2>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          {trialPagoActivo ? (
            <>
              Tu prueba gratis de <strong>{planActual}</strong>{" "}
              {finTrialTexto ? `termina el ${finTrialTexto}` : "esta activa"}.
              No necesitas tarjeta ahora.
            </>
          ) : (
            <>
              Tu plan actual es <strong>{planActual}</strong>. Escala cuando lo necesites.
            </>
          )}
        </p>
        <TogglePeriodo anual={anual} setAnual={setAnual} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PLANES_ARRAY.map((plan) => {
          const esActual = planActualId
            ? plan.id === planActualId
            : plan.nombre.toLowerCase() === planActual.toLowerCase();
          const puedePagarActual =
            esActual &&
            plan.id !== "demo" &&
            (suscripcionBloqueada || suscripcionEstado === "vencida" || suscripcionEstado === "suspendida");
          const demoBloqueado = suscripcionBloqueada && plan.id === "demo";
          const planPagoBloqueadoPorTrial = trialPagoActivo && plan.id !== "demo";
          const precio = anual
            ? plan.precioAnualMensualizado
            : plan.precioMensual;
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-lg border p-4",
                plan.destacado
                  ? "border-[color:var(--color-primary)] ring-1 ring-[color:var(--color-primary)]/30"
                  : "border-[color:var(--color-border)]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold">{plan.nombre}</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {plan.id !== "demo" && (
                    <span className="rounded-full bg-[color:var(--color-success)]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[color:var(--color-success)]">
                      {DIAS_TRIAL_PLAN_PAGO} dias gratis
                    </span>
                  )}
                  {plan.destacado && (
                    <span className="rounded-full bg-[color:var(--color-primary)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Popular
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                {plan.descripcionCorta}
              </p>
              <div className="mt-3">
                <span className="text-2xl font-bold text-[color:var(--color-primary)]">
                  ${precio.toFixed(2)}
                </span>
                <span className="text-[12px] text-[color:var(--color-text-muted)]">/mes</span>
                {anual && plan.ahorroAnualPorcentaje > 0 && (
                  <div className="text-[11px] text-[color:var(--color-success)]">
                    Ahorra {plan.ahorroAnualPorcentaje}% al año
                  </div>
                )}
                {plan.id !== "demo" && (
                  <div className="text-[11px] text-[color:var(--color-success)]">
                    {DIAS_TRIAL_PLAN_PAGO} dias gratis sin tarjeta
                  </div>
                )}
              </div>
              <ul className="mt-3 flex-1 space-y-1.5 text-[12px]">
                <LiP ok>{plan.maxSucursales ?? "∞"} sucursal(es)</LiP>
                <LiP ok>{plan.maxUsuarios ?? "∞"} usuarios</LiP>
                <LiP ok>{plan.maxProductos ?? "∞"} productos</LiP>
                <LiP ok>{plan.maxTransaccionesMes ?? "∞"} transacciones/mes</LiP>
                <LiP ok>{plan.maxClientes ?? "∞"} clientes</LiP>
                <LiP ok>{plan.maxFacturasMes ?? "∞"} facturas/mes</LiP>
                <LiP ok={plan.features.contabilidad}>Contabilidad</LiP>
                <LiP ok={plan.features.modulo_nomina}>Nómina</LiP>
                <LiP ok={plan.features.reportes_avanzados}>Reportes avanzados</LiP>
                <LiP ok={plan.features.multi_sucursal}>Multi-sucursal</LiP>
                <LiP ok={plan.features.ia_asistente}>{descripcionLimiteIA(plan.id)}</LiP>
              </ul>
              {esActual && !puedePagarActual ? (
                <div className="mt-4 rounded-md bg-[color:var(--color-surface-2)] py-2 text-center text-small font-medium text-[color:var(--color-text-muted)]">
                  {trialPagoActivo ? "Prueba gratis activa" : "Plan actual"}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onElegir(plan)}
                  disabled={seleccionando !== null || demoBloqueado || planPagoBloqueadoPorTrial}
                  className="arca-btn arca-btn-primary mt-4 w-full justify-center"
                >
                  {seleccionando === plan.id
                    ? "Activando…"
                    : demoBloqueado
                      ? "No disponible"
                    : planPagoBloqueadoPorTrial
                      ? "Gratis activo"
                    : puedePagarActual
                      ? `Pagar ${plan.nombre}`
                      : plan.id === "demo"
                      ? "Elegir Demo"
                      : `Probar ${plan.nombre}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function VistaCheckout({
  plan,
  anual,
  setAnual,
  precio,
  onVolver,
  onExito,
  onError,
}: {
  plan: Plan;
  anual: boolean;
  setAnual: (v: boolean) => void;
  precio: number;
  onVolver: () => void;
  onExito: (recibo: ReciboData) => void;
  onError: (mensaje: string) => void;
}) {
  return (
    <div className="mx-auto max-w-md">
      <button
        type="button"
        onClick={onVolver}
        className="mb-4 flex items-center gap-1 text-small text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
      >
        <ArrowLeft size={15} />
        Volver a planes
      </button>

      <div className="text-center">
        <h2 className="text-xl font-bold text-[color:var(--color-text-primary)]">
          Contratar {plan.nombre}
        </h2>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          {plan.descripcionCorta}
        </p>
        <TogglePeriodo anual={anual} setAnual={setAnual} />
      </div>

      <div className="mt-5 rounded-xl bg-[color:var(--color-surface-2)] p-5">
        <div className="flex items-center justify-between text-small">
          <span className="text-[color:var(--color-text-secondary)]">
            Plan {plan.nombre} · {anual ? "Anual" : "Mensual"}
          </span>
          <span className="font-medium text-[color:var(--color-text-primary)]">
            ${precio.toFixed(2)}
          </span>
        </div>
        {anual && plan.ahorroAnualPorcentaje > 0 && (
          <div className="mt-1 text-right text-[11px] text-[color:var(--color-success)]">
            Incluye {plan.ahorroAnualPorcentaje}% de descuento anual
          </div>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-[color:var(--color-border)] pt-3">
          <span className="font-semibold text-[color:var(--color-text-primary)]">
            Total hoy
          </span>
          <span className="text-lg font-bold text-[color:var(--color-primary)]">
            ${precio.toFixed(2)} <span className="text-[11px] font-normal">USD</span>
          </span>
        </div>
      </div>

      <div className="mt-5">
        <PayPalCheckout
          planId={plan.id}
          ciclo={anual ? "anual" : "mensual"}
          onExito={onExito}
          onError={onError}
        />
      </div>

      <div className="my-4 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
        <span className="h-px flex-1 bg-[color:var(--color-border)]" />
        o
        <span className="h-px flex-1 bg-[color:var(--color-border)]" />
      </div>

      <TransferenciaCheckout
        plan={plan}
        ciclo={anual ? "anual" : "mensual"}
        precio={precio}
      />
    </div>
  );
}

function TogglePeriodo({
  anual,
  setAnual,
}: {
  anual: boolean;
  setAnual: (v: boolean) => void;
}) {
  return (
    <div className="mt-3 inline-flex rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-1 text-small">
      <button
        type="button"
        onClick={() => setAnual(false)}
        className={cn(
          "rounded-full px-3 py-1 transition",
          !anual
            ? "bg-[color:var(--color-surface)] font-medium shadow-sm"
            : "text-[color:var(--color-text-muted)]",
        )}
      >
        Mensual
      </button>
      <button
        type="button"
        onClick={() => setAnual(true)}
        className={cn(
          "rounded-full px-3 py-1 transition",
          anual
            ? "bg-[color:var(--color-surface)] font-medium shadow-sm"
            : "text-[color:var(--color-text-muted)]",
        )}
      >
        Anual
      </button>
    </div>
  );
}

function LiP({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <li className={cn("flex items-center gap-1.5", !ok && "text-[color:var(--color-text-muted)] line-through")}>
      <Check
        size={13}
        className={ok ? "text-[color:var(--color-success)]" : "text-[color:var(--color-border-strong)]"}
      />
      {children}
    </li>
  );
}
