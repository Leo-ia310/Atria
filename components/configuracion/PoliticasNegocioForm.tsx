"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  politicasNegocioSchema,
  type PoliticasNegocioInput,
} from "@/lib/validations/configuracion";
import { actualizarPoliticasNegocio } from "@/lib/actions/configuracion";
import type { PoliticasNegocio } from "@/lib/politicas-negocio";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export function PoliticasNegocioForm({
  defaults,
}: {
  defaults: PoliticasNegocio;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [guardando, setGuardando] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PoliticasNegocioInput>({
    resolver: zodResolver(politicasNegocioSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: PoliticasNegocioInput) {
    setGuardando(true);
    const res = await actualizarPoliticasNegocio(values);
    setGuardando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", "Politicas actualizadas");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader
          title="Reglas y politicas de negocio"
          subtitle="Define plazos de credito y gracia para que ARCA calcule vencimientos y estados."
        />
        <CardBody className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Dias para que el cliente pague"
              type="number"
              min={0}
              max={365}
              error={errors.diasCreditoClienteDefault?.message}
              hint="Se usa en ventas al credito si el cliente no tiene dias propios."
              {...register("diasCreditoClienteDefault")}
            />
            <Input
              label="Limite de credito para clientes nuevos"
              type="number"
              min={0}
              step="0.01"
              error={errors.limiteCreditoClienteDefault?.message}
              hint="0 crea clientes sin credito por defecto."
              {...register("limiteCreditoClienteDefault")}
            />
            <Input
              label="Dias de gracia en CxC"
              type="number"
              min={0}
              max={90}
              error={errors.diasGraciaCobroCliente?.message}
              hint="Margen antes de marcar una cuenta por cobrar como vencida."
              {...register("diasGraciaCobroCliente")}
            />
            <Input
              label="Dias de credito proveedor"
              type="number"
              min={0}
              max={365}
              error={errors.diasCreditoProveedorDefault?.message}
              hint="Se usa en compras al credito si el proveedor no tiene dias propios."
              {...register("diasCreditoProveedorDefault")}
            />
            <Input
              label="Dias de gracia en CxP"
              type="number"
              min={0}
              max={90}
              error={errors.diasGraciaPagoProveedor?.message}
              hint="Margen antes de marcar una cuenta por pagar como vencida."
              {...register("diasGraciaPagoProveedor")}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={guardando}>
              Guardar politicas
            </Button>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
