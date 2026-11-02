"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import type { ManualPaymentEvidence } from "@/lib/pos-payment";
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
  onConfirmar: (datos: { pagos: Array<{ formaPagoId: string; monto: number; referencia?: string } & ManualPaymentEvidence>; esCredito: boolean }) => void | Promise<void>;
}) {
  const efectivo = formasPago.find((f) => f.codigo === "EFE");
  const credito = formasPago.find((f) => f.codigo === "CRE");
  const noCredito = formasPago.filter((f) => f.codigo !== "CRE");

  const [modo, setModo] = useState<"contado" | "mixto" | "credito">("contado");
  const [formaUnica, setFormaUnica] = useState<string>(efectivo?.id ?? noCredito[0]?.id ?? "");
  const [montoEfectivoStr, setMontoEfectivoStr] = useState<string>("");
  const [montoMixto, setMontoMixto] = useState<Record<string, string>>({});
  const [referencias, setReferencias] = useState<Record<string, string>>({});
  const [tarjetasMixtas, setTarjetasMixtas] = useState<Record<string,{monto:number;info:ResultadoTarjeta}>>({});
  const [errorPago,setErrorPago] = useState("");
  const enviando = useRef(false);
  const enviar = useCallback(async (datos: Parameters<typeof onConfirmar>[0]) => {
    if (enviando.current) return;
    enviando.current=true;
    setErrorPago("");
    try { await onConfirmar(datos); }
    catch(error) { setErrorPago(error instanceof Error ? error.message : "No se pudo registrar el pago."); }
    finally { enviando.current=false; }
  },[onConfirmar]);
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
    void enviar({
      pagos: [
        {
          formaPagoId: formaSeleccionada.id,
          monto: totalCobro,
          referencia: referenciaTarjeta(info),
          terminalApproved: true,
          terminalIndependent: info.terminalIndependent === true,
          terminalAuthorization: info.autorizacion,
          paymentSource: "external_terminal_manual",
        },
      ],
      esCredito: false,
    });
  }

  const confirmar = useCallback(() => {
    if (procesando) return;
    setErrorPago("");
    if (modo === "contado") {
      // El cobro con tarjeta se confirma con "Pago aprobado" en el datáfono, no aquí.
      if (esTarjeta) return;
      const seleccionada = formasPago.find((forma)=>forma.id===formaUnica);
      const transferencia=seleccionada&&["TRA","TRANSFERENCIA"].includes(seleccionada.codigo);
      if(transferencia&&!cliente?.id){setErrorPago("Selecciona un cliente para registrar la transferencia pendiente.");return;}
      if (!seleccionada || (seleccionada.requiereReferencia && !referencias[formaUnica]?.trim())) {
        setErrorPago("Ingresa la referencia del pago.");
        return;
      }
      if (formaUnica === efectivo?.id && montoEfectivo + 0.001 < totalCobro) {
        return;
      }
      const forma = formasPago.find((f) => f.id === formaUnica);
      void enviar({
        pagos: [
          {
            formaPagoId: formaUnica,
            monto: totalCobro,
            referencia: referencias[formaUnica],
            ...(transferencia?{paymentSource:"bank_transfer_pending" as const}:{}),
          },
        ],
        esCredito: false,
      });
    } else if (modo === "mixto") {
      const pagos: Array<{formaPagoId:string;monto:number;referencia?:string}&ManualPaymentEvidence> = [];
      for (const [id, monto] of Object.entries(montoMixto)) {
        const montoPago = dineroPos(parseFloat(monto) || 0);
        if (montoPago > 0) {
          const forma = formasPago.find((row)=>row.id===id);
          if (!forma || forma.codigo==="CRE") {setErrorPago("Forma de pago no válida.");return;}
          const tarjeta = tarjetasMixtas[id];
          const transferencia=["TRA","TRANSFERENCIA"].includes(forma.codigo);
          if(transferencia&&!cliente?.id){setErrorPago("Selecciona un cliente para registrar la transferencia pendiente.");return;}
          if (forma.codigo==="TAR" && (!tarjeta || tarjeta.monto!==montoPago || !tarjeta.info.autorizacion?.trim() || !tarjeta.info.terminalIndependent)) {
            setErrorPago("Confirma en el datáfono cada importe con tarjeta.");
            return;
          }
          if (forma.codigo!=="TAR" && forma.requiereReferencia && !referencias[id]?.trim()) {setErrorPago("Ingresa la referencia de cada pago.");return;}
          pagos.push({
            formaPagoId: id,
            monto: montoPago,
            referencia: forma.codigo==="TAR" ? referenciaTarjeta(tarjeta.info) : referencias[id],
            ...(forma.codigo==="TAR" ? {terminalApproved:true,terminalIndependent:true,terminalAuthorization:tarjeta.info.autorizacion,paymentSource:"external_terminal_manual" as const} : {}),
            ...(transferencia?{paymentSource:"bank_transfer_pending" as const}:{}),
          });
        }
      }
      const sumaTotal = pagos.reduce((a, p) => a + p.monto, 0);
      if (Math.abs(dineroPos(sumaTotal) - totalCobro) > 0.01) {setErrorPago("La suma de pagos debe coincidir con el total.");return;}
      void enviar({ pagos, esCredito: false });
    } else {
      if (!cliente || !cliente.tieneCredito || !credito) return;
      void enviar({
        pagos: [],
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
    enviar,
    procesando,
    referencias,
    tarjetasMixtas,
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
        {(modo==="contado"&&formaSeleccionada&&["TRA","TRANSFERENCIA"].includes(formaSeleccionada.codigo)||modo==="mixto"&&formasPago.some((forma)=>["TRA","TRANSFERENCIA"].includes(forma.codigo)&&(parseFloat(montoMixto[forma.id])||0)>0))&&<p role="status" className="rounded-md bg-[color:var(--color-warning-bg)] p-3 text-small">Transferencia pendiente de verificación. No se registra como dinero recibido. Selecciona un cliente; el importe queda por cobrar hasta revisar el abono real en el banco.</p>}
        {errorPago && <div role="alert" className="text-small text-[color:var(--color-danger)]">{errorPago}</div>}
        <div className="flex gap-2 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-1">
          {(["contado", "mixto", "credito"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {setModo(m);setTarjetasMixtas({});setErrorPago("");}}
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
                key={formaSeleccionada.id}
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
              <div key={f.id} className="space-y-2">
                <div className="flex-1">
                  <Input
                    label={f.nombre}
                    type="text"
                    inputMode="decimal"
                    value={montoMixto[f.id] ?? ""}
                    onChange={(e) => {
                      setTarjetasMixtas((value)=>{const next={...value};delete next[f.id];return next;});
                      setMontoMixto((m) => ({
                        ...m,
                        [f.id]: e.target.value.replace(/[^0-9.]/g, ""),
                      }));
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                {f.codigo==="TAR" && (parseFloat(montoMixto[f.id])||0)>0 && (
                  tarjetasMixtas[f.id] ? <p className="text-small text-[color:var(--color-success)]">Datáfono confirmado: {referenciaTarjeta(tarjetasMixtas[f.id].info)}</p> :
                  <PagoTarjetaPanel total={dineroPos(parseFloat(montoMixto[f.id]))} pais={pais} procesando={procesando}
                    onRechazado={()=>setTarjetasMixtas((value)=>{const next={...value};delete next[f.id];return next;})}
                    onAprobado={(info)=>setTarjetasMixtas((value)=>({...value,[f.id]:{monto:dineroPos(parseFloat(montoMixto[f.id])),info}}))} />
                )}
                {f.codigo!=="TAR" && f.requiereReferencia && (parseFloat(montoMixto[f.id])||0)>0 && <Input label="Referencia del pago" value={referencias[f.id]??""} onChange={(event)=>setReferencias((value)=>({...value,[f.id]:event.target.value}))} />}
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
