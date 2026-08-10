import { PageHeader } from "@/components/layout/PageHeader";
import { ProveedorForm } from "@/components/proveedores/ProveedorForm";
import { requireSession } from "@/lib/actions/session-helpers";
import { getPoliticasNegocio } from "@/lib/politicas-negocio";

export default async function NuevoProveedorPage() {
  const user = await requireSession();
  const politicas = await getPoliticasNegocio(user.empresaId);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nuevo proveedor" subtitle="Datos para órdenes de compra y CxP" />
      <ProveedorForm
        defaults={{
          diasCredito: politicas.diasCreditoProveedorDefault,
        }}
      />
    </div>
  );
}
