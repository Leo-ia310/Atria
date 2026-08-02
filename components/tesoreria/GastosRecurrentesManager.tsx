"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { actualizarGastoRecurrente } from "@/lib/actions/tesoreria";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

export type GastoRecurrenteFila = {
  id: string;
  descripcion: string;
  referencia: string | null;
  categoriaId: string;
  categoria: string;
  cuentaFinancieraId: string;
  cuenta: string;
  subtotal: number;
  impuesto: number;
  diaMes: number;
  proximaFecha: string;
  activa: boolean;
  ultimoGeneradoEn: string | null;
};

type Opcion = { value: string; label: string };

export function GastosRecurrentesManager({
  pais,
  filas,
  categorias,
  cuentas,
}: {
  pais: PaisCodigo;
  filas: GastoRecurrenteFila[];
  categorias: Opcion[];
  cuentas: Opcion[];
}) {
  const [editando, setEditando] = useState<GastoRecurrenteFila | null>(null);

  if (filas.length === 0) {
    return (
      <div className="rounded-md border border-[color:var(--color-border)] p-8 text-center text-small text-[color:var(--color-text-muted)]">
        Todavía no hay gastos mensuales. Activa la opción al registrar un gasto para crear el primero.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border border-[color:var(--color-border)]">
        <table className="w-full text-small">
          <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
            <tr>
              <th className="px-4 py-3 text-left">Gasto</th>
              <th className="px-4 py-3 text-left">Cuenta</th>
              <th className="px-4 py-3 text-right">Monto actual</th>
              <th className="px-4 py-3 text-left">Próximo cobro</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="w-12 px-4 py-3"><span className="sr-only">Editar</span></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.id} className="border-b border-[color:var(--color-border)] last:border-b-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{fila.descripcion}</div>
                  <div className="text-[11px] text-[color:var(--color-text-muted)]">
                    {fila.categoria}{fila.referencia ? ` · ${fila.referencia}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">{fila.cuenta}</td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatearMoneda(fila.subtotal + fila.impuesto, pais)}
                </td>
                <td className="px-4 py-3">
                  <div>{formatearFecha(fila.proximaFecha)}</div>
                  <div className="text-[11px] text-[color:var(--color-text-muted)]">
                    Día {fila.diaMes}
                    {fila.ultimoGeneradoEn ? ` · último ${formatearFechaHora(fila.ultimoGeneradoEn)}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={fila.activa ? "success" : "neutral"}>
                    {fila.activa ? "Automático" : "Pausado"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditando(fila)}
                    className="rounded-md p-2 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-surface-2)]"
                    title="Modificar gasto recurrente"
                  >
                    <Pencil size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && (
        <EditarRecurrente
          key={editando.id}
          fila={editando}
          categorias={categorias}
          cuentas={cuentas}
          onCerrar={() => setEditando(null)}
        />
      )}
    </>
  );
}

function EditarRecurrente({
  fila,
  categorias,
  cuentas,
  onCerrar,
}: {
  fila: GastoRecurrenteFila;
  categorias: Opcion[];
  cuentas: Opcion[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [guardando, setGuardando] = useState(false);
  const [descripcion, setDescripcion] = useState(fila.descripcion);
  const [referencia, setReferencia] = useState(fila.referencia ?? "");
  const [categoriaId, setCategoriaId] = useState(fila.categoriaId);
  const [cuentaFinancieraId, setCuentaFinancieraId] = useState(fila.cuentaFinancieraId);
  const [subtotal, setSubtotal] = useState(String(fila.subtotal));
  const [impuesto, setImpuesto] = useState(String(fila.impuesto));
  const [diaMes, setDiaMes] = useState(String(fila.diaMes));
  const [proximaFecha, setProximaFecha] = useState(fila.proximaFecha);
  const [activa, setActiva] = useState(fila.activa);

  async function guardar() {
    setGuardando(true);
    const res = await actualizarGastoRecurrente({
      id: fila.id,
      categoriaId,
      cuentaFinancieraId,
      descripcion: descripcion.trim(),
      referencia: referencia.trim(),
      subtotal: Number(subtotal),
      impuesto: Number(impuesto),
      diaMes: Number(diaMes),
      proximaFecha,
      activa,
    });
    setGuardando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Gasto recurrente actualizado");
    onCerrar();
    router.refresh();
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Modificar gasto mensual"
      descripcion="Los cambios se aplican a los próximos cobros; el historial anterior no cambia."
      ancho="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} loading={guardando}>Guardar cambios</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <Input label="Referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Categoría" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} options={categorias} />
          <Select label="Pagar con" value={cuentaFinancieraId} onChange={(e) => setCuentaFinancieraId(e.target.value)} options={cuentas} />
          <Input label="Subtotal" type="number" min="0.01" step="0.01" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
          <Input label="Impuesto" type="number" min="0" step="0.01" value={impuesto} onChange={(e) => setImpuesto(e.target.value)} />
          <Input label="Día de cada mes" type="number" min="1" max="31" value={diaMes} onChange={(e) => setDiaMes(e.target.value)} />
          <Input label="Próxima fecha" type="date" value={proximaFecha} onChange={(e) => setProximaFecha(e.target.value)} />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-small">
          <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} className="h-4 w-4" />
          Cobro mensual activo
        </label>
      </div>
    </Modal>
  );
}
