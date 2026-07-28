"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Check, X, Inbox } from "lucide-react";
import { solicitudSchema, type SolicitudInput } from "@/lib/validations/rrhh";
import { crearSolicitud, resolverSolicitud } from "@/lib/actions/rrhh";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { formatearMoneda } from "@/lib/utils";
import { SOLICITUD_TIPO_LABEL, SOLICITUD_ESTADO_LABEL } from "@/lib/rrhh";
import type { PaisCodigo } from "@/lib/paises";

type Solicitud = {
  id: string;
  tipo: string;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  dias: number;
  monto: number | null;
  motivo: string;
  comentarioResolucion: string | null;
  empleado: string;
};

const TIPOS = [
  { value: "vacaciones", label: "Vacaciones" },
  { value: "permiso", label: "Permiso" },
  { value: "incapacidad", label: "Incapacidad" },
  { value: "adelanto", label: "Adelanto de salario" },
  { value: "constancia", label: "Constancia laboral" },
  { value: "otro", label: "Otro" },
];

const VARIANTE: Record<string, "success" | "warning" | "neutral" | "error"> = {
  pendiente: "warning",
  aprobada: "success",
  rechazada: "error",
  cancelada: "neutral",
};

export function SolicitudesPanel({
  pais,
  solicitudes,
  empleados,
}: {
  pais: PaisCodigo;
  solicitudes: Solicitud[];
  empleados: { value: string; label: string }[];
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
    watch,
    formState: { errors },
  } = useForm<SolicitudInput>({
    resolver: zodResolver(solicitudSchema),
    defaultValues: {
      empleadoId: empleados[0]?.value ?? "",
      tipo: "vacaciones",
      fechaInicio: "",
      fechaFin: "",
      motivo: "",
    },
  });
  const tipo = watch("tipo");

  async function onSubmit(values: SolicitudInput) {
    setEnviando(true);
    const res = await crearSolicitud(values);
    setEnviando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Solicitud registrada");
    setAbierto(false);
    reset();
    router.refresh();
  }

  function resolver(id: string, aprobar: boolean) {
    startTransition(async () => {
      const res = await resolverSolicitud(id, aprobar);
      if (!res.ok) return mostrar("error", res.error);
      mostrar("success", aprobar ? "Solicitud aprobada" : "Solicitud rechazada");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          disabled={empleados.length === 0}
          className="atria-btn atria-btn-primary atria-btn-sm"
        >
          <Plus size={14} /> Nueva solicitud
        </button>
      </div>

      {solicitudes.length === 0 ? (
        <div className="atria-card p-8">
          <EmptyState
            icon={Inbox}
            titulo="No hay solicitudes"
            descripcion="Registra permisos, vacaciones, incapacidades o adelantos de salario."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {solicitudes.map((s) => (
            <div key={s.id} className="atria-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.empleado || "Empleado"}</span>
                    <Badge variant="neutral">{SOLICITUD_TIPO_LABEL[s.tipo] ?? s.tipo}</Badge>
                    <Badge variant={VARIANTE[s.estado] ?? "neutral"}>
                      {SOLICITUD_ESTADO_LABEL[s.estado] ?? s.estado}
                    </Badge>
                  </div>
                  <p className="mt-1 text-small text-[color:var(--color-text-muted)]">{s.motivo}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-[12px] text-[color:var(--color-text-muted)]">
                    {s.fechaInicio && (
                      <span>
                        {s.fechaInicio}
                        {s.fechaFin && s.fechaFin !== s.fechaInicio ? ` → ${s.fechaFin}` : ""} · {s.dias} día(s)
                      </span>
                    )}
                    {s.monto != null && <span>Monto: {formatearMoneda(s.monto, pais)}</span>}
                    {s.comentarioResolucion && <span>Nota: {s.comentarioResolucion}</span>}
                  </div>
                </div>
                {s.estado === "pendiente" && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => resolver(s.id, false)} disabled={pending}>
                      <X size={14} /> Rechazar
                    </Button>
                    <Button size="sm" onClick={() => resolver(s.id, true)} disabled={pending}>
                      <Check size={14} /> Aprobar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Nueva solicitud"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={enviando}>
              Registrar
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select label="Empleado" options={empleados} {...register("empleadoId")} error={errors.empleadoId?.message} />
          <Select label="Tipo" options={TIPOS} {...register("tipo")} />
          {tipo === "adelanto" ? (
            <Input label="Monto solicitado" type="number" step="0.01" error={errors.monto?.message} {...register("monto")} />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Desde" type="date" {...register("fechaInicio")} />
              <Input label="Hasta" type="date" {...register("fechaFin")} />
            </div>
          )}
          <Input label="Motivo" error={errors.motivo?.message} {...register("motivo")} />
        </form>
      </Modal>
    </div>
  );
}
