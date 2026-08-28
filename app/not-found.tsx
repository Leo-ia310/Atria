import type { Metadata } from "next";
import Link from "next/link";
import { ArcaLogo } from "@/components/marketing/ArcaLogo";

export const metadata: Metadata = {
  title: "Página no encontrada",
  description: "La página que buscas no existe o fue movida.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0b0416] px-5 py-20 text-center text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-[10vmin] -top-[8vmin] h-[54vmin] w-[54vmin] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.5),transparent_70%)] blur-3xl" />
        <div className="absolute -right-[12vmin] top-[18vh] h-[58vmin] w-[58vmin] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.45),transparent_70%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <Link href="/" className="mb-10 inline-flex items-center gap-2.5">
          <ArcaLogo className="h-9 w-auto" eager />
          <span className="text-[20px] font-semibold tracking-[-0.02em]">ARCA</span>
        </Link>

        <p className="text-[88px] font-bold leading-none tracking-tight text-transparent [background:linear-gradient(90deg,#c4b5fd,#60a5fa,#a78bfa)] [-webkit-background-clip:text] [background-clip:text] sm:text-[120px]">
          404
        </p>

        <h1 className="mt-4 text-[26px] font-semibold sm:text-[32px]">
          Esta página no existe
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-7 text-white/60">
          El enlace que seguiste puede estar roto o la página fue movida. Volvamos
          a un lugar seguro.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="arca-btn arca-btn-lg bg-white text-[#160827] transition hover:-translate-y-0.5 hover:bg-[#efe7ff]"
          >
            Volver al inicio
          </Link>
          <Link
            href="/dashboard"
            className="arca-btn arca-btn-lg border border-white/25 bg-transparent text-white transition hover:-translate-y-0.5 hover:bg-white/10"
          >
            Ir a mi panel
          </Link>
        </div>
      </div>
    </main>
  );
}
