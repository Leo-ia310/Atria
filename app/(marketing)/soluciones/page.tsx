import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SeoSimpleHeader } from "@/components/marketing/SeoSimpleHeader";
import { SEO_INDUSTRY_PAGES, SEO_PRODUCT_PAGES, getSeoPath } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: "Soluciones ARCA para POS, inventario, facturacion y contabilidad",
  description:
    "Explora soluciones de ARCA por modulo e industria: punto de venta, inventario, facturacion, contabilidad, restaurantes, tiendas, farmacias y mas.",
  alternates: {
    canonical: "/soluciones",
  },
};

export default function SolucionesPage() {
  return (
    <main className="min-h-screen bg-[#090512] text-white">
      <SeoSimpleHeader />

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c4b5fd]">
          Soluciones
        </span>
        <h1 className="mt-4 max-w-3xl text-[42px] font-semibold leading-tight sm:text-[58px]">
          Software para vender, controlar inventario y entender tu negocio.
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-8 text-white/68">
          Paginas creadas por intencion de busqueda para explicar como ARCA resuelve
          cada necesidad operativa.
        </p>

        <h2 className="mt-14 text-[28px] font-semibold">Por modulo</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {SEO_PRODUCT_PAGES.map((page) => (
            <SolutionLink key={page.slug} href={getSeoPath(page)} title={page.h1} text={page.description} />
          ))}
        </div>

        <h2 className="mt-14 text-[28px] font-semibold">Por tipo de negocio</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {SEO_INDUSTRY_PAGES.map((page) => (
            <SolutionLink key={page.slug} href={getSeoPath(page)} title={page.h1} text={page.description} />
          ))}
        </div>
      </section>
    </main>
  );
}

function SolutionLink({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="group rounded-[12px] border border-white/10 bg-white/[0.045] p-6 transition hover:border-[#a78bfa]/55 hover:bg-white/[0.07]"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-[18px] font-semibold leading-snug">{title}</h3>
        <ArrowRight size={18} className="mt-1 flex-shrink-0 text-white/35 transition group-hover:translate-x-1 group-hover:text-white" />
      </div>
      <p className="mt-3 text-[14px] leading-7 text-white/62">{text}</p>
    </Link>
  );
}
