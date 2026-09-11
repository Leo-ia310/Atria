import Link from "next/link";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { ArcaLogo } from "@/components/marketing/ArcaLogo";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  SEO_INDUSTRY_PAGES,
  SEO_PRODUCT_PAGES,
  type SeoPage,
  getSeoPath,
  seoPageJsonLd,
} from "@/lib/seo-pages";

export function SeoPageTemplate({ page }: { page: SeoPage }) {
  const related =
    page.category === "industria"
      ? SEO_INDUSTRY_PAGES.filter((item) => item.slug !== page.slug).slice(0, 4)
      : SEO_PRODUCT_PAGES.filter((item) => item.slug !== page.slug);

  return (
    <>
      <JsonLd data={seoPageJsonLd(page)} />
      <main className="min-h-screen bg-[#090512] text-white">
        <header className="border-b border-white/10 bg-[#090512]/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
            <Link href="/" className="flex items-center gap-3">
              <ArcaLogo className="h-9 w-auto" eager />
              <span className="text-base font-semibold">ARCA</span>
            </Link>
            <nav
              aria-label="Navegacion principal"
              className="hidden items-center gap-5 text-[13px] text-white/68 md:flex"
            >
              <Link href="/#caracteristicas" className="transition hover:text-white">
                Producto
              </Link>
              <Link href="/precios" className="transition hover:text-white">
                Precios
              </Link>
              <Link href="/alternativas/treinta" className="transition hover:text-white">
                ARCA vs Treinta
              </Link>
            </nav>
            <Link
              href="/registro"
              className="arca-btn arca-btn-sm bg-white text-[#160827] transition hover:bg-[#efe7ff]"
            >
              Probar gratis
            </Link>
          </div>
        </header>

        <section className="relative overflow-hidden border-b border-white/10">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(124,58,237,0.34),transparent_32%),radial-gradient(circle_at_82%_10%,rgba(37,99,235,0.26),transparent_28%)]"
          />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
            <div>
              <nav
                aria-label="Breadcrumb"
                className="mb-8 flex flex-wrap items-center gap-2 text-[12px] text-white/48"
              >
                <Link href="/" className="hover:text-white">
                  Inicio
                </Link>
                <ChevronRight size={13} />
                <span>{page.category === "comparativa" ? "Alternativas" : "Soluciones"}</span>
                <ChevronRight size={13} />
                <span className="text-white/75">{page.eyebrow}</span>
              </nav>
              <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c4b5fd]">
                {page.eyebrow}
              </span>
              <h1 className="mt-4 max-w-3xl text-[40px] font-semibold leading-[1.08] sm:text-[56px]">
                {page.h1}
              </h1>
              <p className="mt-6 max-w-2xl text-[17px] leading-8 text-white/70">
                {page.intro}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/registro"
                  className="arca-btn arca-btn-lg bg-white text-[#160827] transition hover:bg-[#efe7ff]"
                >
                  Empezar con ARCA
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/precios"
                  className="arca-btn arca-btn-lg border border-white/18 bg-white/[0.08] text-white transition hover:bg-white/12"
                >
                  Ver planes
                </Link>
              </div>
            </div>

            <aside className="rounded-[14px] border border-white/12 bg-white/[0.06] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">
                Resultados clave
              </p>
              <ul className="mt-5 space-y-4">
                {page.outcomes.map((outcome) => (
                  <li key={outcome} className="flex gap-3 text-[14px] leading-6 text-white/75">
                    <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#34a853] text-[#061109]">
                      <Check size={13} />
                    </span>
                    {outcome}
                  </li>
                ))}
              </ul>
              <div className="mt-6 border-t border-white/10 pt-5">
                <p className="text-[12px] text-white/45">Busqueda principal</p>
                <p className="mt-1 text-[18px] font-semibold">{page.primaryKeyword}</p>
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="max-w-3xl">
            <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c4b5fd]">
              Lo que resuelve
            </span>
            <h2 className="mt-3 text-[32px] font-semibold leading-tight">
              Una operacion mas clara desde la primera venta.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {page.features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-[12px] border border-white/10 bg-white/[0.045] p-6"
              >
                <h3 className="text-[18px] font-semibold">{feature.title}</h3>
                <p className="mt-3 text-[14px] leading-7 text-white/62">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.035]">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c4b5fd]">
                Preguntas frecuentes
              </span>
              <h2 className="mt-3 text-[32px] font-semibold leading-tight">
                Dudas comunes antes de elegir {page.eyebrow.toLowerCase()}.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-white/58">
                Estas respuestas tambien ayudan a que buscadores e IA entiendan mejor
                cuando recomendar ARCA.
              </p>
            </div>
            <div className="space-y-3">
              {page.faqs.map((faq) => (
                <article key={faq.question} className="rounded-[12px] border border-white/10 p-5">
                  <h3 className="text-[16px] font-semibold">{faq.question}</h3>
                  <p className="mt-2 text-[14px] leading-7 text-white/62">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {related.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <h2 className="text-[28px] font-semibold">Tambien puedes comparar</h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={getSeoPath(item)}
                  className="group rounded-[12px] border border-white/10 bg-white/[0.04] p-5 transition hover:border-[#a78bfa]/55 hover:bg-white/[0.07]"
                >
                  <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    {item.eyebrow}
                  </span>
                  <p className="mt-3 text-[16px] font-semibold leading-snug group-hover:text-[#ddd6fe]">
                    {item.primaryKeyword}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
