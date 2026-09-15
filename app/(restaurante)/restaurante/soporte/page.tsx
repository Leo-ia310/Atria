import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getLimitesIA } from "@/lib/pricing";
import { SoporteAssistant } from "@/components/soporte/SoporteAssistant";

export const metadata: Metadata = {
  title: "Soporte | ARCA Restaurante",
  description: "Asistente de soporte para operaciones conectadas de ARCA Restaurante.",
};

export default async function RestauranteSoportePage() {
  const user = await requireSession();
  const access = await requireModulo(user, "restaurante-soporte");
  const limitesIA = getLimitesIA(access.plan.id);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-label">Ayuda operativa</p>
        <h1 className="mt-1 text-xl">Soporte ARCA Restaurante</h1>
        <p className="mt-1 max-w-3xl text-small text-[color:var(--color-text-muted)]">
          Resuelve dudas operativas de reservas, insumos, compras, finanzas y reportes
          sin salir del entorno restaurante.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-label">Asistente especializado</p>
            <h2 className="mt-1 text-lg font-semibold">Preguntas de restaurante</h2>
            <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
              Reservas, inventario de cocina, compras, finanzas y reportes de restaurante.
            </p>
          </div>
          <span className="arca-badge arca-badge-info">
            <LifeBuoy size={12} /> IA
          </span>
        </div>
        <SoporteAssistant
          titulo="Asistente Restaurante"
          planNombre={access.plan.nombre}
          preguntasDiarias={limitesIA.preguntasDiarias}
          palabrasPorPregunta={limitesIA.palabrasPorPregunta}
          mensajeInicial="Hola. Soy el asistente de ARCA Restaurante. Puedo ayudarte con POS, reservaciones, insumos, recetas, mermas, compras, finanzas y food cost."
          sugerencias={[
            ["Food cost", "Como reviso el food cost por receta?"],
            ["Compras", "Como reviso compras sugeridas sin generar obligaciones?"],
            ["Reservas", "Como organizo reservas y lista de espera?"],
          ]}
        />
      </section>
    </div>
  );
}
