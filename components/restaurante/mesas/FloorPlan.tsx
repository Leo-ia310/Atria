"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Maximize2, Minus, Plus, RotateCw, Save } from "lucide-react";
import { actualizarLayoutMesaRestaurante } from "@/lib/actions/restaurante-vertical";
import { Badge } from "@/components/ui/Badge";
import { cn, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

type MesaPlano = {
  id: string;
  nombre: string;
  sucursalId: string;
  areaId: string | null;
  capacidad: number;
  posX: string;
  posY: string;
  ancho: string;
  alto: string;
  rotacion: string;
  forma: string;
  estado: string;
  estadoOverrideManual: boolean;
  estadoOverrideMotivo: string | null;
  estadoDerivado: string;
  ordenActiva?: {
    id: string;
    numero: string;
    estado: string;
    personas: number;
    total: string;
    abiertoEn: Date;
    mesero: string | null;
  };
};

type AreaPlano = {
  id: string;
  nombre: string;
  sucursalId: string;
};

type Props = {
  mesas: MesaPlano[];
  areas: AreaPlano[];
  puedeEditar: boolean;
  puedeAbrirOrden: boolean;
  pais: PaisCodigo;
  crearMesaAction: (formData: FormData) => void | Promise<void>;
  crearOrdenAction: (formData: FormData) => void | Promise<void>;
  solicitarCuentaAction: (formData: FormData) => void | Promise<void>;
};

export function FloorPlan({
  mesas,
  areas,
  puedeEditar,
  puedeAbrirOrden,
  pais,
  crearMesaAction,
  crearOrdenAction,
  solicitarCuentaAction,
}: Props) {
  const [modoEdicion, setModoEdicion] = useState(false);
  const [mesaSeleccionadaId, setMesaSeleccionadaId] = useState(mesas[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Record<string, Partial<MesaPlano>>>({});
  const [isPending, startTransition] = useTransition();
  const mesaSeleccionada = useMemo(
    () => mesas.find((mesa) => mesa.id === mesaSeleccionadaId) ?? mesas[0],
    [mesaSeleccionadaId, mesas],
  );

  function mesaConDraft(mesa: MesaPlano): MesaPlano {
    return { ...mesa, ...drafts[mesa.id] };
  }

  function moverMesa(mesa: MesaPlano, clientX: number, clientY: number, rect: DOMRect) {
    const ancho = Number(mesaConDraft(mesa).ancho);
    const alto = Number(mesaConDraft(mesa).alto);
    const x = Math.min(1 - ancho / 2, Math.max(ancho / 2, (clientX - rect.left) / rect.width));
    const y = Math.min(1 - alto / 2, Math.max(alto / 2, (clientY - rect.top) / rect.height));
    setDrafts((actual) => ({
      ...actual,
      [mesa.id]: { ...actual[mesa.id], posX: x.toFixed(4), posY: y.toFixed(4) },
    }));
  }

  function guardarMesa(mesa: MesaPlano) {
    const actual = mesaConDraft(mesa);
    const formData = new FormData();
    formData.set("mesaId", actual.id);
    formData.set("areaId", actual.areaId ?? "");
    formData.set("posX", actual.posX);
    formData.set("posY", actual.posY);
    formData.set("ancho", actual.ancho);
    formData.set("alto", actual.alto);
    formData.set("rotacion", actual.rotacion);
    formData.set("forma", actual.forma);
    formData.set("capacidad", String(actual.capacidad));
    startTransition(async () => {
      const resultado = await actualizarLayoutMesaRestaurante(formData);
      if (resultado.ok) {
        setDrafts((actualDrafts) => {
          const siguiente = { ...actualDrafts };
          delete siguiente[mesa.id];
          return siguiente;
        });
      }
    });
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-border)] px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Plano del salon</h2>
            <p className="text-[12px] text-[color:var(--color-text-muted)]">
              {modoEdicion ? "Edita el salon sin crear otro sistema de mesas." : "Toca una mesa para ver la atencion activa."}
            </p>
          </div>
          {puedeEditar && (
            <button
              type="button"
              className={modoEdicion ? "arca-btn arca-btn-primary arca-btn-sm" : "arca-btn arca-btn-secondary arca-btn-sm"}
              onClick={() => setModoEdicion((valor) => !valor)}
            >
              <Maximize2 size={14} /> {modoEdicion ? "Operacion" : "Editar plano"}
            </button>
          )}
        </div>

        <div
          className="relative min-h-[560px] touch-none overflow-hidden bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:40px_40px]"
          onPointerMove={(event) => {
            if (!modoEdicion || !mesaSeleccionadaId || event.buttons !== 1) return;
            const mesa = mesas.find((row) => row.id === mesaSeleccionadaId);
            if (!mesa) return;
            moverMesa(mesa, event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
          }}
          onPointerUp={() => {
            const mesa = mesas.find((row) => row.id === mesaSeleccionadaId);
            if (mesa && drafts[mesa.id]) guardarMesa(mesa);
          }}
        >
          {areas.map((area, index) => (
            <div
              key={area.id}
              className="absolute rounded-md border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-2)]/45 px-3 py-2 text-[12px] font-medium text-[color:var(--color-text-muted)]"
              style={{
                left: `${4 + (index % 3) * 31}%`,
                top: `${4 + Math.floor(index / 3) * 28}%`,
                width: "28%",
                height: "23%",
              }}
            >
              {area.nombre}
            </div>
          ))}

          {mesas.map((mesaBase) => {
            const mesa = mesaConDraft(mesaBase);
            const seleccionada = mesa.id === mesaSeleccionadaId;
            return (
              <button
                key={mesa.id}
                type="button"
                onPointerDown={(event) => {
                  setMesaSeleccionadaId(mesa.id);
                  if (modoEdicion) event.currentTarget.setPointerCapture(event.pointerId);
                }}
                className={cn(
                  "absolute flex touch-none flex-col items-center justify-center border text-center text-[12px] font-semibold shadow-sm transition",
                  mesa.forma === "redonda" ? "rounded-full" : "rounded-md",
                  estadoMesaClase(mesa.estadoDerivado),
                  seleccionada && "ring-2 ring-[color:var(--color-primary)]",
                )}
                style={{
                  left: `${Number(mesa.posX) * 100}%`,
                  top: `${Number(mesa.posY) * 100}%`,
                  width: `${Number(mesa.ancho) * 100}%`,
                  height: `${Number(mesa.alto) * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${Number(mesa.rotacion)}deg)`,
                }}
              >
                <span>{mesa.nombre}</span>
                <span className="text-[10px] font-medium">{mesa.capacidad} pax</span>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="space-y-4">
        {mesaSeleccionada && (
          <MesaDetalle
            mesa={mesaConDraft(mesaSeleccionada)}
            modoEdicion={modoEdicion}
            puedeEditar={puedeEditar}
            puedeAbrirOrden={puedeAbrirOrden}
            pais={pais}
            onChange={(patch) =>
              setDrafts((actual) => ({
                ...actual,
                [mesaSeleccionada.id]: { ...actual[mesaSeleccionada.id], ...patch },
              }))
            }
            onSave={() => guardarMesa(mesaSeleccionada)}
            pending={isPending}
            crearOrdenAction={crearOrdenAction}
            solicitarCuentaAction={solicitarCuentaAction}
          />
        )}
        {puedeEditar && (
          <form action={crearMesaAction} className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-semibold">Agregar mesa</h3>
              <Plus size={15} />
            </div>
            <input type="hidden" name="sucursalId" value={areas[0]?.sucursalId ?? mesas[0]?.sucursalId ?? ""} />
            <input type="hidden" name="areaId" value={areas[0]?.id ?? ""} />
            <input type="hidden" name="posX" value="0.5" />
            <input type="hidden" name="posY" value="0.5" />
            <input name="nombre" aria-label="Nombre o numero de mesa" placeholder="Nombre o numero" className="arca-input mb-2" />
            <div className="grid grid-cols-2 gap-2">
              <input name="capacidad" defaultValue="4" aria-label="Capacidad de la mesa" className="arca-input" />
              <select name="forma" defaultValue="rectangular" aria-label="Forma de la mesa" className="arca-input">
                <option value="rectangular">Rectangular</option>
                <option value="redonda">Redonda</option>
                <option value="cuadrada">Cuadrada</option>
              </select>
            </div>
            <button type="submit" className="arca-btn arca-btn-primary mt-3 w-full justify-center">
              <Plus size={14} /> Nueva mesa
            </button>
          </form>
        )}
      </aside>
    </section>
  );
}

function MesaDetalle({
  mesa,
  modoEdicion,
  puedeEditar,
  puedeAbrirOrden,
  pais,
  onChange,
  onSave,
  pending,
  crearOrdenAction,
  solicitarCuentaAction,
}: {
  mesa: MesaPlano;
  modoEdicion: boolean;
  puedeEditar: boolean;
  puedeAbrirOrden: boolean;
  pais: PaisCodigo;
  onChange: (patch: Partial<MesaPlano>) => void;
  onSave: () => void;
  pending: boolean;
  crearOrdenAction: (formData: FormData) => void | Promise<void>;
  solicitarCuentaAction: (formData: FormData) => void | Promise<void>;
}) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const disponible = mesa.estadoDerivado === "disponible" && !mesa.ordenActiva;
  return (
    <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{mesa.nombre}</h3>
          <p className="text-[12px] text-[color:var(--color-text-muted)]">{mesa.capacidad} personas</p>
        </div>
        <Badge variant={estadoMesaVariant(mesa.estadoDerivado)}>{labelEstadoMesa(mesa.estadoDerivado)}</Badge>
      </div>

      {mesa.ordenActiva ? (
        <div className="mt-4 space-y-3 rounded-md bg-[color:var(--color-surface-2)] p-3 text-small">
          <div className="flex justify-between gap-3">
            <span>Orden</span>
            <strong>{mesa.ordenActiva.numero}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span>Personas</span>
            <strong>{mesa.ordenActiva.personas}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span>Mesero</span>
            <strong>{mesa.ordenActiva.mesero ?? "Sin asignar"}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span>Total</span>
            <strong>{formatearMoneda(mesa.ordenActiva.total, pais)}</strong>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Link href={`/restaurante/pos?ordenId=${mesa.ordenActiva.id}`} className="arca-btn arca-btn-primary arca-btn-sm justify-center">
              Ir al POS
            </Link>
            <form action={solicitarCuentaAction}>
              <input type="hidden" name="ordenId" value={mesa.ordenActiva.id} />
              <button type="submit" className="arca-btn arca-btn-secondary arca-btn-sm w-full justify-center">
                Cuenta
              </button>
            </form>
          </div>
        </div>
      ) : (
        <form action={crearOrdenAction} className="mt-4">
          <input type="hidden" name="redirectTo" value="/restaurante/mesas" />
          <input type="hidden" name="sucursalId" value={mesa.sucursalId} />
          <input type="hidden" name="mesaId" value={mesa.id} />
          <input type="hidden" name="canal" value="salon" />
          <input type="hidden" name="personas" value={mesa.capacidad} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <button
            type="submit"
            disabled={!puedeAbrirOrden || !disponible}
            className="arca-btn arca-btn-primary w-full justify-center"
          >
            Abrir orden
          </button>
        </form>
      )}

      {mesa.estadoOverrideManual && (
        <div className="mt-3 rounded-md border border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/10 px-3 py-2 text-[12px] text-[color:var(--color-warning)]">
          Override manual: {mesa.estadoOverrideMotivo ?? "Ajuste manual"}
        </div>
      )}

      {modoEdicion && puedeEditar && (
        <div className="mt-4 space-y-3 border-t border-[color:var(--color-border)] pt-4">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={mesa.forma}
              onChange={(event) => onChange({ forma: event.target.value })}
              aria-label="Forma de la mesa seleccionada"
              className="arca-input"
            >
              <option value="rectangular">Rectangular</option>
              <option value="redonda">Redonda</option>
              <option value="cuadrada">Cuadrada</option>
            </select>
            <input
              value={mesa.capacidad}
              onChange={(event) => onChange({ capacidad: enteroEnRango(event.target.value, 1, 50, mesa.capacidad) })}
              aria-label="Capacidad de la mesa seleccionada"
              className="arca-input"
              type="number"
              min="1"
              max="50"
            />
          </div>
          <Control label="Ancho" value={Number(mesa.ancho)} onChange={(value) => onChange({ ancho: value.toFixed(4) })} />
          <Control label="Alto" value={Number(mesa.alto)} onChange={(value) => onChange({ alto: value.toFixed(4) })} />
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => onChange({ rotacion: String(Number(mesa.rotacion) - 15) })} className="arca-btn arca-btn-secondary arca-btn-sm justify-center">
              <RotateCw size={14} /> -15
            </button>
            <button type="button" onClick={() => onChange({ rotacion: "0" })} className="arca-btn arca-btn-secondary arca-btn-sm justify-center">
              0
            </button>
            <button type="button" onClick={() => onChange({ rotacion: String(Number(mesa.rotacion) + 15) })} className="arca-btn arca-btn-secondary arca-btn-sm justify-center">
              <RotateCw size={14} /> +15
            </button>
          </div>
          <button type="button" onClick={onSave} disabled={pending} className="arca-btn arca-btn-primary w-full justify-center">
            <Save size={14} /> Guardar plano
          </button>
        </div>
      )}
    </div>
  );
}

function Control({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const controlId = `mesa-control-${label.toLowerCase()}`;
  return (
    <div className="block">
      <span id={controlId} className="text-label">{label}</span>
      <div className="mt-1 grid grid-cols-[34px_minmax(0,1fr)_34px] gap-2">
        <button
          type="button"
          aria-label={`Reducir ${label.toLowerCase()}`}
          className="arca-btn arca-btn-secondary arca-btn-sm justify-center"
          onClick={() => onChange(Math.max(0.06, value - 0.02))}
        >
          <Minus size={13} />
        </button>
        <input
          type="range"
          min="0.06"
          max="0.6"
          step="0.01"
          value={value}
          aria-labelledby={controlId}
          onChange={(event) => onChange(numeroEnRango(event.target.value, 0.06, 0.6, value))}
        />
        <button
          type="button"
          aria-label={`Aumentar ${label.toLowerCase()}`}
          className="arca-btn arca-btn-secondary arca-btn-sm justify-center"
          onClick={() => onChange(Math.min(0.6, value + 0.02))}
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

function numeroEnRango(valor: string, min: number, max: number, fallback: number): number {
  const parsed = Number(valor);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function enteroEnRango(valor: string, min: number, max: number, fallback: number): number {
  return Math.round(numeroEnRango(valor, min, max, fallback));
}

function labelEstadoMesa(estado: string): string {
  const labels: Record<string, string> = {
    disponible: "Disponible",
    ocupada: "Ocupada",
    en_cocina: "En cocina",
    cuenta_solicitada: "Cuenta solicitada",
    reservada: "Reservada",
    por_limpiar: "Limpieza",
    deshabilitada: "Deshabilitada",
  };
  return labels[estado] ?? estado;
}

function estadoMesaVariant(estado: string): "success" | "warning" | "error" | "info" | "neutral" {
  if (estado === "disponible") return "success";
  if (estado === "por_limpiar") return "error";
  if (estado === "en_cocina" || estado === "cuenta_solicitada") return "info";
  if (estado === "ocupada" || estado === "reservada") return "warning";
  return "neutral";
}

function estadoMesaClase(estado: string): string {
  if (estado === "disponible") return "border-[color:var(--color-success)] bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]";
  if (estado === "por_limpiar") return "border-[color:var(--color-error)] bg-[color:var(--color-error-bg)] text-[color:var(--color-error)]";
  if (estado === "en_cocina" || estado === "cuenta_solicitada") return "border-[color:var(--color-info)] bg-[color:var(--color-info-bg)] text-[color:var(--color-info)]";
  if (estado === "ocupada" || estado === "reservada") return "border-[color:var(--color-warning)] bg-[color:var(--color-warning-bg)] text-[color:var(--color-warning)]";
  return "border-[color:var(--color-border)] bg-[color:var(--color-surface)]";
}
