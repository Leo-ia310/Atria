import { PageHeader } from "@/components/layout/PageHeader";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { requireSession } from "@/lib/actions/session-helpers";
import { getPoliticasNegocio } from "@/lib/politicas-negocio";

export default async function NuevoClientePage() {
  const user = await requireSession();
  const politicas = await getPoliticasNegocio(user.empresaId);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nuevo cliente" subtitle="Registra los datos para facturación y crédito" />
      <ClienteForm
        defaults={{
          limiteCredito: politicas.limiteCreditoClienteDefault,
          diasCredito: politicas.diasCreditoClienteDefault,
        }}
      />
    </div>
  );
}
