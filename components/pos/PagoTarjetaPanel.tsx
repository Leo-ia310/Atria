"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import type { ResultadoTarjeta } from "@/components/pos/PagoTarjetaPanel.helpers";

const MARCAS = [
  { value: "", label: "Sin especificar" },
  { value: "Visa", label: "Visa" },
  { value: "Mastercard", label: "Mastercard" },
  { value: "Amex", label: "American Express" },
  { value: "Otra", label: "Otra" },
];

/**
 * Confirmación manual del cobro con datáfono. La interfaz (onAprobado / onRechazado)
 * está pensada para que, en el futuro, una integración real con API/SDK del datáfono
 * reemplace estos botones y dispare onAprobado automáticamente al recibir la respuesta.
 */
export function PagoTarjetaPanel({
  total,
  pais,
  procesando,
  onAprobado,
  onRechazado,
}: {
  total: number;
  pais: PaisCodigo;
  procesando: boolean;
  onAprobado: (info: ResultadoTarjeta) => void;
  onRechazado: () => void;
}) {
  const [autorizacion, setAutorizacion] = useState("");
  const [ultimos4, setUltimos4] = useState("");
  const [marca, setMarca] = useState("");
  const [rechazado, setRechazado] = useState(false);

  function aprobar() {
    if (procesando) return;
    onAprobado({
      autorizacion: autorizacion.trim() || undefined,
      ultimos4: ultimos4.trim() || undefined,
      marca: marca || undefined,
    });
  }

  function rechazar() {
    if (procesando) return;
    setRechazado(true);
    onRechazado();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-[color:var(--color-text-muted)]">
          <CreditCard size={16} />
          <span className="text-label">Cobro con tarjeta</span>
        </div>
        <div className="mt-1 text-2xl font-semibold text-[color:var(--color-primary)]">
          {formatearMoneda(total, pais)}
        </div>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          Procesa el pago en el datáfono y confirma el resultado.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label="Marca (opcional)"
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          options={MARCAS}
        />
        <Input
          label="Últimos 4 (opcional)"
          inputMode="numeric"
          maxLength={4}
          placeholder="1234"
          value={ultimos4}
          onChange={(e) => setUltimos4(e.target.value.replace(/\D/g, "").slice(0, 4))}
        />
        <Input
          label="Autorización (opcional)"
          placeholder="Código del voucher"
          value={autorizacion}
          onChange={(e) => setAutorizacion(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
        />
      </div>

      {rechazado && !procesando && (
        <div className="rounded-md bg-[color:var(--color-danger-bg,rgba(220,38,38,0.1))] p-3 text-small text-[color:var(--color-danger)]">
          Pago rechazado. Intenta de nuevo en el datáfono o usa otra forma de pago.
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={rechazar}
          disabled={procesando}
          className="flex items-center justify-center gap-2 rounded-md border border-[color:var(--color-border-strong)] px-4 py-2.5 text-small font-medium text-[color:var(--color-text-primary)] transition hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] disabled:opacity-50"
        >
          <XCircle size={16} /> Pago rechazado
        </button>
        <button
          type="button"
          onClick={aprobar}
          disabled={procesando}
          className="flex items-center justify-center gap-2 rounded-md bg-[color:var(--color-success)] px-4 py-2.5 text-small font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {procesando ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Registrando…
            </>
          ) : (
            <>
              <CheckCircle2 size={16} /> Pago aprobado
            </>
          )}
        </button>
      </div>
    </div>
  );
}
