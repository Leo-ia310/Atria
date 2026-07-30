"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check } from "lucide-react";
import { registrarAsistencia } from "@/lib/actions/rrhh";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

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

const ESTADOS = [
  { value: "presente", label: "Presente" },
  { value: "tarde", label: "Tarde" },
  { value: "ausente", label: "Ausente" },
  { value: "justificado", label: "Justificado" },
  { value: "permiso", label: "Permiso" },
  { value: "vacaciones", label: "Vacaciones" },
  { value: "incapacidad", label: "Incapacidad" },
  { value: "feriado", label: "Feriado" },
  { value: "descanso", label: "Descanso" },
];

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
        {feriado && (
          <Badge variant="warning">Feriado: {feriado}</Badge>
        )}
      </div>

      <div className="arca-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
              <tr>
                <th className="text-label px-4 py-3 text-left font-semibold">Empleado</th>
                <th className="text-label px-4 py-3 text-left font-semibold">Estado</th>
                <th className="text-label px-4 py-3 text-right font-semibold">Horas</th>
                <th className="text-label px-4 py-3 text-right font-semibold">Extra</th>
                <th className="text-label px-4 py-3 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {empleados.map((emp) => (
                <FilaAsistencia
                  key={emp.id}
                  fecha={fecha}
                  empleado={emp}
                  inicial={
                    registros[emp.id] ?? {
                      estado: feriado ? "feriado" : "presente",
                      horasTrabajadas: feriado ? 0 : 8,
                      horasExtra: 0,
                      notas: "",
                    }
                  }
                  guardado={Boolean(registros[emp.id])}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilaAsistencia({
  fecha,
  empleado,
  inicial,
  guardado,
}: {
  fecha: string;
  empleado: Emp;
  inicial: Registro;
  guardado: boolean;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [estado, setEstado] = useState(inicial.estado);
  const [horas, setHoras] = useState(String(inicial.horasTrabajadas));
  const [extra, setExtra] = useState(String(inicial.horasExtra));
  const [yaGuardado, setYaGuardado] = useState(guardado);
  const [pending, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      const res = await registrarAsistencia({
        empleadoId: empleado.id,
        fecha,
        estado,
        horasTrabajadas: Number(horas) || 0,
        horasExtra: Number(extra) || 0,
      });
      if (!res.ok) {
        mostrar("error", res.error);
        return;
      }
      setYaGuardado(true);
      mostrar("success", `${empleado.nombres}: asistencia guardada`);
      router.refresh();
    });
  }

  return (
    <tr className="border-b border-[color:var(--color-border)] last:border-b-0">
      <td className="px-4 py-2">
        <div className="font-medium">
          {empleado.nombres} {empleado.apellidos}
        </div>
        <div className="text-[11px] text-[color:var(--color-text-muted)]">{empleado.puesto}</div>
      </td>
      <td className="px-4 py-2">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="arca-input w-40"
        >
          {ESTADOS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2 text-right">
        <input
          type="number"
          step="0.5"
          value={horas}
          onChange={(e) => setHoras(e.target.value)}
          className="arca-input w-20 text-right"
        />
      </td>
      <td className="px-4 py-2 text-right">
        <input
          type="number"
          step="0.5"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          className="arca-input w-20 text-right"
        />
      </td>
      <td className="px-4 py-2 text-right">
        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="arca-btn arca-btn-secondary arca-btn-sm"
        >
          {yaGuardado ? <Check size={14} /> : null}
          {yaGuardado ? "Actualizar" : "Guardar"}
        </button>
      </td>
    </tr>
  );
}
