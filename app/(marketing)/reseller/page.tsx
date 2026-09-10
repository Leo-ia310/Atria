import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  Check,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { ArcaLogo } from "@/components/marketing/ArcaLogo";
import { INFO_LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Reseller | ARCA",
  description: "Crece tu red con ARCA y recibe ingresos por cada cliente activo.",
  alternates: { canonical: "/reseller" },
};

const beneficios = [
  "Un programa claro para recomendar ARCA a nuevos negocios.",
  "Ingresos por la primera venta y por pagos mensuales activos.",
  "Un producto diseñado para ventas, inventario y finanzas en un solo lugar.",
];

export default function ResellerPage() {
  const solicitudHref = `mailto:${INFO_LEGAL.correoSoporte}?subject=${encodeURIComponent("Quiero ser reseller de ARCA")}`;

  return (
    <main className="min-h-screen overflow-hidden bg-[#0b0416] text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <header className="relative border-b border-white/10 bg-[#0b0416]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <ArcaLogo className="h-8 w-auto" eager />
            <span className="text-base font-semibold">ARCA</span>
          </Link>
          <Link
            href="/"
            className="text-[13px] font-medium text-white/70 transition-colors hover:text-white"
          >
            Volver a ARCA
          </Link>
        </div>
      </header>

      <section className="relative py-20 sm:py-28">
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.9fr)] lg:items-center">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
                Programa Reseller
              </span>
              <h1 className="mt-4 max-w-3xl text-[42px] font-semibold leading-tight sm:text-[58px]">
                Haz crecer tu red con <span className="text-[#c4b5fd]">ARCA</span>.
              </h1>
              <p className="mt-5 max-w-2xl text-[17px] leading-8 text-white/70">
                Recomienda una plataforma que ayuda a los negocios a vender, controlar
                su inventario y llevar sus finanzas en orden. Cuando tus clientes crecen,
                tú también.
              </p>
              <a
                href={solicitudHref}
                className="arca-btn arca-btn-lg mt-8 bg-white text-[#160827] transition hover:-translate-y-0.5 hover:bg-[#efe7ff]"
              >
                Quiero ser reseller
                <ArrowRight size={16} />
              </a>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <article className="min-h-[250px] rounded-[12px] border border-[#c4b5fd]/35 bg-[#20103a]/90 p-7 shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-white text-[#5b21b6]">
                  <BadgePercent size={21} />
                </div>
                <p className="mt-9 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#c4b5fd]">
                  Primera venta
                </p>
                <p className="mt-2 text-[48px] font-semibold leading-none">20%</p>
                <p className="mt-4 text-[14px] leading-6 text-white/60">
                  Recibe el 20% cuando tu cliente realiza su primer pago.
                </p>
              </article>

              <article className="min-h-[250px] rounded-[12px] border border-white/15 bg-white/[0.07] p-7 shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#60a5fa] text-[#0b1733]">
                  <RefreshCw size={20} />
                </div>
                <p className="mt-9 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#93c5fd]">
                  Cada mes
                </p>
                <p className="mt-2 text-[48px] font-semibold leading-none">10%</p>
                <p className="mt-4 text-[14px] leading-6 text-white/60">
                  Recibe el 10% mensual mientras tu cliente siga pagando ARCA.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/10 bg-black/15 py-16">
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid gap-8 md:grid-cols-[0.65fr_1fr] md:items-center">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">
                Una relación que continúa
              </span>
              <h2 className="mt-3 text-[30px] font-semibold leading-tight sm:text-[36px]">
                Más que una recomendación puntual.
              </h2>
            </div>
            <ul className="grid gap-4 sm:grid-cols-3">
              {beneficios.map((beneficio, index) => {
                const Icon = index === 0 ? Users : index === 1 ? RefreshCw : ShieldCheck;
                return (
                  <li key={beneficio} className="flex gap-3 text-[14px] leading-6 text-white/70">
                    <Icon size={18} className="mt-0.5 shrink-0 text-[#c4b5fd]" />
                    {beneficio}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <section className="relative py-20 text-center">
        <div className="relative mx-auto max-w-2xl px-5 sm:px-8">
          <h2 className="text-[32px] font-semibold leading-tight sm:text-[38px]">
            Empieza a construir tu red.
          </h2>
          <p className="mt-4 text-[16px] leading-7 text-white/65">
            Cuéntanos sobre ti y te compartiremos los siguientes pasos para iniciar.
          </p>
          <a
            href={solicitudHref}
            className="arca-btn arca-btn-lg mt-7 bg-white text-[#160827] transition hover:-translate-y-0.5 hover:bg-[#efe7ff]"
          >
            Unirme al programa
            <Check size={16} />
          </a>
        </div>
      </section>
    </main>
  );
}
