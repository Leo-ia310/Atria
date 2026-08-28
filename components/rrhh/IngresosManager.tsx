"use client";

import { useMemo, useState } from "react";
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
import { cn, formatearFechaHora, formatearMoneda } from "@/lib/utils";
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
  const [tiposCreados, setTiposCreados] = useState<{ value: string; label: string }[]>([]);
  const [nuevoTipo, setNuevoTipo] = useState(false);
  const [nombreTipo, setNombreTipo] = useState("");
  const [guardandoTipo, setGuardandoTipo] = useState(false);
  const [vista, setVista] = useState<"registro" | "historial">("registro");
  const tipos = useMemo(() => {
    const vistos = new Map(tiposIniciales.map((tipo) => [tipo.value, tipo]));
    for (const tipo of tiposCreados) {
      if (!vistos.has(tipo.value)) vistos.set(tipo.value, tipo);
    }
    return Array.from(vistos.values());
  }, [tiposIniciales, tiposCreados]);

  async function crearTipo() {
    const nombre = nombreTipo.trim();
    if (nombre.length < 2) return mostrar("error", "Escribe el nombre del tipo");
    setGuardandoTipo(true);
    const res = await crearTipoIngreso({ nombre });
    setGuardandoTipo(false);
    if (!res.ok) return mostrar("error", res.error);
    setTiposCreados((prev) =>
      prev.some((t) => t.value === res.id) ? prev : [...prev, { value: res.id, label: res.nombre }],
    );
    setNombreTipo("");
    setNuevoTipo(false);
    mostrar("success", `Tipo "${res.nombre}" creado`);
  }

  async function quitar(id: string) {
    const res = await eliminarIngresoVariable(id);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Ingreso quitado");
    router.refresh();
  }

  const historial = empleados
    .flatMap((e) => e.registros.map((r) => ({ ...r, empleado: e.nombre })))
    .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-1 text-small">
        <button
          type="button"
          onClick={() => setVista("registro")}
          className={cn(
            "rounded px-3 py-1.5 transition",
            vista === "registro"
              ? "bg-[color:var(--color-surface)] font-medium text-[color:var(--color-text-primary)] shadow-sm"
              : "text-[color:var(--color-text-muted)]",
          )}
        >
          Registro
        </button>
        <button
          type="button"
          onClick={() => setVista("historial")}
          className={cn(
            "rounded px-3 py-1.5 transition",
            vista === "historial"
              ? "bg-[color:var(--color-surface)] font-medium text-[color:var(--color-text-primary)] shadow-sm"
              : "text-[color:var(--color-text-muted)]",
          )}
        >
          Historial ({historial.length})
        </button>
      </div>

      {vista === "registro" && (
    <Card>
      <CardHeader
        title="Ingresos por empleado"
        subtitle={
          editable
            ? "Ingresos extra mientras la nomina esta en borrador."
            : "Registro de ingresos extra de esta nomina."
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
      )}

      {vista === "historial" && (
    <Card>
      <CardHeader
        title="Historial de ingresos"
        subtitle={`${historial.length} registro${historial.length === 1 ? "" : "s"} en esta nomina`}
      />
      {historial.length === 0 ? (
        <div className="p-6 text-center text-small text-[color:var(--color-text-muted)]">
          Aun no hay ingresos registrados.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-small">
            <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
              <tr>
                <th className="text-label px-4 py-2.5 text-left font-semibold">Empleado</th>
                <th className="text-label px-4 py-2.5 text-left font-semibold">Concepto</th>
                <th className="text-label px-4 py-2.5 text-left font-semibold">Aplica a</th>
                <th className="text-label px-4 py-2.5 text-right font-semibold">Monto</th>
                <th className="text-label px-4 py-2.5 text-left font-semibold">Fecha</th>
                {editable && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {historial.map((r) => (
                <tr key={r.id} className="border-b border-[color:var(--color-border)] last:border-b-0">
                  <td className="px-4 py-2.5 font-medium">{r.empleado}</td>
                  <td className="px-4 py-2.5">{r.tipo}</td>
                  <td className="px-4 py-2.5 text-[color:var(--color-text-muted)]">
                    {SEMANAS.find((s) => s.value === r.semana)?.label ?? "Periodo"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[color:var(--color-success)]">
                    + {formatearMoneda(r.monto, pais)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[color:var(--color-text-muted)]">
                    {formatearFechaHora(r.creadoEn)}
                  </td>
                  {editable && (
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => quitar(r.id)}
                        className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-error)]"
                        aria-label="Quitar"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
      )}
    </div>
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

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="text-small font-medium">{empleado.nombre}</span>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-[color:var(--color-text-muted)]">
          <span>Devengado: {formatearMoneda(empleado.totalDevengado, pais)}</span>
          <span>Ingresos: {formatearMoneda(empleado.ingresos, pais)}</span>
          <span className="font-semibold text-[color:var(--color-text-primary)]">
            Neto: {formatearMoneda(empleado.totalNeto, pais)}
          </span>
        </div>
      </div>

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
