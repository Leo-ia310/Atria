"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Trash2, Download } from "lucide-react";
import { crearFeriado, eliminarFeriado, sembrarFeriados } from "@/lib/actions/rrhh";
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
              <div key={f.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-small font-medium">{f.nombre}</span>
                  {f.esNacional && <Badge variant="info">Nacional</Badge>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-small text-[color:var(--color-text-muted)]">
                    {formatearFecha(f.fecha)}
                  </span>
                  <button
                    type="button"
                    onClick={() => quitar(f.id)}
                    disabled={pending}
                    className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-error)]"
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
