import { PageHeader } from "@/components/layout/PageHeader";
import { ClienteForm } from "@/components/clientes/ClienteForm";

export default function NuevoClientePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nuevo cliente" subtitle="Registra los datos para facturación y crédito" />
      <ClienteForm />
    </div>
  );
}
