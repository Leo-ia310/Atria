"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import {
  agregarIngresoVariable,
  eliminarIngresoVariable,
  crearTipoIngreso,
} from "@/lib/actions/rrhh";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatearFechaHora, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

const SEMANAS = [
  { value: "periodo", label: "Periodo completo" },
  { value: "semana_1", label: "Semana 1" },
  { value: "semana_2", label: "Semana 2" },
];

type Ingreso = {
  id: string;
  tipo: string;
  monto: number;
  nota: string | null;
  semana: string;
  creadoEn: string;
};
type Empleado = {
  detalleId: string;
  nombre: string;
  totalDevengado: number;
  ingresos: number;
  totalNeto: number;
  registros: Ingreso[];
};

export function IngresosManager({
  pais,
  tipos: tiposIniciales,
  empleados,
  editable = true,
}: {
  nominaId: string;
  pais: PaisCodigo;
  tipos: { value: string; label: string }[];
  empleados: Empleado[];
  editable?: boolean;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [tipos, setTipos] = useState(tiposIniciales);
  const [nuevoTipo, setNuevoTipo] = useState(false);
  const [nombreTipo, setNombreTipo] = useState("");
  const [guardandoTipo, setGuardandoTipo] = useState(false);

  async function crearTipo() {
    const nombre = nombreTipo.trim();
    if (nombre.length < 2) return mostrar("error", "Escribe el nombre del tipo");
    setGuardandoTipo(true);
    const res = await crearTipoIngreso({ nombre });
    setGuardandoTipo(false);
    if (!res.ok) return mostrar("error", res.error);
    setTipos((prev) =>
      prev.some((t) => t.value === res.id) ? prev : [...prev, { value: res.id, label: res.nombre }],
    );
    setNombreTipo("");
    setNuevoTipo(false);
    mostrar("success", `Tipo "${res.nombre}" creado`);
  }

  return (
    <Card>
      <CardHeader
        title="Ingresos por empleado"
        subtitle={
          editable
            ? "Ingresos extra mientras la nomina esta en borrador."
            : "Historial de ingresos extra registrados en esta nomina."
        }
        actions={
          editable ? (
            <Button size="sm" variant="secondary" onClick={() => setNuevoTipo(true)}>
              <Plus size={14} /> Nuevo tipo
            </Button>
          ) : null
        }
      />
      <div className="divide-y divide-[color:var(--color-border)]">
        {empleados.map((emp) => (
          <FilaEmpleado
            key={emp.detalleId}
            empleado={emp}
            pais={pais}
            tipos={tipos}
            onCambio={() => router.refresh()}
            mostrar={mostrar}
            editable={editable}
          />
        ))}
        {empleados.length === 0 && (
          <div className="p-6 text-center text-small text-[color:var(--color-text-muted)]">
            Esta nomina no tiene empleados.
          </div>
        )}
      </div>

      <Modal
        abierto={nuevoTipo}
        onCerrar={() => setNuevoTipo(false)}
        titulo="Nuevo tipo de ingreso"
        ancho="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNuevoTipo(false)} disabled={guardandoTipo}>
              Cancelar
            </Button>
            <Button onClick={crearTipo} loading={guardandoTipo}>
              Crear
            </Button>
          </>
        }
      >
        <Input
          label="Nombre"
          value={nombreTipo}
          onChange={(e) => setNombreTipo(e.target.value)}
          placeholder="Ej. Bono, comision"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              crearTipo();
            }
          }}
        />
      </Modal>
    </Card>
  );
}

function FilaEmpleado({
  empleado,
  pais,
  tipos,
  onCambio,
  mostrar,
  editable,
}: {
  empleado: Empleado;
  pais: PaisCodigo;
  tipos: { value: string; label: string }[];
  onCambio: () => void;
  mostrar: (t: "success" | "error", m: string) => void;
  editable: boolean;
}) {
  const [tipoId, setTipoId] = useState(tipos[0]?.value ?? "");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [semana, setSemana] = useState("periodo");
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    const m = parseFloat(monto);
    if (!tipoId) return mostrar("error", "Selecciona un tipo");
    if (!m || m <= 0) return mostrar("error", "Ingresa un monto valido");
    setGuardando(true);
    const res = await agregarIngresoVariable({
      nominaDetalleId: empleado.detalleId,
      tipoIngresoId: tipoId,
      monto: m,
      semana,
      nota,
    });
    setGuardando(false);
    if (!res.ok) return mostrar("error", res.error);
    setMonto("");
    setNota("");
    mostrar("success", "Ingreso agregado");
    onCambio();
  }

  async function quitar(id: string) {
    const res = await eliminarIngresoVariable(id);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Ingreso quitado");
    onCambio();
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-small font-medium">{empleado.nombre}</span>
        <div className="flex gap-4 text-[12px] text-[color:var(--color-text-muted)]">
          <span>Devengado: {formatearMoneda(empleado.totalDevengado, pais)}</span>
          <span>Ingresos: {formatearMoneda(empleado.ingresos, pais)}</span>
          <span className="font-semibold text-[color:var(--color-text-primary)]">
            Neto: {formatearMoneda(empleado.totalNeto, pais)}
          </span>
        </div>
      </div>

      {empleado.registros.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {empleado.registros.map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-surface-2)] px-2.5 py-1 text-[12px]"
              title={d.nota ?? undefined}
            >
              <span className="font-medium">{d.tipo}</span>
              <span className="text-[color:var(--color-success)]">
                + {formatearMoneda(d.monto, pais)}
              </span>
              <span className="text-[color:var(--color-text-muted)]">
                {SEMANAS.find((s) => s.value === d.semana)?.label ?? "Periodo"}
              </span>
              <span className="text-[color:var(--color-text-muted)]">
                {formatearFechaHora(d.creadoEn)}
              </span>
              {editable && (
                <button
                  type="button"
                  onClick={() => quitar(d.id)}
                  className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-error)]"
                  aria-label="Quitar"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {editable && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="w-44">
            <Select label="Tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)} options={tipos} />
          </div>
          <div className="w-36">
            <Select label="Aplicar a" value={semana} onChange={(e) => setSemana(e.target.value)} options={SEMANAS} />
          </div>
          <div className="w-32">
            <Input
              label="Monto"
              type="text"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <Input
              label="Nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Motivo / referencia"
            />
          </div>
          <Button size="md" onClick={agregar} loading={guardando} disabled={tipos.length === 0}>
            <Plus size={14} /> Agregar
          </Button>
        </div>
      )}
    </div>
  );
}
