"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cerrarSesion } from "@/lib/actions/caja";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

type ArqueoFormProps = {
  sesionId: string;
  montoEsperado: number;
  pais: PaisCodigo;
};

export function ArqueoForm(props: ArqueoFormProps) {
  return <ArqueoFormInner key={`${props.sesionId}:${props.montoEsperado}`} {...props} />;
}

function ArqueoFormInner({
  sesionId,
  montoEsperado,
  pais,
}: ArqueoFormProps) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);
  const [montoReal, setMontoReal] = useState<number | "">(() => montoEsperado);
  const [notas, setNotas] = useState("");

  const montoNum = typeof montoReal === "number" ? montoReal : 0;
  const diferencia = montoNum - montoEsperado;
  const tieneError = diferencia < 0;
  const tieneSobrante = diferencia > 0.0001;

  async function enviar() {
    setEnviando(true);
    const res = await cerrarSesion({
      sesionId,
      montoFinalReal: montoNum,
      notas: notas.trim() || undefined,
    });
    setEnviando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", "Caja cerrada");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title="Arqueo y cierre de caja" />
      <CardBody className="space-y-5">
        <div className="rounded-md bg-[color:var(--color-surface-2)] p-4">
          <div className="flex justify-between text-small">
            <span className="text-[color:var(--color-text-muted)]">Monto esperado</span>
            <span className="font-semibold">{formatearMoneda(montoEsperado, pais)}</span>
          </div>
          <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
            Monto inicial + ventas de contado en esta sesión
          </p>
        </div>

        <div>
          <Input
            label="Monto contado (efectivo real en caja)"
            type="number"
            step="0.01"
            min="0"
            value={montoReal}
            onChange={(e) => setMontoReal(parseFloat(e.target.value) || 0)}
          />
          {(tieneError || tieneSobrante) && (
            <p
              className={`mt-1 text-[12px] font-medium ${
                tieneError
                  ? "text-[color:var(--color-error)]"
                  : "text-[color:var(--color-success)]"
              }`}
            >
              {tieneError ? "Faltante" : "Sobrante"}:{" "}
              {formatearMoneda(Math.abs(diferencia), pais)}
            </p>
          )}
          {!tieneError && !tieneSobrante && montoNum > 0 && (
            <p className="mt-1 text-[12px] text-[color:var(--color-success)]">Cuadra exacto ✓</p>
          )}
        </div>

        <Input
          label="Notas (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Observaciones del cierre..."
        />

        <div className="flex justify-end">
          <Button onClick={enviar} loading={enviando} variant="danger">
            Cerrar caja
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
