"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import {
  crearSucursalSchema,
  type CrearSucursalInput,
} from "@/lib/validations/configuracion";
import { crearSucursal } from "@/lib/actions/configuracion";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function CrearSucursalButton({
  puedeCrear = true,
  limiteTexto,
}: {
  puedeCrear?: boolean;
  limiteTexto?: string;
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
  } = useForm<CrearSucursalInput>({
    resolver: zodResolver(crearSucursalSchema),
    defaultValues: {
      codigo: "",
      nombre: "",
      direccion: "",
      telefono: "",
    },
  });

  async function onSubmit(values: CrearSucursalInput) {
    setEnviando(true);
    const res = await crearSucursal(values);
    setEnviando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Sucursal creada");
    setAbierto(false);
    reset();
    router.refresh();
  }

  const codigo = register("codigo");

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={!puedeCrear ? limiteTexto : undefined}
        className="atria-btn atria-btn-primary atria-btn-sm"
      >
        <Plus size={14} /> Nueva sucursal
      </button>

      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Nueva sucursal"
        descripcion="Agrega otro punto de operacion para inventario, caja y personal"
        ancho="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={enviando} disabled={!puedeCrear}>
              Crear
            </Button>
          </>
        }
      >
        {!puedeCrear ? (
          <p className="text-small text-[color:var(--color-text-muted)]">
            {limiteTexto ?? "Tu plan ya alcanzo el limite de sucursales activas."}
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Codigo"
              placeholder="SUC_02"
              error={errors.codigo?.message}
              {...codigo}
              onChange={(event) => {
                event.target.value = event.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9_]/g, "");
                codigo.onChange(event);
              }}
            />
            <Input label="Nombre" error={errors.nombre?.message} {...register("nombre")} />
            <Input label="Direccion" {...register("direccion")} />
            <Input label="Telefono" {...register("telefono")} />
          </form>
        )}
      </Modal>
    </>
  );
}
