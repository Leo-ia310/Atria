import type { Metadata } from "next";
import { Nav } from "@/components/marketing/Nav";
import { PricingToggle } from "@/components/marketing/PricingToggle";
import { FAQ } from "@/components/marketing/FAQ";

export const metadata: Metadata = {
  title: "Precios — Planes simples para cada etapa de tu negocio",
  description:
    "Empieza gratis y sube de plan cuando lo necesites. Planes Demo, Pro y Enterprise de ARCA con punto de venta, inventario y contabilidad incluidos.",
  alternates: {
    canonical: "/precios",
  },
  openGraph: {
    title: "Precios de ARCA — Simple, honesto y escalable",
    description:
      "Empieza gratis y sube de plan cuando tu negocio lo pida. Punto de venta, inventario y contabilidad en un solo sistema.",
    url: "/precios",
    type: "website",
    siteName: "ARCA",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "Precios de ARCA — Simple, honesto y escalable",
    description:
      "Empieza gratis y sube de plan cuando tu negocio lo pida. Punto de venta, inventario y contabilidad en un solo sistema.",
  },
};

export default function PreciosPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0416] text-white">
      {/* Fondo oscuro con orbes, igual que la landing */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#0b0416]">
        <div className="absolute -left-[10vmin] -top-[8vmin] h-[54vmin] w-[54vmin] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.5),transparent_70%)] blur-3xl" />
        <div className="absolute -right-[12vmin] top-[18vh] h-[58vmin] w-[58vmin] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.45),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[-24vmin] left-[24vw] h-[52vmin] w-[52vmin] rounded-full bg-[radial-gradient(circle,rgba(192,38,211,0.34),transparent_70%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative z-10">
        <Nav />

        <section className="pt-32 pb-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
                Precios
              </span>
              <h1 className="mt-3 text-[44px] font-bold leading-[1.05] tracking-tight sm:text-[56px]">
                Simple. Honesto. Escalable.
              </h1>
              <p className="mt-4 text-[16px] leading-7 text-white/65">
                Empieza gratis para probarlo. Sube cuando tu negocio lo pida.
              </p>
            </div>
            <div className="mt-12">
              <PricingToggle />
            </div>
            <p className="mt-10 text-center text-[13px] text-white/50">
              Todos los planes incluyen actualizaciones, copias de seguridad y soporte
              en español.
            </p>
          </div>
        </section>

        <section id="faq" className="py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
                Preguntas frecuentes
              </span>
              <h2 className="mt-3 text-[32px] font-semibold leading-tight">
                Respuestas claras antes de empezar.
              </h2>
            </div>
            <div className="mt-12">
              <FAQ />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
