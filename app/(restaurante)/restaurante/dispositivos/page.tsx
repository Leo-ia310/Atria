import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { PageHeader } from "@/components/layout/PageHeader";
import { DispositivosPanel } from "@/components/dispositivos/DispositivosPanel";

export default async function RestauranteDispositivosPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-configuracion");

  return (
    <div>
      <PageHeader
        title="Dispositivos restaurante"
        subtitle="Lector de barras, impresora, caja y equipos para salon, barra o cocina"
      />
      <DispositivosPanel />
    </div>
  );
}
