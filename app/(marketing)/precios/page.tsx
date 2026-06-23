import { Nav } from "@/components/marketing/Nav";
import { PricingToggle } from "@/components/marketing/PricingToggle";
import { FAQ } from "@/components/marketing/FAQ";

export default function PreciosPage() {
  return (
    <>
      <Nav />
      <section className="bg-[color:var(--color-neutral)] pt-32 pb-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-label">Precios</span>
            <h1 className="mt-3 text-display text-[color:var(--color-text-primary)]">
              Simple. Honesto. Escalable.
            </h1>
            <p className="mt-4 text-base text-[color:var(--color-text-muted)]">
              Empieza gratis para probarlo. Sube cuando tu negocio lo pida.
            </p>
          </div>
          <div className="mt-12">
            <PricingToggle />
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[color:var(--color-surface)] py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl text-[color:var(--color-text-primary)]">
              Preguntas frecuentes
            </h2>
          </div>
          <div className="mt-12">
            <FAQ />
          </div>
        </div>
      </section>
    </>
  );
}
