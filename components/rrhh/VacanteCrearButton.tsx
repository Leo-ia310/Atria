"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
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

  const [habilidades, setHabilidades] = useState<string[]>([]);
  const [nuevaHab, setNuevaHab] = useState("");

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
      habilidades: [],
      tipoContrato: "indefinido",
      plazas: 1,
      sucursalId: "",
    },
  });

  function agregarHabilidad() {
    const h = nuevaHab.trim();
    if (!h) return;
    setHabilidades((prev) =>
      prev.some((x) => x.toLowerCase() === h.toLowerCase()) ? prev : [...prev, h],
    );
    setNuevaHab("");
  }

  function quitarHabilidad(h: string) {
    setHabilidades((prev) => prev.filter((x) => x !== h));
  }

  async function onSubmit(values: VacanteInput) {
    setEnviando(true);
    const res = await crearVacante({ ...values, habilidades });
    setEnviando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Vacante creada");
    setAbierto(false);
    reset();
    setHabilidades([]);
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Años de experiencia requeridos"
              type="number"
              min="0"
              error={errors.experienciaAnios?.message}
              {...register("experienciaAnios")}
              placeholder="Ej. 2"
            />
            <Input label="Plazas" type="number" min="1" error={errors.plazas?.message} {...register("plazas")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Salario mínimo" type="number" step="0.01" {...register("salarioMin")} />
            <Input
              label="Salario máximo"
              type="number"
              step="0.01"
              error={errors.salarioMax?.message}
              {...register("salarioMax")}
            />
          </div>

          <div>
            <label className="text-label mb-1.5 block">Habilidades requeridas</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nuevaHab}
                onChange={(e) => setNuevaHab(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    agregarHabilidad();
                  }
                }}
                placeholder="Ej. Excel, Atención al cliente…"
                className="atria-input flex-1"
              />
              <Button type="button" variant="secondary" onClick={agregarHabilidad}>
                <Plus size={16} />
              </Button>
            </div>
            {habilidades.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {habilidades.map((h) => (
                  <span
                    key={h}
                    className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-tertiary)]/15 px-2.5 py-1 text-[12px] font-medium text-[color:var(--color-primary)]"
                  >
                    {h}
                    <button
                      type="button"
                      onClick={() => quitarHabilidad(h)}
                      className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-error)]"
                      aria-label={`Quitar ${h}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
