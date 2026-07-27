"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cerrarPeriodo, reabrirPeriodo, crearPeriodo } from "@/lib/actions/periodos";

export function AccionesEstado({
  periodoId,
  estado,
}: {
  periodoId: string;
  estado: "abierto" | "cerrado";
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [cargando, setCargando] = useState(false);

  async function handleCerrar() {
    if (
      !window.confirm(
        "¿Cerrar este período?\nNo se podrán registrar asientos con fechas en este mes una vez cerrado.",
      )
    )
      return;
    setCargando(true);
    const res = await cerrarPeriodo({ periodoId });
    setCargando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", "Período cerrado");
    router.refresh();
  }

  async function handleReabrir() {
    if (!window.confirm("¿Reabrir este período? Se volverán a aceptar asientos en estas fechas."))
      return;
    setCargando(true);
    const res = await reabrirPeriodo({ periodoId });
    setCargando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", "Período reabierto");
    router.refresh();
  }

  if (estado === "abierto") {
    return (
      <Button variant="danger" size="sm" onClick={handleCerrar} loading={cargando}>
        Cerrar período
      </Button>
    );
  }
  return (
    <Button variant="secondary" size="sm" onClick={handleReabrir} loading={cargando}>
      Reabrir
    </Button>
  );
}

export function CrearProximoPeriodo({
  anio,
  mes,
  label,
}: {
  anio: number;
  mes: number;
  label: string;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [cargando, setCargando] = useState(false);

  async function handleCrear() {
    setCargando(true);
    const res = await crearPeriodo({ anio, mes });
    setCargando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", `Período ${label} creado`);
    router.refresh();
  }

  return (
    <Button onClick={handleCrear} loading={cargando}>
      Crear {label}
    </Button>
  );
}
