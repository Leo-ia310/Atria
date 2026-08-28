"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { nominaGenerarSchema, type NominaGenerarInput } from "@/lib/validations/rrhh";
import { generarNomina } from "@/lib/actions/rrhh";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const DESCRIPCION_NOMINA_FORMATTER = new Intl.DateTimeFormat("es", {
  timeZone: "America/Managua",
  month: "long",
  year: "numeric",
});

function rangoMesActual() {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { inicio: iso(inicio), fin: iso(fin) };
}

export function NominaGenerarButton() {
  const router = useRouter();
  const { mostrar } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const rango = rangoMesActual();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NominaGenerarInput>({
    resolver: zodResolver(nominaGenerarSchema),
    defaultValues: {
      descripcion: `Nómina ${DESCRIPCION_NOMINA_FORMATTER.format(new Date())}`,
      frecuencia: "mensual",
      periodoInicio: rango.inicio,
      periodoFin: rango.fin,
      fechaPago: rango.fin,
    },
  });

  async function onSubmit(values: NominaGenerarInput) {
    setEnviando(true);
    const res = await generarNomina(values);
    setEnviando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", "Nómina generada en borrador");
    setAbierto(false);
    reset();
    router.push(`/rrhh/nomina/${res.id}`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="arca-btn arca-btn-primary arca-btn-sm"
      >
        <Plus size={14} /> Generar nómina
      </button>

      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Generar nómina"
        descripcion="Calcula devengado, seguridad social y neto por empleado"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={enviando}>
              Generar
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Descripción" error={errors.descripcion?.message} {...register("descripcion")} />
          <Select
            label="Frecuencia"
            options={[
              { value: "mensual", label: "Mensual" },
              { value: "quincenal", label: "Quincenal" },
              { value: "semanal", label: "Semanal" },
            ]}
            {...register("frecuencia")}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Inicio período" type="date" error={errors.periodoInicio?.message} {...register("periodoInicio")} />
            <Input label="Fin período" type="date" error={errors.periodoFin?.message} {...register("periodoFin")} />
          </div>
          <Input label="Fecha de pago" type="date" error={errors.fechaPago?.message} {...register("fechaPago")} hint="Determina el período contable del asiento" />
        </form>
      </Modal>
    </>
  );
}
