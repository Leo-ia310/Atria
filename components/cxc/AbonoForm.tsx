"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { registrarAbono } from "@/lib/actions/cxc";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

type Opcion = { value: string; label: string };

export function AbonoForm({
  cxcId,
  saldoPendiente,
  pais,
  formasPago,
}: {
  cxcId: string;
  saldoPendiente: number;
  pais: PaisCodigo;
  formasPago: Opcion[];
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);

  const [formaPagoId, setFormaPagoId] = useState(formasPago[0]?.value ?? "");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState<number | "">(saldoPendiente);
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");

  const montoNum = typeof monto === "number" ? monto : 0;
  const excedeSaldo = montoNum > saldoPendiente + 0.0001;

  async function enviar() {
    if (!montoNum || montoNum <= 0) {
      mostrar("warning", "El monto debe ser mayor a cero");
      return;
    }
    if (excedeSaldo) {
      mostrar("warning", "El monto supera el saldo pendiente");
      return;
    }
    setEnviando(true);
    const res = await registrarAbono({
      cxcId,
      formaPagoId,
      fecha,
      monto: montoNum,
      referencia: referencia.trim() || undefined,
      notas: notas.trim() || undefined,
    });
    setEnviando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", "Abono registrado");
    router.refresh();
  }

  if (formasPago.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-small text-[color:var(--color-text-muted)]">
            No hay formas de pago activas. Configúralas en Configuración → Formas de pago.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Registrar abono" />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <Select
            label="Forma de pago"
            value={formaPagoId}
            onChange={(e) => setFormaPagoId(e.target.value)}
            options={formasPago}
          />
        </div>

        <div>
          <Input
            label="Monto a abonar"
            type="number"
            step="0.01"
            min="0.01"
            max={saldoPendiente}
            value={monto}
            onChange={(e) => setMonto(parseFloat(e.target.value) || "")}
          />
          {excedeSaldo && (
            <p className="mt-1 text-[12px] text-[color:var(--color-error)]">
              Supera el saldo pendiente de {formatearMoneda(saldoPendiente, pais)}
            </p>
          )}
          <button
            type="button"
            onClick={() => setMonto(saldoPendiente)}
            className="mt-1 text-[12px] text-[color:var(--color-secondary)] hover:underline"
          >
            Saldar completo ({formatearMoneda(saldoPendiente, pais)})
          </button>
        </div>

        <Input
          label="Referencia (opcional)"
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
          placeholder="N° cheque, transferencia, recibo..."
        />
        <Input
          label="Notas (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Observaciones del cobro..."
        />

        <div className="flex justify-end">
          <Button
            onClick={enviar}
            loading={enviando}
            disabled={!montoNum || excedeSaldo}
          >
            Registrar abono
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
