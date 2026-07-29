import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { proveedores } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProveedorForm } from "@/components/proveedores/ProveedorForm";

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, requireSession()]);

  const [proveedor] = await db
    .select({
      id: proveedores.id,
      razonSocial: proveedores.razonSocial,
      nombreComercial: proveedores.nombreComercial,
      identificacionFiscal: proveedores.identificacionFiscal,
      email: proveedores.email,
      telefono: proveedores.telefono,
      direccion: proveedores.direccion,
      diasCredito: proveedores.diasCredito,
      contacto: proveedores.contacto,
      notas: proveedores.notas,
    })
    .from(proveedores)
    .where(
      and(
        eq(proveedores.id, id),
        eq(proveedores.empresaId, user.empresaId),
        isNull(proveedores.eliminadoEn),
      ),
    )
    .limit(1);

  if (!proveedor) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={proveedor.razonSocial} subtitle={proveedor.nombreComercial ?? ""} />
      <ProveedorForm
        proveedorId={proveedor.id}
        defaults={{
          razonSocial: proveedor.razonSocial,
          nombreComercial: proveedor.nombreComercial ?? "",
          identificacionFiscal: proveedor.identificacionFiscal ?? "",
          email: proveedor.email ?? "",
          telefono: proveedor.telefono ?? "",
          direccion: proveedor.direccion ?? "",
          diasCredito: proveedor.diasCredito,
          contacto: proveedor.contacto ?? "",
          notas: proveedor.notas ?? "",
        }}
      />
    </div>
  );
}
