"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { registrarPago } from "@/lib/actions/cxp";
import { formatearMoneda } from "@/lib/utils";
import { fechaISOEnZona } from "@/lib/dates";
import type { PaisCodigo } from "@/lib/paises";

type Opcion = { value: string; label: string };

export function PagoForm({
  cxpId,
  saldoPendiente,
  pais,
  cuentasFinancieras,
}: {
  cxpId: string;
  saldoPendiente: number;
  pais: PaisCodigo;
  cuentasFinancieras: Opcion[];
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);

  const [cuentaFinancieraId, setCuentaFinancieraId] = useState(cuentasFinancieras[0]?.value ?? "");
  const [fecha, setFecha] = useState(fechaISOEnZona());
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
    const res = await registrarPago({
      cxpId,
      cuentaFinancieraId,
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
    mostrar("success", "Pago registrado");
    router.refresh();
  }

  if (cuentasFinancieras.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-small text-[color:var(--color-text-muted)]">
            No hay cuentas financieras activas. Configúralas en Tesorería → Cuentas.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Registrar pago" />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <Select
            label="Pagar desde"
            value={cuentaFinancieraId}
            onChange={(e) => setCuentaFinancieraId(e.target.value)}
            options={cuentasFinancieras}
          />
        </div>

        <div>
          <Input
            label="Monto a pagar"
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
          placeholder="Observaciones del pago..."
        />

        <div className="flex justify-end">
          <Button
            onClick={enviar}
            loading={enviando}
            disabled={!montoNum || excedeSaldo}
          >
            Registrar pago
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
