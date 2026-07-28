"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { vacanteSchema, type VacanteInput } from "@/lib/validations/rrhh";
import { crearVacante } from "@/lib/actions/rrhh";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const CONTRATOS = [
  { value: "indefinido", label: "Indefinido" },
  { value: "temporal", label: "Temporal" },
  { value: "por_obra", label: "Por obra" },
  { value: "medio_tiempo", label: "Medio tiempo" },
  { value: "practicante", label: "Practicante" },
  { value: "servicios", label: "Servicios profesionales" },
];

export function VacanteCrearButton({
  sucursales,
}: {
  sucursales: { value: string; label: string }[];
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VacanteInput>({
    resolver: zodResolver(vacanteSchema),
    defaultValues: {
      titulo: "",
      departamento: "",
      descripcion: "",
      requisitos: "",
      tipoContrato: "indefinido",
      plazas: 1,
      sucursalId: "",
    },
  });

  async function onSubmit(values: VacanteInput) {
    setEnviando(true);
    const res = await crearVacante(values);
    setEnviando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Vacante creada");
    setAbierto(false);
    reset();
    router.push(`/rrhh/reclutamiento/${res.id}`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="atria-btn atria-btn-primary atria-btn-sm"
      >
        <Plus size={14} /> Nueva vacante
      </button>

      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Nueva vacante"
        ancho="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={enviando}>
              Publicar
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Título del puesto" error={errors.titulo?.message} {...register("titulo")} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Departamento / Área" {...register("departamento")} />
            <Select label="Tipo de contrato" options={CONTRATOS} {...register("tipoContrato")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Salario mínimo" type="number" step="0.01" {...register("salarioMin")} />
            <Input label="Salario máximo" type="number" step="0.01" {...register("salarioMax")} />
            <Input label="Plazas" type="number" {...register("plazas")} />
          </div>
          {sucursales.length > 0 && (
            <Select
              label="Sucursal"
              options={[{ value: "", label: "Sin asignar" }, ...sucursales]}
              {...register("sucursalId")}
            />
          )}
          <Input label="Descripción" {...register("descripcion")} />
          <Input label="Requisitos" {...register("requisitos")} />
        </form>
      </Modal>
    </>
  );
}
