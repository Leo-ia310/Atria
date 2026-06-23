"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { proveedorSchema, type ProveedorInput } from "@/lib/validations/proveedores";
import { crearProveedor, actualizarProveedor } from "@/lib/actions/proveedores";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

export function ProveedorForm({
  proveedorId,
  defaults,
}: {
  proveedorId?: string;
  defaults?: Partial<ProveedorInput>;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProveedorInput>({
    resolver: zodResolver(proveedorSchema),
    defaultValues: {
      razonSocial: defaults?.razonSocial ?? "",
      nombreComercial: defaults?.nombreComercial ?? "",
      identificacionFiscal: defaults?.identificacionFiscal ?? "",
      email: defaults?.email ?? "",
      telefono: defaults?.telefono ?? "",
      direccion: defaults?.direccion ?? "",
      diasCredito: defaults?.diasCredito ?? 0,
      contacto: defaults?.contacto ?? "",
      notas: defaults?.notas ?? "",
    },
  });

  async function onSubmit(values: ProveedorInput) {
    setEnviando(true);
    const res = proveedorId
      ? await actualizarProveedor(proveedorId, values)
      : await crearProveedor(values);
    setEnviando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", proveedorId ? "Proveedor actualizado" : "Proveedor creado");
    router.push("/compras/proveedores");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card>
        <CardHeader title="Datos del proveedor" />
        <CardBody className="space-y-4">
          <Input
            label="Razón social"
            error={errors.razonSocial?.message}
            {...register("razonSocial")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Nombre comercial" {...register("nombreComercial")} />
            <Input label="Identificación fiscal" {...register("identificacionFiscal")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Correo" type="email" {...register("email")} error={errors.email?.message} />
            <Input label="Teléfono" {...register("telefono")} />
          </div>
          <Input label="Dirección" {...register("direccion")} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Contacto principal" {...register("contacto")} />
            <Input label="Días de crédito" type="number" {...register("diasCredito")} />
          </div>
          <Input label="Notas" {...register("notas")} />
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" loading={enviando}>
          {proveedorId ? "Guardar cambios" : "Crear proveedor"}
        </Button>
      </div>
    </form>
  );
}
