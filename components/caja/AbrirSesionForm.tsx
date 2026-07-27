"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { abrirSesion } from "@/lib/actions/caja";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

type Caja = { value: string; label: string };

export function AbrirSesionForm({
  cajas,
  pais,
}: {
  cajas: Caja[];
  pais: PaisCodigo;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);
  const [cajaId, setCajaId] = useState(cajas[0]?.value ?? "");
  const [montoInicial, setMontoInicial] = useState<number | "">(0);

  const montoNum = typeof montoInicial === "number" ? montoInicial : 0;

  async function enviar() {
    setEnviando(true);
    const res = await abrirSesion({ cajaId, montoInicial: montoNum });
    setEnviando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", "Caja abierta");
    router.push(`/caja/${res.sesionId}`);
  }

  return (
    <Card>
      <CardHeader title="Abrir sesión de caja" />
      <CardBody className="space-y-4">
        <Select
          label="Caja"
          value={cajaId}
          onChange={(e) => setCajaId(e.target.value)}
          options={cajas}
        />
        <div>
          <Input
            label="Monto inicial (efectivo en caja)"
            type="number"
            step="0.01"
            min="0"
            value={montoInicial}
            onChange={(e) => setMontoInicial(parseFloat(e.target.value) || 0)}
          />
          {montoNum > 0 && (
            <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
              {formatearMoneda(montoNum, pais)} en efectivo al abrir
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={enviar} loading={enviando}>
            Abrir caja
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
