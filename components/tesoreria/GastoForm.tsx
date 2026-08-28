"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { crearGasto } from "@/lib/actions/tesoreria";
import { formatearMoneda } from "@/lib/utils";
import { fechaISOEnZona } from "@/lib/dates";
import type { PaisCodigo } from "@/lib/paises";

type Opcion = { value: string; label: string };

export function GastoForm({
  pais,
  categorias,
  cuentas,
  tasaImpuesto,
}: {
  pais: PaisCodigo;
  categorias: Opcion[];
  cuentas: Opcion[];
  tasaImpuesto: number;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);

  const [categoriaId, setCategoriaId] = useState(categorias[0]?.value ?? "");
  const [cuentaFinancieraId, setCuentaFinancieraId] = useState(cuentas[0]?.value ?? "");
  const [fecha, setFecha] = useState(() => fechaISOEnZona());
  const [descripcion, setDescripcion] = useState("");
  const [referencia, setReferencia] = useState("");
  const [subtotal, setSubtotal] = useState<number | "">("");
  const [aplicaIva, setAplicaIva] = useState(false);
  const [recurrenteMensual, setRecurrenteMensual] = useState(false);

  const subtotalNum = typeof subtotal === "number" ? subtotal : 0;
  const impuesto = aplicaIva ? Math.round(subtotalNum * tasaImpuesto * 10000) / 10000 : 0;
  const total = subtotalNum + impuesto;

  async function enviar() {
    if (!descripcion.trim()) {
      mostrar("warning", "Ingresa una descripción");
      return;
    }
    if (!subtotalNum || subtotalNum <= 0) {
      mostrar("warning", "El monto debe ser mayor a cero");
      return;
    }
    setEnviando(true);
    const res = await crearGasto({
      categoriaId,
      cuentaFinancieraId,
      fecha,
      descripcion: descripcion.trim(),
      referencia: referencia.trim() || undefined,
      subtotal: subtotalNum,
      impuesto,
      recurrenteMensual,
    });
    setEnviando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", "Gasto registrado");
    router.push("/tesoreria/gastos");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card>
        <CardHeader title="Datos del gasto" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
            <Select
              label="Categoría"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              options={categorias}
            />
          </div>
          <Input
            label="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Pago de alquiler local comercial"
          />
          <Input
            label="Referencia / N° documento (opcional)"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Factura, recibo, número de cheque..."
          />
          <Select
            label="Pagar con"
            value={cuentaFinancieraId}
            onChange={(e) => setCuentaFinancieraId(e.target.value)}
            options={cuentas}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Montos" />
        <CardBody className="space-y-4">
          <Input
            label="Subtotal (sin impuesto)"
            type="number"
            step="0.01"
            min="0"
            value={subtotal}
            onChange={(e) => setSubtotal(parseFloat(e.target.value) || "")}
            placeholder="0.00"
          />
          <label className="flex cursor-pointer items-center gap-2 text-small">
            <input
              type="checkbox"
              checked={aplicaIva}
              onChange={(e) => setAplicaIva(e.target.checked)}
              className="h-4 w-4"
            />
            Incluye {pais === "HN" ? "ISV" : "IVA"} ({(tasaImpuesto * 100).toFixed(0)}%)
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[color:var(--color-border)] p-3 text-small">
            <input
              type="checkbox"
              checked={recurrenteMensual}
              onChange={(e) => setRecurrenteMensual(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="block font-medium">Se cobrará automáticamente todos los meses</span>
              <span className="mt-0.5 block text-[12px] text-[color:var(--color-text-muted)]">
                Se repetirá el mismo día de cada mes. El monto y la próxima fecha se pueden modificar en Gastos recurrentes.
              </span>
            </span>
          </label>

          {subtotalNum > 0 && (
            <div className="space-y-1.5 rounded-md bg-[color:var(--color-surface-2)] p-4 text-small">
              <FilaResumen label="Subtotal" valor={formatearMoneda(subtotalNum, pais)} />
              {aplicaIva && (
                <FilaResumen
                  label={`${pais === "HN" ? "ISV" : "IVA"} (${(tasaImpuesto * 100).toFixed(0)}%)`}
                  valor={formatearMoneda(impuesto, pais)}
                />
              )}
              <div className="flex justify-between border-t border-[color:var(--color-border)] pt-2 text-base font-bold">
                <span>Total a pagar</span>
                <span className="text-[color:var(--color-error)]">
                  {formatearMoneda(total, pais)}
                </span>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()} disabled={enviando}>
          Cancelar
        </Button>
        <Button onClick={enviar} loading={enviando}>
          Registrar gasto
        </Button>
      </div>
    </div>
  );
}

function FilaResumen({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[color:var(--color-text-muted)]">{label}</span>
      <span className="font-medium">{valor}</span>
    </div>
  );
}
