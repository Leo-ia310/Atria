"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Trash2, Download, Pencil, Check, X } from "lucide-react";
import {
  crearFeriado,
  actualizarFeriado,
  eliminarFeriado,
  sembrarFeriados,
} from "@/lib/actions/rrhh";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { formatearFecha } from "@/lib/utils";
import { CalendarClock } from "lucide-react";

type Feriado = { id: string; nombre: string; fecha: string; esNacional: boolean };

export function FeriadosManager({
  anio,
  feriados,
}: {
  anio: number;
  feriados: Feriado[];
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState(`${anio}-01-01`);
  const [pending, startTransition] = useTransition();

  function agregar() {
    if (nombre.trim().length < 2) return mostrar("error", "Escribe el nombre del feriado");
    startTransition(async () => {
      const res = await crearFeriado({ nombre, fecha, esNacional: true, esRecurrente: true });
      if (!res.ok) return mostrar("error", res.error);
      mostrar("success", "Feriado agregado");
      setNombre("");
      router.refresh();
    });
  }

  function sembrar() {
    startTransition(async () => {
      const res = await sembrarFeriados(anio);
      if (!res.ok) return mostrar("error", res.error);
      mostrar("success", `Feriados nacionales ${anio} cargados`);
      router.refresh();
    });
  }

  function quitar(id: string) {
    startTransition(async () => {
      const res = await eliminarFeriado(id);
      if (!res.ok) return mostrar("error", res.error);
      mostrar("success", "Feriado eliminado");
      router.refresh();
    });
  }

  function editar(id: string, nombre: string, fecha: string, onListo: () => void) {
    if (nombre.trim().length < 2) return mostrar("error", "Escribe el nombre del feriado");
    startTransition(async () => {
      const res = await actualizarFeriado(id, { nombre, fecha });
      if (!res.ok) return mostrar("error", res.error);
      mostrar("success", "Feriado actualizado");
      onListo();
      router.refresh();
    });
  }

  function cambiarAnio(delta: number) {
    router.push(`/rrhh/feriados?anio=${anio + delta}`);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <CalendarClock size={16} /> Año {anio}
            </span>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => cambiarAnio(-1)}>
                ← {anio - 1}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => cambiarAnio(1)}>
                {anio + 1} →
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <Input
                label="Nombre del feriado"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Semana Santa"
              />
            </div>
            <div className="w-44">
              <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <Button size="md" onClick={agregar} disabled={pending}>
              <CalendarPlus size={14} /> Agregar
            </Button>
          </div>
          <div>
            <Button variant="secondary" size="sm" onClick={sembrar} disabled={pending}>
              <Download size={14} /> Cargar feriados nacionales {anio}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`${feriados.length} feriados en ${anio}`} />
        {feriados.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={CalendarClock}
              titulo="Sin feriados cargados"
              descripcion="Carga el calendario nacional o agrega feriados manualmente."
            />
          </CardBody>
        ) : (
          <div className="divide-y divide-[color:var(--color-border)]">
            {feriados.map((f) => (
              <FilaFeriado
                key={f.id}
                feriado={f}
                pending={pending}
                onGuardar={editar}
                onEliminar={quitar}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function FilaFeriado({
  feriado,
  pending,
  onGuardar,
  onEliminar,
}: {
  feriado: Feriado;
  pending: boolean;
  onGuardar: (id: string, nombre: string, fecha: string, onListo: () => void) => void;
  onEliminar: (id: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(feriado.nombre);
  const [fecha, setFecha] = useState(feriado.fecha);

  if (editando) {
    return (
      <div className="flex flex-wrap items-end gap-3 px-5 py-3">
        <div className="flex-1 min-w-[160px]">
          <Input
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Input
            label="Fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={() => onGuardar(feriado.id, nombre, fecha, () => setEditando(false))}
            disabled={pending}
          >
            <Check size={14} /> Guardar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setNombre(feriado.nombre);
              setFecha(feriado.fecha);
              setEditando(false);
            }}
            disabled={pending}
          >
            <X size={14} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="text-small font-medium">{feriado.nombre}</span>
        {feriado.esNacional && <Badge variant="info">Nacional</Badge>}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-small text-[color:var(--color-text-muted)]">
          {formatearFecha(feriado.fecha)}
        </span>
        <button
          type="button"
          onClick={() => setEditando(true)}
          disabled={pending}
          className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-secondary)]"
          title="Editar"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          onClick={() => onEliminar(feriado.id)}
          disabled={pending}
          className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-error)]"
          title="Eliminar"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
