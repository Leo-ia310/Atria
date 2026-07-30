"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import {
  crearUsuarioSchema,
  type CrearUsuarioInput,
} from "@/lib/validations/configuracion";
import { crearUsuario } from "@/lib/actions/configuracion";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function CrearUsuarioForm({
  roles,
  puedeCrear = true,
  limiteTexto,
}: {
  roles: { value: string; label: string }[];
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
  } = useForm<CrearUsuarioInput>({
    resolver: zodResolver(crearUsuarioSchema),
    defaultValues: {
      nombre: "",
      email: "",
      password: "",
      rolId: roles[0]?.value ?? "",
      activo: true,
    },
  });

  async function onSubmit(values: CrearUsuarioInput) {
    setEnviando(true);
    const res = await crearUsuario(values);
    setEnviando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Usuario creado");
    setAbierto(false);
    reset();
    router.refresh();
  }

  const sinRoles = roles.length === 0;
  const bloqueado = sinRoles || !puedeCrear;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={!puedeCrear ? limiteTexto : undefined}
        className="arca-btn arca-btn-primary arca-btn-sm"
      >
        <UserPlus size={14} /> Nuevo usuario
      </button>

      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Nuevo usuario"
        descripcion="Crea una cuenta con acceso a esta empresa"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={enviando} disabled={bloqueado}>
              Crear usuario
            </Button>
          </>
        }
      >
        {sinRoles ? (
          <p className="text-small text-[color:var(--color-text-muted)]">
            Primero crea al menos un rol en Configuración → Roles y permisos.
          </p>
        ) : !puedeCrear ? (
          <p className="text-small text-[color:var(--color-text-muted)]">
            {limiteTexto ?? "Tu plan ya alcanzo el limite de usuarios activos."}
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Nombre completo" error={errors.nombre?.message} {...register("nombre")} />
            <Input
              label="Correo"
              type="email"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Contraseña temporal"
              type="password"
              error={errors.password?.message}
              hint="Mínimo 8 caracteres. El usuario podrá cambiarla luego."
              {...register("password")}
            />
            <Select
              label="Rol"
              options={roles}
              error={errors.rolId?.message}
              {...register("rolId")}
            />
          </form>
        )}
      </Modal>
    </>
  );
}
