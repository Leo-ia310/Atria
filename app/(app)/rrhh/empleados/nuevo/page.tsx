import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { sucursales } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmpleadoForm } from "@/components/rrhh/EmpleadoForm";

export default async function NuevoEmpleadoPage() {
  const user = await requireSession();
  const sucs = await db
    .select({ id: sucursales.id, nombre: sucursales.nombre })
    .from(sucursales)
    .where(and(eq(sucursales.empresaId, user.empresaId), isNull(sucursales.eliminadoEn)));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nuevo empleado" subtitle="Registra los datos del colaborador" />
      <EmpleadoForm sucursales={sucs.map((s) => ({ value: s.id, label: s.nombre }))} />
    </div>
  );
}
