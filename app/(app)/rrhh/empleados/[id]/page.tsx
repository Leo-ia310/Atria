import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { empleados, sucursales } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmpleadoForm } from "@/components/rrhh/EmpleadoForm";
import { EmpleadoEstadoControl } from "@/components/rrhh/EmpleadoEstadoControl";
import type { EmpleadoInput } from "@/lib/validations/rrhh";

export default async function EditarEmpleadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSession();

  const [emp] = await db
    .select()
    .from(empleados)
    .where(and(eq(empleados.id, id), eq(empleados.empresaId, user.empresaId)))
    .limit(1);
  if (!emp) notFound();

  const sucs = await db
    .select({ id: sucursales.id, nombre: sucursales.nombre })
    .from(sucursales)
    .where(and(eq(sucursales.empresaId, user.empresaId), isNull(sucursales.eliminadoEn)));

  const defaults: Partial<EmpleadoInput> = {
    nombres: emp.nombres,
    apellidos: emp.apellidos,
    identificacion: emp.identificacion ?? "",
    email: emp.email ?? "",
    telefono: emp.telefono ?? "",
    direccion: emp.direccion ?? "",
    ciudad: emp.ciudad ?? "",
    municipio: emp.municipio ?? "",
    estadoCivil: (emp.estadoCivil ?? "") as EmpleadoInput["estadoCivil"],
    nacionalidad: emp.nacionalidad ?? "",
    profesionOficio: emp.profesionOficio ?? "",
    dependientes: emp.dependientes,
    fechaNacimiento: emp.fechaNacimiento ?? "",
    genero: (emp.genero ?? "") as EmpleadoInput["genero"],
    puesto: emp.puesto,
    departamento: emp.departamento ?? "",
    tipoContrato: emp.tipoContrato,
    fechaIngreso: emp.fechaIngreso,
    salarioBase: Number(emp.salarioBase),
    frecuenciaPago: emp.frecuenciaPago,
    diasVacacionesAnuales: emp.diasVacacionesAnuales,
    sucursalId: emp.sucursalId ?? "",
    banco: emp.banco ?? "",
    cuentaBanco: emp.cuentaBanco ?? "",
    contactoEmergenciaNombre: emp.contactoEmergenciaNombre ?? "",
    contactoEmergenciaTelefono: emp.contactoEmergenciaTelefono ?? "",
    notas: emp.notas ?? "",
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/rrhh/empleados"
        className="mb-3 inline-flex items-center gap-1 text-small text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
      >
        <ArrowLeft size={14} /> Volver a empleados
      </Link>
      <PageHeader
        title={`${emp.nombres} ${emp.apellidos}`}
        subtitle={`${emp.codigo} · ${emp.puesto}`}
        actions={<EmpleadoEstadoControl empleadoId={emp.id} estado={emp.estado} />}
      />
      <EmpleadoForm
        empleadoId={emp.id}
        sucursales={sucs.map((s) => ({ value: s.id, label: s.nombre }))}
        defaults={defaults}
      />
    </div>
  );
}
