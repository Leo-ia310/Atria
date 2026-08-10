"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Loader2 } from "lucide-react";
import { registrarAsistencia } from "@/lib/actions/rrhh";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type Emp = {
  id: string;
  codigo: string;
  nombres: string;
  apellidos: string;
  puesto: string;
};
type Registro = {
  estado: string;
  horasTrabajadas: number;
  horasExtra: number;
  notas: string;
};

type Tono = "success" | "warning" | "danger" | "info" | "neutral";

const ESTADOS: { value: string; label: string; corto: string; tono: Tono }[] = [
  { value: "presente", label: "Presente", corto: "Presente", tono: "success" },
  { value: "tarde", label: "Tarde", corto: "Tarde", tono: "warning" },
  { value: "ausente", label: "Ausente", corto: "Ausente", tono: "danger" },
  { value: "justificado", label: "Justificado", corto: "Justif.", tono: "info" },
  { value: "permiso", label: "Permiso", corto: "Permiso", tono: "info" },
  { value: "vacaciones", label: "Vacaciones", corto: "Vacac.", tono: "info" },
  { value: "incapacidad", label: "Incapacidad", corto: "Incap.", tono: "info" },
  { value: "feriado", label: "Feriado", corto: "Feriado", tono: "neutral" },
  { value: "descanso", label: "Descanso", corto: "Descanso", tono: "neutral" },
];

const TONO_ACTIVO: Record<Tono, string> = {
  success: "border-[color:var(--color-success)] bg-[color:var(--color-success)] text-white",
  warning: "border-[color:var(--color-warning)] bg-[color:var(--color-warning)] text-white",
  danger: "border-[color:var(--color-danger)] bg-[color:var(--color-danger)] text-white",
  info: "border-[color:var(--color-secondary)] bg-[color:var(--color-secondary)] text-white",
  neutral: "border-[color:var(--color-text-muted)] bg-[color:var(--color-text-muted)] text-white",
};

function horasPorEstado(estado: string): number {
  return estado === "presente" || estado === "tarde" || estado === "justificado" ? 8 : 0;
}

export function AsistenciaTablero({
  fecha,
  feriado,
  empleados,
  registros,
}: {
  fecha: string;
  feriado: string | null;
  empleados: Emp[];
  registros: Record<string, Registro>;
}) {
  const router = useRouter();

  function cambiarFecha(nueva: string) {
    router.push(`/rrhh/asistencia?fecha=${nueva}`);
  }

  return (
    <div className="space-y-4">
      <div className="arca-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-[color:var(--color-secondary)]" />
          <input
            type="date"
            value={fecha}
            onChange={(e) => cambiarFecha(e.target.value)}
            className="arca-input w-44"
          />
        </div>
        {feriado && <Badge variant="warning">Feriado: {feriado}</Badge>}
      </div>

      <div className="arca-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-small">
            <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
              <tr>
                <th className="text-label sticky left-0 z-10 bg-[color:var(--color-surface-2)] px-4 py-3 text-left font-semibold">
                  Empleado
                </th>
                <th className="text-label px-4 py-3 text-left font-semibold">Cargo</th>
                {ESTADOS.map((e) => (
                  <th
                    key={e.value}
                    className="text-label px-2 py-3 text-center font-semibold whitespace-nowrap"
                  >
                    {e.corto}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empleados.map((emp) => (
                <FilaAsistencia
                  key={emp.id}
                  fecha={fecha}
                  empleado={emp}
                  estadoInicial={registros[emp.id]?.estado ?? (feriado ? "feriado" : "")}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[12px] text-[color:var(--color-text-muted)]">
        Marca un estado por empleado; se guarda automáticamente.
      </p>
    </div>
  );
}

function FilaAsistencia({
  fecha,
  empleado,
  estadoInicial,
}: {
  fecha: string;
  empleado: Emp;
  estadoInicial: string;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [estado, setEstado] = useState(estadoInicial);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function marcar(nuevo: string) {
    if (nuevo === estado || guardando) return;
    const previo = estado;
    setEstado(nuevo);
    setGuardando(nuevo);
    startTransition(async () => {
      const res = await registrarAsistencia({
        empleadoId: empleado.id,
        fecha,
        estado: nuevo,
        horasTrabajadas: horasPorEstado(nuevo),
        horasExtra: 0,
      });
      setGuardando(null);
      if (!res.ok) {
        setEstado(previo);
        mostrar("error", res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <tr className="border-b border-[color:var(--color-border)] last:border-b-0">
      <td className="sticky left-0 z-10 bg-[color:var(--color-surface)] px-4 py-2.5">
        <div className="font-medium">
          {empleado.nombres} {empleado.apellidos}
        </div>
        <div className="text-[11px] text-[color:var(--color-text-muted)]">
          {empleado.codigo}
        </div>
      </td>
      <td className="px-4 py-2.5 text-[color:var(--color-text-muted)]">{empleado.puesto}</td>
      {ESTADOS.map((e) => {
        const activo = estado === e.value;
        const cargando = guardando === e.value;
        return (
          <td key={e.value} className="px-2 py-2.5 text-center">
            <button
              type="button"
              role="checkbox"
              aria-checked={activo}
              aria-label={`${e.label} para ${empleado.nombres}`}
              onClick={() => marcar(e.value)}
              disabled={Boolean(guardando)}
              className={cn(
                "mx-auto flex h-5 w-5 items-center justify-center rounded-[5px] border transition disabled:opacity-60",
                activo
                  ? TONO_ACTIVO[e.tono]
                  : "border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-secondary)]",
              )}
            >
              {cargando ? (
                <Loader2 size={12} className="animate-spin" />
              ) : activo ? (
                <Check size={13} strokeWidth={3} />
              ) : null}
            </button>
          </td>
        );
      })}
    </tr>
  );
}
