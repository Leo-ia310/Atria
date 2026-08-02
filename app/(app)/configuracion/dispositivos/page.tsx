import { PageHeader } from "@/components/layout/PageHeader";
import { DispositivosPanel } from "@/components/dispositivos/DispositivosPanel";

export default function DispositivosPage() {
  return (
    <div>
      <PageHeader
        title="Dispositivos"
        subtitle="Lector de barras, impresora de facturas y caja"
      />
      <DispositivosPanel />
    </div>
  );
}
