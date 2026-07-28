"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { empleadoSchema, type EmpleadoInput } from "@/lib/validations/rrhh";
import { crearEmpleado, actualizarEmpleado } from "@/lib/actions/rrhh";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

const CONTRATOS = [
  { value: "indefinido", label: "Indefinido" },
  { value: "temporal", label: "Temporal" },
  { value: "por_obra", label: "Por obra" },
  { value: "medio_tiempo", label: "Medio tiempo" },
  { value: "practicante", label: "Practicante" },
  { value: "servicios", label: "Servicios profesionales" },
];
const FRECUENCIAS = [
  { value: "mensual", label: "Mensual" },
  { value: "quincenal", label: "Quincenal" },
  { value: "semanal", label: "Semanal" },
];
const GENEROS = [
  { value: "", label: "No especificado" },
  { value: "masculino", label: "Masculino" },
  { value: "femenino", label: "Femenino" },
  { value: "otro", label: "Otro" },
];

export function EmpleadoForm({
  empleadoId,
  sucursales,
  defaults,
}: {
  empleadoId?: string;
  sucursales: { value: string; label: string }[];
  defaults?: Partial<EmpleadoInput>;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);
  const hoyIso = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmpleadoInput>({
    resolver: zodResolver(empleadoSchema),
    defaultValues: {
      nombres: defaults?.nombres ?? "",
      apellidos: defaults?.apellidos ?? "",
      identificacion: defaults?.identificacion ?? "",
      email: defaults?.email ?? "",
      telefono: defaults?.telefono ?? "",
      direccion: defaults?.direccion ?? "",
      fechaNacimiento: defaults?.fechaNacimiento ?? "",
      genero: defaults?.genero ?? "",
      puesto: defaults?.puesto ?? "",
      departamento: defaults?.departamento ?? "",
      tipoContrato: defaults?.tipoContrato ?? "indefinido",
      fechaIngreso: defaults?.fechaIngreso ?? new Date().toISOString().slice(0, 10),
      salarioBase: defaults?.salarioBase ?? 0,
      frecuenciaPago: defaults?.frecuenciaPago ?? "mensual",
      diasVacacionesAnuales: defaults?.diasVacacionesAnuales ?? 12,
      sucursalId: defaults?.sucursalId ?? "",
      banco: defaults?.banco ?? "",
      cuentaBanco: defaults?.cuentaBanco ?? "",
      contactoEmergenciaNombre: defaults?.contactoEmergenciaNombre ?? "",
      contactoEmergenciaTelefono: defaults?.contactoEmergenciaTelefono ?? "",
      notas: defaults?.notas ?? "",
    },
  });

  async function onSubmit(values: EmpleadoInput) {
    setEnviando(true);
    const res = empleadoId
      ? await actualizarEmpleado(empleadoId, values)
      : await crearEmpleado(values);
    setEnviando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", empleadoId ? "Empleado actualizado" : "Empleado creado");
    router.push("/rrhh/empleados");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card>
        <CardHeader title="Datos personales" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Nombres" error={errors.nombres?.message} {...register("nombres")} />
            <Input label="Apellidos" error={errors.apellidos?.message} {...register("apellidos")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Identificación / Cédula" {...register("identificacion")} />
            <Input
              label="Fecha de nacimiento"
              type="date"
              max={hoyIso}
              error={errors.fechaNacimiento?.message}
              hint="Debe ser mayor de 16 años"
              {...register("fechaNacimiento")}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Correo" type="email" error={errors.email?.message} {...register("email")} />
            <Input label="Teléfono" {...register("telefono")} />
          </div>
          <Input label="Dirección" {...register("direccion")} />
          <Select label="Género" options={GENEROS} {...register("genero")} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Puesto y contrato" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Puesto" error={errors.puesto?.message} {...register("puesto")} />
            <Input label="Departamento / Área" {...register("departamento")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Tipo de contrato" options={CONTRATOS} {...register("tipoContrato")} />
            <Input label="Fecha de ingreso" type="date" error={errors.fechaIngreso?.message} {...register("fechaIngreso")} />
          </div>
          {sucursales.length > 0 && (
            <Select
              label="Sucursal"
              options={[{ value: "", label: "Sin asignar" }, ...sucursales]}
              {...register("sucursalId")}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Compensación" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Salario base (mensual)"
              type="number"
              step="0.01"
              error={errors.salarioBase?.message}
              {...register("salarioBase")}
            />
            <Select label="Frecuencia de pago" options={FRECUENCIAS} {...register("frecuenciaPago")} />
            <Input label="Vacaciones/año (días)" type="number" {...register("diasVacacionesAnuales")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Banco" {...register("banco")} />
            <Input label="Número de cuenta" {...register("cuentaBanco")} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Contacto de emergencia y notas" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Nombre de contacto" {...register("contactoEmergenciaNombre")} />
            <Input label="Teléfono de contacto" {...register("contactoEmergenciaTelefono")} />
          </div>
          <Input label="Notas internas" {...register("notas")} />
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" loading={enviando}>
          {empleadoId ? "Guardar cambios" : "Crear empleado"}
        </Button>
      </div>
    </form>
  );
}
