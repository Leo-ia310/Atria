import Link from "next/link";
import { ChefHat, LifeBuoy, QrCode, Table2 } from "lucide-react";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getLimitesIA } from "@/lib/pricing";
import { Card, CardBody } from "@/components/ui/Card";
import { SoporteAssistant } from "@/components/soporte/SoporteAssistant";

const GUIAS_RAPIDAS = [
  {
    href: "/restaurante/mesas",
    title: "Salon y mesas",
    text: "Estados, areas, QR por mesa y flujo de atencion.",
    icon: Table2,
  },
  {
    href: "/restaurante/kds",
    title: "Cocina KDS",
    text: "Comandas, preparacion, pedidos en cola y tiempos.",
    icon: ChefHat,
  },
  {
    href: "/restaurante/menu",
    title: "Carta QR",
    text: "Menu publico, platillos, promociones y QR.",
    icon: QrCode,
  },
];

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
          Resuelve dudas de salon, cocina, carta QR, reservas, insumos y food cost
          sin salir del entorno restaurante.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        {GUIAS_RAPIDAS.map((guia) => (
          <Link key={guia.href} href={guia.href} className="group">
            <Card className="h-full transition hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-surface-2)]">
              <CardBody>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] transition group-hover:bg-[color:var(--color-primary)] group-hover:text-[color:var(--color-text-on-primary)]">
                  <guia.icon size={18} />
                </div>
                <div className="font-semibold">{guia.title}</div>
                <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
                  {guia.text}
                </p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-label">Asistente especializado</p>
            <h2 className="mt-1 text-lg font-semibold">Preguntas de restaurante</h2>
            <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
              Comandas, mesas, QR, inventario de cocina y reportes de restaurante.
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
          mensajeInicial="Hola. Soy el asistente de ARCA Restaurante. Puedo ayudarte con salon, mesas, POS restaurante, KDS, carta QR, reservaciones, insumos, recetas, mermas y food cost."
          sugerencias={[
            ["Configurar mesas", "Como configuro areas y mesas para mi restaurante?"],
            ["Pedidos en cocina", "Como uso el KDS para cambiar estados de comandas?"],
            ["Carta QR", "Como publico mi menu QR y lo enlazo con mesas?"],
          ]}
        />
      </section>
    </div>
  );
}
