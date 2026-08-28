"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import {
  actualizarUsuarioSchema,
  type ActualizarUsuarioInput,
} from "@/lib/validations/configuracion";
import { actualizarUsuario } from "@/lib/actions/configuracion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

type RolOption = { value: string; label: string };

export type UsuarioEditable = {
  id: string;
  nombre: string;
  email: string;
  rolId: string;
  activo: boolean;
};

export function UsuarioAcciones({
  usuario,
  roles,
}: {
  usuario: UsuarioEditable;
  roles: RolOption[];
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
  } = useForm<ActualizarUsuarioInput>({
    resolver: zodResolver(actualizarUsuarioSchema),
    defaultValues: {
      nombre: usuario.nombre,
      email: usuario.email,
      password: "",
      rolId: usuario.rolId,
      activo: usuario.activo,
    },
  });

  function abrirEditor() {
    reset({
      nombre: usuario.nombre,
      email: usuario.email,
      password: "",
      rolId: usuario.rolId,
      activo: usuario.activo,
    });
    setAbierto(true);
  }

  async function onSubmit(values: ActualizarUsuarioInput) {
    setEnviando(true);
    const res = await actualizarUsuario(usuario.id, values);
    setEnviando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Usuario actualizado");
    setAbierto(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={abrirEditor}>
        <Pencil size={14} />
        Editar
      </Button>

      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Editar usuario"
        descripcion="Actualiza los datos y el rol del usuario"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={enviando}>
              Guardar cambios
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Nombre completo" error={errors.nombre?.message} {...register("nombre")} />
          <Input
            label="Correo"
            type="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Nueva contraseña"
            type="password"
            hint="Déjalo vacío para conservar la actual."
            error={errors.password?.message}
            {...register("password")}
          />
          <Select
            label="Rol"
            options={roles}
            error={errors.rolId?.message}
            {...register("rolId")}
          />
          <label className="flex items-center gap-2 text-small text-[color:var(--color-text-secondary)]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[color:var(--color-border)]"
              {...register("activo")}
            />
            Usuario activo
          </label>
        </form>
      </Modal>
    </>
  );
}
