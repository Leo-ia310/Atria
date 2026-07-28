"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstadoEmpleado } from "@/lib/actions/rrhh";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

const ESTADOS = [
  { value: "activo", label: "Activo" },
  { value: "vacaciones", label: "En vacaciones" },
  { value: "licencia", label: "En licencia" },
  { value: "suspendido", label: "Suspendido" },
  { value: "baja", label: "Baja" },
];

type Estado = "activo" | "vacaciones" | "licencia" | "suspendido" | "baja";

export function EmpleadoEstadoControl({
  empleadoId,
  estado,
}: {
  empleadoId: string;
  estado: Estado;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [valor, setValor] = useState<Estado>(estado);
  const [pending, startTransition] = useTransition();

  function cambiar(nuevo: Estado) {
    setValor(nuevo);
    startTransition(async () => {
      const res = await cambiarEstadoEmpleado(empleadoId, nuevo);
      if (!res.ok) {
        mostrar("error", res.error);
        setValor(estado);
        return;
      }
      mostrar("success", "Estado actualizado");
      router.refresh();
    });
  }

  return (
    <div className="w-48">
      <Select
        options={ESTADOS}
        value={valor}
        disabled={pending}
        onChange={(e) => cambiar(e.target.value as Estado)}
      />
    </div>
  );
}
