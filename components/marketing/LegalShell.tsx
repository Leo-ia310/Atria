import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import {
  DOCUMENTOS_LEGALES,
  FECHA_VIGENCIA,
  VERSION_LEGAL,
  getDocumentoLegal,
  type DocumentoLegalSlug,
} from "@/lib/legal";
import { LegalPrintButton } from "@/components/marketing/LegalPrintButton";

export function LegalShell({
  slug,
  children,
}: {
  slug: DocumentoLegalSlug;
  children: React.ReactNode;
}) {
  const doc = getDocumentoLegal(slug);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
      <Link
        href="/legal"
        className="legal-no-print inline-flex items-center gap-1.5 text-[13px] text-white/55 transition-colors hover:text-white"
      >
        <ArrowLeft size={14} />
        Centro legal
      </Link>

      <header className="mt-5 border-b border-white/10 pb-8">
        <h1 className="max-w-3xl text-[32px] font-semibold leading-tight text-white sm:text-[40px]">
          {doc.titulo}
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/62">
          {doc.resumen}
        </p>
        <div className="legal-no-print mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/45">
          <span>
            Versión <strong className="font-semibold text-white/70">{VERSION_LEGAL}</strong>
          </span>
          <span className="hidden h-3 w-px bg-white/15 sm:inline-block" />
          <span>
            Vigente desde{" "}
            <strong className="font-semibold text-white/70">{FECHA_VIGENCIA}</strong>
          </span>
          <span className="ml-auto">
            <LegalPrintButton />
          </span>
        </div>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr] lg:gap-14">
        <aside className="legal-no-print lg:sticky lg:top-24 lg:self-start">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Documentos
          </p>
          <nav className="mt-4 flex flex-col gap-1">
            {DOCUMENTOS_LEGALES.map((d) => {
              const activo = d.slug === slug;
              return (
                <Link
                  key={d.slug}
                  href={`/legal/${d.slug}`}
                  aria-current={activo ? "page" : undefined}
                  className={`group inline-flex items-center justify-between gap-2 rounded-[8px] border px-3 py-2 text-[13px] transition-colors ${
                    activo
                      ? "border-[#a78bfa]/40 bg-white/10 font-medium text-white"
                      : "border-transparent text-white/55 hover:border-white/10 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {d.tituloCorto}
                  <ChevronRight
                    size={13}
                    className={activo ? "text-[#a78bfa]" : "opacity-0 transition-opacity group-hover:opacity-60"}
                  />
                </Link>
              );
            })}
          </nav>
        </aside>

        <article className="legal-prose min-w-0 max-w-3xl">{children}</article>
      </div>
    </div>
  );
}
