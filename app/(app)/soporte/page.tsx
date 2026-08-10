import { LifeBuoy } from "lucide-react";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { PageHeader } from "@/components/layout/PageHeader";
import { SoporteAssistant } from "@/components/soporte/SoporteAssistant";

export default async function SoportePage() {
  const user = await requireSession();
  await requireModulo(user, "soporte");

  return (
    <div>
      <PageHeader
        title="Soporte"
        subtitle="Asistente interno de ARCA"
        actions={
          <span className="arca-badge arca-badge-info">
            <LifeBuoy size={12} /> IA
          </span>
        }
      />
      <SoporteAssistant />
    </div>
  );
}
