"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import {
  secuenciaFiscalSchema,
  type SecuenciaFiscalInput,
} from "@/lib/validations/configuracion";
import { crearSecuenciaFiscal } from "@/lib/actions/configuracion";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function CrearSecuenciaForm({ idFiscalNombre }: { idFiscalNombre: string }) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SecuenciaFiscalInput>({
    resolver: zodResolver(secuenciaFiscalSchema),
    defaultValues: {
      tipoNombre: "Factura",
      tipoCodigo: "FAC",
      prefijo: "",
      autorizacion: "",
      rangoInicial: undefined,
      rangoFinal: undefined,
      fechaLimite: "",
    },
  });

  async function onSubmit(values: SecuenciaFiscalInput) {
    setEnviando(true);
    const res = await crearSecuenciaFiscal(values);
    setEnviando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Secuencia fiscal creada");
    setAbierto(false);
    reset();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="arca-btn arca-btn-primary arca-btn-sm"
      >
        <Plus size={14} /> Nueva secuencia
      </button>

      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Nueva secuencia fiscal"
        descripcion="Define el documento y su autorización de impresión"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={enviando}>
              Crear
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Código doc."
              error={errors.tipoCodigo?.message}
              {...register("tipoCodigo")}
              placeholder="FAC"
            />
            <div className="sm:col-span-2">
              <Input
                label="Tipo de documento"
                error={errors.tipoNombre?.message}
                {...register("tipoNombre")}
                placeholder="Factura"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prefijo (opcional)" {...register("prefijo")} placeholder="001-001-01" />
            <Input
              label={`Autorización / CAI (opcional)`}
              {...register("autorizacion")}
              placeholder="CAI o autorización"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Rango inicial"
              type="number"
              error={errors.rangoInicial?.message}
              {...register("rangoInicial")}
            />
            <Input
              label="Rango final"
              type="number"
              error={errors.rangoFinal?.message}
              {...register("rangoFinal")}
            />
            <Input
              label="Fecha límite"
              type="date"
              error={errors.fechaLimite?.message}
              {...register("fechaLimite")}
            />
          </div>
          <p className="text-[12px] text-[color:var(--color-text-muted)]">
            El {idFiscalNombre} de la empresa se configura en los datos de la empresa.
          </p>
        </form>
      </Modal>
    </>
  );
}
