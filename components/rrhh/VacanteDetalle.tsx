"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Mail, Phone } from "lucide-react";
import { candidatoSchema, type CandidatoInput } from "@/lib/validations/rrhh";
import {
  crearCandidato,
  moverEtapaCandidato,
  cambiarEstadoVacante,
} from "@/lib/actions/rrhh";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatearMoneda } from "@/lib/utils";
import { CANDIDATO_ETAPA_LABEL } from "@/lib/rrhh";
import type { PaisCodigo } from "@/lib/paises";

type Candidato = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  fuente: string | null;
  expectativaSalarial: number | null;
  calificacion: number | null;
  etapa: string;
  notas: string | null;
};

const ETAPAS = [
  "aplicado",
  "preseleccion",
  "entrevista",
  "oferta",
  "contratado",
  "descartado",
] as const;
type Etapa = (typeof ETAPAS)[number];

const ETAPA_OPTS = ETAPAS.map((e) => ({ value: e, label: CANDIDATO_ETAPA_LABEL[e] }));

const ESTADOS_VACANTE = [
  { value: "abierta", label: "Abierta" },
  { value: "pausada", label: "Pausada" },
  { value: "cerrada", label: "Cerrada" },
  { value: "cancelada", label: "Cancelada" },
];

export function VacanteDetalle({
  vacanteId,
  estado,
  pais,
  candidatos,
}: {
  vacanteId: string;
  estado: string;
  pais: PaisCodigo;
  candidatos: Candidato[];
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CandidatoInput>({
    resolver: zodResolver(candidatoSchema),
    defaultValues: {
      vacanteId,
      nombres: "",
      apellidos: "",
      email: "",
      telefono: "",
      fuente: "",
      notas: "",
    },
  });

  async function onSubmit(values: CandidatoInput) {
    setEnviando(true);
    const res = await crearCandidato({ ...values, vacanteId });
    setEnviando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Candidato agregado");
    setAbierto(false);
    reset();
    router.refresh();
  }

  function mover(id: string, etapa: Etapa) {
    startTransition(async () => {
      const res = await moverEtapaCandidato(id, etapa);
      if (!res.ok) return mostrar("error", res.error);
      mostrar("success", `Movido a ${CANDIDATO_ETAPA_LABEL[etapa]}`);
      router.refresh();
    });
  }

  function calificar(id: string, etapaActual: string, calificacion: number) {
    startTransition(async () => {
      const res = await moverEtapaCandidato(id, etapaActual as Etapa, calificacion);
      if (!res.ok) return mostrar("error", res.error);
      router.refresh();
    });
  }

  function cambiarVacante(nuevo: string) {
    startTransition(async () => {
      const res = await cambiarEstadoVacante(
        vacanteId,
        nuevo as "abierta" | "pausada" | "cerrada" | "cancelada",
      );
      if (!res.ok) return mostrar("error", res.error);
      mostrar("success", "Estado de la vacante actualizado");
      router.refresh();
    });
  }

  const porEtapa = (e: Etapa) => candidatos.filter((c) => c.etapa === e);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="w-48">
          <Select
            options={ESTADOS_VACANTE}
            value={estado}
            disabled={pending}
            onChange={(e) => cambiarVacante(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="atria-btn atria-btn-primary atria-btn-sm"
        >
          <Plus size={14} /> Agregar candidato
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {ETAPAS.map((etapa) => {
          const items = porEtapa(etapa);
          return (
            <div key={etapa} className="rounded-lg bg-[color:var(--color-surface-2)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-label">{CANDIDATO_ETAPA_LABEL[etapa]}</span>
                <span className="text-[11px] text-[color:var(--color-text-muted)]">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3"
                  >
                    <div className="text-small font-medium">{c.nombre}</div>
                    {c.expectativaSalarial != null && (
                      <div className="text-[11px] text-[color:var(--color-text-muted)]">
                        {formatearMoneda(c.expectativaSalarial, pais)}
                      </div>
                    )}
                    <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-[color:var(--color-text-muted)]">
                      {c.email && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Mail size={11} /> {c.email}
                        </span>
                      )}
                      {c.telefono && (
                        <span className="inline-flex items-center gap-1">
                          <Phone size={11} /> {c.telefono}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => calificar(c.id, c.etapa, n)}
                          disabled={pending}
                          className={
                            (c.calificacion ?? 0) >= n
                              ? "text-[color:var(--color-warning)]"
                              : "text-[color:var(--color-border)] hover:text-[color:var(--color-warning)]"
                          }
                          title={`Calificar ${n}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <select
                      value={c.etapa}
                      disabled={pending}
                      onChange={(e) => mover(c.id, e.target.value as Etapa)}
                      className="atria-input mt-2 h-8 w-full text-[12px]"
                    >
                      {ETAPA_OPTS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="py-2 text-center text-[11px] text-[color:var(--color-text-muted)]">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Agregar candidato"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={enviando}>
              Agregar
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombres" error={errors.nombres?.message} {...register("nombres")} />
            <Input label="Apellidos" error={errors.apellidos?.message} {...register("apellidos")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Correo" type="email" error={errors.email?.message} {...register("email")} />
            <Input label="Teléfono" {...register("telefono")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Fuente" {...register("fuente")} placeholder="Ej. Referido, LinkedIn" />
            <Input label="Expectativa salarial" type="number" step="0.01" {...register("expectativaSalarial")} />
          </div>
          <Input label="Notas" {...register("notas")} />
        </form>
      </Modal>
    </div>
  );
}
