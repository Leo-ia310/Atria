"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clienteSchema, type ClienteInput } from "@/lib/validations/clientes";
import { crearCliente, actualizarCliente } from "@/lib/actions/clientes";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

export function ClienteForm({
  clienteId,
  defaults,
}: {
  clienteId?: string;
  defaults?: Partial<ClienteInput>;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nombre: defaults?.nombre ?? "",
      identificacionFiscal: defaults?.identificacionFiscal ?? "",
      email: defaults?.email ?? "",
      telefono: defaults?.telefono ?? "",
      direccion: defaults?.direccion ?? "",
      limiteCredito: defaults?.limiteCredito ?? 0,
      diasCredito: defaults?.diasCredito ?? 0,
      esConsumidorFinal: defaults?.esConsumidorFinal ?? false,
      notas: defaults?.notas ?? "",
    },
  });

  async function onSubmit(values: ClienteInput) {
    setEnviando(true);
    const res = clienteId
      ? await actualizarCliente(clienteId, values)
      : await crearCliente(values);
    setEnviando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", clienteId ? "Cliente actualizado" : "Cliente creado");
    router.push("/clientes");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card>
        <CardHeader title="Datos del cliente" />
        <CardBody className="space-y-4">
          <Input label="Nombre o razón social" error={errors.nombre?.message} {...register("nombre")} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Identificación fiscal" {...register("identificacionFiscal")} />
            <Input label="Teléfono" {...register("telefono")} />
          </div>
          <Input label="Correo" type="email" {...register("email")} error={errors.email?.message} />
          <Input label="Dirección" {...register("direccion")} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Crédito" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Límite de crédito"
              type="number"
              step="0.01"
              {...register("limiteCredito")}
              hint="0 = sin crédito"
            />
            <Input label="Días de crédito" type="number" {...register("diasCredito")} />
          </div>
          <label className="flex items-center gap-2 text-small">
            <input type="checkbox" {...register("esConsumidorFinal")} className="rounded" />
            Es consumidor final (sin datos fiscales requeridos)
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Notas internas" />
        <CardBody>
          <Input label="Observaciones" {...register("notas")} />
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" loading={enviando}>
          {clienteId ? "Guardar cambios" : "Crear cliente"}
        </Button>
      </div>
    </form>
  );
}
