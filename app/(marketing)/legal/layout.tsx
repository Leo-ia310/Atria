import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { ArcaLogo } from "@/components/marketing/ArcaLogo";
import { DOCUMENTOS_LEGALES, INFO_LEGAL } from "@/lib/legal";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0416] text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-[10vmin] -top-[8vmin] h-[52vmin] w-[52vmin] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.42)_0%,rgba(124,58,237,0)_70%)]" />
        <div className="absolute -right-[12vmin] top-[20vh] h-[56vmin] w-[56vmin] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.34)_0%,rgba(37,99,235,0)_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <Nav />

      <main className="relative z-10">{children}</main>

      <footer className="legal-no-print relative z-10 border-t border-white/10 bg-[#080311]/80">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div>
              <Link href="/" className="inline-flex items-center gap-2.5">
                <ArcaLogo className="h-9 w-auto" />
                <span className="text-[18px] font-semibold">ARCA</span>
              </Link>
              <p className="mt-3 max-w-sm text-[13px] leading-6 text-white/45">
                ¿Dudas sobre estos documentos? Escríbenos a{" "}
                <a
                  href={`mailto:${INFO_LEGAL.correoLegal}`}
                  className="text-[#c4b5fd] underline underline-offset-2 hover:text-[#e9d5ff]"
                >
                  {INFO_LEGAL.correoLegal}
                </a>
                .
              </p>
            </div>
            <nav aria-label="Documentos legales" className="flex flex-col gap-2.5">
              {DOCUMENTOS_LEGALES.map((d) => (
                <Link
                  key={d.slug}
                  href={`/legal/${d.slug}`}
                  className="text-[13px] text-white/55 transition-colors hover:text-white"
                >
                  {d.tituloCorto}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-8 border-t border-white/10 pt-6 text-[12px] text-white/35">
            © {new Date().getFullYear()} {INFO_LEGAL.marca}. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
