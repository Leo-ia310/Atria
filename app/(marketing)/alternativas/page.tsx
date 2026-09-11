import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SeoSimpleHeader } from "@/components/marketing/SeoSimpleHeader";
import { SEO_PAGES, getSeoPath } from "@/lib/seo-pages";

const alternativas = SEO_PAGES.filter((page) => page.category === "comparativa");

export const metadata: Metadata = {
  title: "Alternativas y comparativas de ARCA",
  description:
    "Compara ARCA con otras plataformas de gestion para elegir software POS, inventario, facturacion y contabilidad.",
  alternates: {
    canonical: "/alternativas",
  },
};

export default function AlternativasPage() {
  return (
    <main className="min-h-screen bg-[#090512] text-white">
      <SeoSimpleHeader />

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c4b5fd]">
          Alternativas
        </span>
        <h1 className="mt-4 max-w-3xl text-[42px] font-semibold leading-tight sm:text-[58px]">
          Comparativas para elegir el sistema correcto.
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-8 text-white/68">
          ARCA compite en busquedas donde los negocios evaluan sistemas de gestion,
          POS, inventario, facturacion y contabilidad.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {alternativas.map((page) => (
            <Link
              key={page.slug}
              href={getSeoPath(page)}
              className="group rounded-[12px] border border-white/10 bg-white/[0.045] p-6 transition hover:border-[#a78bfa]/55 hover:bg-white/[0.07]"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-[22px] font-semibold leading-snug">{page.h1}</h2>
                <ArrowRight size={18} className="mt-1 flex-shrink-0 text-white/35 transition group-hover:translate-x-1 group-hover:text-white" />
              </div>
              <p className="mt-3 text-[14px] leading-7 text-white/62">{page.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
