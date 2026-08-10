"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  configuracionNegocioSchema,
  type ConfiguracionNegocioInput,
} from "@/lib/validations/configuracion";
import { actualizarConfiguracionNegocio } from "@/lib/actions/configuracion";
import type { ConfiguracionNegocio } from "@/lib/configuracion-negocio";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

export function ConfiguracionNegocioForm({
  defaults,
}: {
  defaults: ConfiguracionNegocio;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [guardando, setGuardando] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConfiguracionNegocioInput>({
    resolver: zodResolver(configuracionNegocioSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: ConfiguracionNegocioInput) {
    setGuardando(true);
    const res = await actualizarConfiguracionNegocio(values);
    setGuardando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", "Configuracion del negocio actualizada");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader
          title="Operacion del negocio"
          subtitle="Ajusta como ARCA se adapta a tu ritmo: pagos de planilla y jornada laboral."
        />
        <CardBody className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Frecuencia de nomina"
              error={errors.frecuenciaNomina?.message}
              hint="Cada cuanto pagas a tu personal."
              options={[
                { value: "semanal", label: "Semanal" },
                { value: "quincenal", label: "Quincenal" },
                { value: "mensual", label: "Mensual" },
              ]}
              {...register("frecuenciaNomina")}
            />
            <Input
              label="Dia de pago"
              type="number"
              min={1}
              max={31}
              error={errors.diaPagoNomina?.message}
              hint="Dia del mes en que pagas la planilla (1-31)."
              {...register("diaPagoNomina")}
            />
            <Input
              label="Horas por jornada"
              type="number"
              min={1}
              max={24}
              step="0.5"
              error={errors.horasJornada?.message}
              hint="Horas de una jornada completa."
              {...register("horasJornada")}
            />
            <Input
              label="Dias laborales por semana"
              type="number"
              min={1}
              max={7}
              error={errors.diasLaboralesSemana?.message}
              hint="Cuantos dias abre el negocio por semana."
              {...register("diasLaboralesSemana")}
            />
            <Select
              label="Inicio de semana"
              error={errors.inicioSemana?.message}
              hint="Primer dia de la semana para reportes y planillas."
              options={[
                { value: "lunes", label: "Lunes" },
                { value: "domingo", label: "Domingo" },
              ]}
              {...register("inicioSemana")}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={guardando}>
              Guardar configuracion
            </Button>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
