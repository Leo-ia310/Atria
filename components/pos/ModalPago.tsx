"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { PagoTarjetaPanel } from "@/components/pos/PagoTarjetaPanel";
import { referenciaTarjeta, type ResultadoTarjeta } from "@/components/pos/PagoTarjetaPanel.helpers";
import { cn, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import type { ClientePOS, FormaPagoPOS, ItemCarrito } from "@/components/pos/POSContenedor";

function dineroPos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[color:var(--color-text-muted)]">{label}</span>
      <span className="font-medium text-[color:var(--color-text-primary)]">{valor}</span>
    </div>
  );
}

export function ModalPago({
  pais,
  total,
  carrito,
  cliente,
  formasPago,
  procesando,
  onCerrar,
  onConfirmar,
}: {
  pais: PaisCodigo;
  total: number;
  subtotal: number;
  impuesto: number;
  carrito: ItemCarrito[];
  cliente?: ClientePOS;
  formasPago: FormaPagoPOS[];
  sucursalId: string;
  almacenId: string;
  procesando: boolean;
  onCerrar: () => void;
  onConfirmar: (datos: { pagos: { formaPagoId: string; monto: number; referencia?: string }[]; esCredito: boolean }) => void;
}) {
  const efectivo = formasPago.find((f) => f.codigo === "EFE");
  const credito = formasPago.find((f) => f.codigo === "CRE");
  const noCredito = formasPago.filter((f) => f.codigo !== "CRE");

  const [modo, setModo] = useState<"contado" | "mixto" | "credito">("contado");
  const [formaUnica, setFormaUnica] = useState<string>(efectivo?.id ?? noCredito[0]?.id ?? "");
  const [montoEfectivoStr, setMontoEfectivoStr] = useState<string>("");
  const [montoMixto, setMontoMixto] = useState<Record<string, string>>({});
  const [referencias, setReferencias] = useState<Record<string, string>>({});
  const totalCobro = dineroPos(total);
  const formaSeleccionada = formasPago.find((f) => f.id === formaUnica);
  const esTarjeta = modo === "contado" && formaSeleccionada?.codigo === "TAR";

  void carrito; // referenciado para tipo

  const montoEfectivoRaw =
    montoEfectivoStr.trim() === "" ? totalCobro : parseFloat(montoEfectivoStr);
  const montoEfectivo = dineroPos(Number.isFinite(montoEfectivoRaw) ? montoEfectivoRaw : 0);
  const cambio = Math.max(0, dineroPos(montoEfectivo - totalCobro));

  function confirmarTarjeta(info: ResultadoTarjeta) {
    if (procesando || !formaSeleccionada) return;
    onConfirmar({
      pagos: [
        {
          formaPagoId: formaSeleccionada.id,
          monto: totalCobro,
          referencia: referenciaTarjeta(info),
        },
      ],
      esCredito: false,
    });
  }

  const confirmar = useCallback(() => {
    if (procesando) return;
    if (modo === "contado") {
      // El cobro con tarjeta se confirma con "Pago aprobado" en el datáfono, no aquí.
      if (esTarjeta) return;
      if (formaUnica === efectivo?.id && montoEfectivo + 0.001 < totalCobro) {
        return;
      }
      const forma = formasPago.find((f) => f.id === formaUnica);
      onConfirmar({
        pagos: [
          {
            formaPagoId: formaUnica,
            monto: totalCobro,
            referencia: referencias[formaUnica],
          },
        ],
        esCredito: false,
      });
    } else if (modo === "mixto") {
      const pagos: { formaPagoId: string; monto: number; referencia?: string }[] = [];
      for (const [id, monto] of Object.entries(montoMixto)) {
        const montoPago = dineroPos(parseFloat(monto) || 0);
        if (montoPago > 0) {
          pagos.push({
            formaPagoId: id,
            monto: montoPago,
            referencia: referencias[id],
          });
        }
      }
      const sumaTotal = pagos.reduce((a, p) => a + p.monto, 0);
      if (Math.abs(dineroPos(sumaTotal) - totalCobro) > 0.01) return;
      onConfirmar({ pagos, esCredito: false });
    } else {
      if (!cliente || !cliente.tieneCredito || !credito) return;
      onConfirmar({
        pagos: [{ formaPagoId: credito.id, monto: totalCobro }],
        esCredito: true,
      });
    }
  }, [
    cliente,
    credito,
    efectivo?.id,
    esTarjeta,
    formaUnica,
    formasPago,
    modo,
    montoEfectivo,
    montoMixto,
    onConfirmar,
    procesando,
    referencias,
    totalCobro,
  ]);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key !== "F12") return;
      event.preventDefault();
      confirmar();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [confirmar]);

  return (
    <Modal
      abierto={true}
      onCerrar={procesando ? () => {} : onCerrar}
      titulo="Cobrar venta"
      descripcion={`Total a cobrar: ${formatearMoneda(total, pais)}`}
      ancho="md"
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={procesando}>
            Cancelar
          </Button>
          {!esTarjeta && (
            <Button onClick={confirmar} loading={procesando}>
              {procesando ? (
                <>
                  <Loader2 className="animate-spin" size={14} /> Procesando
                </>
              ) : (
                <>
                  <Check size={14} /> Confirmar venta (F12)
                </>
              )}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-1">
          {(["contado", "mixto", "credito"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              disabled={m === "credito" && !cliente?.tieneCredito}
              className={cn(
                "flex-1 rounded px-3 py-1.5 text-small transition disabled:opacity-30",
                modo === m
                  ? "bg-[color:var(--color-surface)] font-medium text-[color:var(--color-text-primary)] shadow-sm"
                  : "text-[color:var(--color-text-muted)]",
              )}
            >
              {m === "contado" ? "Contado" : m === "mixto" ? "Mixto" : "Crédito"}
            </button>
          ))}
        </div>

        {modo === "contado" && (
          <div className="space-y-3">
            <Select
              label="Forma de pago"
              value={formaUnica}
              onChange={(e) => setFormaUnica(e.target.value)}
              options={noCredito.map((f) => ({ value: f.id, label: f.nombre }))}
            />
            {formaSeleccionada?.codigo === "EFE" ? (
              <>
                <Input
                  label="Monto recibido"
                  type="text"
                  inputMode="decimal"
                  placeholder={totalCobro.toFixed(2)}
                  value={montoEfectivoStr}
                  onChange={(e) =>
                    setMontoEfectivoStr(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={() => setMontoEfectivoStr(totalCobro.toFixed(2))}
                  className="text-small font-medium text-[color:var(--color-primary)] hover:underline"
                >
                  Pago exacto ({formatearMoneda(totalCobro, pais)})
                </button>
                <div className="rounded-md bg-[color:var(--color-surface-2)] p-3 text-center">
                  <div className="text-label">Cambio</div>
                  <div className="text-2xl text-[color:var(--color-primary)]">
                    {formatearMoneda(cambio, pais)}
                  </div>
                </div>
              </>
            ) : esTarjeta ? (
              <PagoTarjetaPanel
                total={totalCobro}
                pais={pais}
                procesando={procesando}
                onAprobado={confirmarTarjeta}
                onRechazado={() => {}}
              />
            ) : formaSeleccionada?.requiereReferencia ? (
              <Input
                label="Número de referencia / autorización"
                value={referencias[formaUnica] ?? ""}
                onChange={(e) =>
                  setReferencias((r) => ({ ...r, [formaUnica]: e.target.value }))
                }
              />
            ) : null}
          </div>
        )}

        {modo === "mixto" && (
          <div className="space-y-3">
            <p className="text-small text-[color:var(--color-text-muted)]">
              Divide el pago entre dos o más formas.
            </p>
            {noCredito.map((f) => (
              <div key={f.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    label={f.nombre}
                    type="text"
                    inputMode="decimal"
                    value={montoMixto[f.id] ?? ""}
                    onChange={(e) =>
                      setMontoMixto((m) => ({
                        ...m,
                        [f.id]: e.target.value.replace(/[^0-9.]/g, ""),
                      }))
                    }
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>
            ))}
            <div className="rounded-md bg-[color:var(--color-surface-2)] p-3 text-small">
              {fila({ label: "Suma de pagos", valor: formatearMoneda(
                  Object.values(montoMixto).reduce(
                    (a, b) => a + (parseFloat(b) || 0),
                    0,
                  ),
                  pais,
                ) })}
              {fila({ label: "Total venta", valor: formatearMoneda(total, pais) })}
            </div>
          </div>
        )}

        {modo === "credito" && (
          <div className="rounded-md bg-[color:var(--color-warning-bg)] p-4 text-small text-[color:var(--color-text-primary)]">
            <p className="font-medium">Venta al crédito</p>
            <p className="mt-1 text-[color:var(--color-text-muted)]">
              Se cargará al cliente <strong>{cliente?.nombre}</strong> con vencimiento a{" "}
              <strong>{cliente?.diasCredito} días</strong>. Se generará automáticamente
              la cuenta por cobrar.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
