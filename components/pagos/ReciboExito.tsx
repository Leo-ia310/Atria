"use client";

import { Check, Download, Sparkles } from "lucide-react";
import type { ReciboData } from "@/lib/pagos/recibo";

function montoUSD(monto: number, moneda: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: moneda || "USD",
    minimumFractionDigits: 2,
  }).format(monto);
}

function fechaLarga(iso: string) {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function ReciboExito({
  recibo,
  onCerrar,
}: {
  recibo: ReciboData;
  onCerrar: () => void;
}) {
  const cicloTexto = recibo.ciclo === "anual" ? "Anual" : "Mensual";

  return (
    <div className="mx-auto max-w-md">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-success-bg)]">
          <Check size={32} className="text-[color:var(--color-success)]" strokeWidth={2.5} />
        </div>
        <h2 className="mt-4 text-xl font-bold text-[color:var(--color-text-primary)]">
          ¡Pago confirmado!
        </h2>
        <p className="mt-1 flex items-center gap-1.5 text-small text-[color:var(--color-text-muted)]">
          <Sparkles size={14} className="text-[color:var(--color-tertiary)]" />
          Tu plan {recibo.planNombre} ya está activo
        </p>
      </div>

      <div className="mt-5 rounded-xl bg-[color:var(--color-surface-2)] p-5 text-center">
        <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-muted)]">
          Total pagado
        </p>
        <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">
          {montoUSD(recibo.monto, recibo.moneda)}
        </p>
        <p className="mt-0.5 text-[12px] text-[color:var(--color-text-secondary)]">
          Plan {recibo.planNombre} · {cicloTexto}
        </p>
      </div>

      <dl className="mt-4 space-y-0 rounded-xl border border-[color:var(--color-border)] px-4">
        <Fila label="Número de recibo" valor={recibo.numeroRecibo} mono />
        <Fila label="Fecha" valor={fechaLarga(recibo.fechaISO)} />
        <Fila label="Empresa" valor={recibo.empresaNombre} />
        <Fila label="Método de pago" valor={recibo.metodoPago} />
        <Fila label="Vigente hasta" valor={fechaLarga(recibo.vigenteHastaISO)} />
        {recibo.pagadorEmail && (
          <Fila label="Comprobante enviado a" valor={recibo.pagadorEmail} ultima />
        )}
      </dl>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-[color:var(--color-text-muted)]">
        <Download size={13} />
        Te enviamos una copia del recibo por correo.
      </p>

      <button
        type="button"
        onClick={onCerrar}
        className="arca-btn arca-btn-primary mt-5 w-full justify-center"
      >
        Ir a mi panel
      </button>
    </div>
  );
}

function Fila({
  label,
  valor,
  mono,
  ultima,
}: {
  label: string;
  valor: string;
  mono?: boolean;
  ultima?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 ${
        ultima ? "" : "border-b border-[color:var(--color-border)]"
      }`}
    >
      <dt className="text-[12px] text-[color:var(--color-text-muted)]">{label}</dt>
      <dd
        className={`text-right text-[13px] font-medium text-[color:var(--color-text-primary)] ${
          mono ? "font-mono text-[12px]" : ""
        }`}
      >
        {valor}
      </dd>
    </div>
  );
}
