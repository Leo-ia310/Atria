import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ScrollText } from "lucide-react";
import {
  DOCUMENTOS_LEGALES,
  FECHA_VIGENCIA,
  INFO_LEGAL,
  VERSION_LEGAL,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Centro legal",
  description:
    "Términos y Condiciones, Política de Privacidad, Cookies, Tratamiento de Datos, Uso Aceptable e Inteligencia Artificial de ARCA.",
};

export default function CentroLegalPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
      <div className="max-w-3xl">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
          Centro legal
        </span>
        <h1 className="mt-3 text-[36px] font-semibold leading-tight text-white sm:text-[44px]">
          Reglas claras para operar con confianza.
        </h1>
        <p className="mt-4 text-[16px] leading-7 text-white/62">
          Aquí encuentras todos los documentos que rigen tu relación con {INFO_LEGAL.marca}:
          qué puedes esperar de nosotros, qué esperamos de ti y cómo cuidamos la
          información de tu negocio y la de tus clientes. Están escritos para leerse,
          no solo para archivarse.
        </p>
        <p className="mt-3 text-[13px] text-white/40">
          Versión {VERSION_LEGAL} · Vigente desde {FECHA_VIGENCIA}
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {DOCUMENTOS_LEGALES.map((d) => (
          <Link
            key={d.slug}
            href={`/legal/${d.slug}`}
            className="group flex flex-col rounded-[14px] border border-white/10 bg-[linear-gradient(160deg,rgba(51,24,88,0.55),rgba(18,20,63,0.5))] p-6 transition-colors hover:border-[#a78bfa]/50"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#7c3aed,#2563eb)] text-white shadow-[0_10px_24px_rgba(124,58,237,0.35)]">
              <ScrollText size={20} />
            </div>
            <h2 className="mt-5 text-[18px] font-semibold text-white">{d.titulo}</h2>
            <p className="mt-2 flex-1 text-[13px] leading-6 text-white/58">{d.resumen}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#c4b5fd]">
              Leer documento
              <ArrowRight
                size={14}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-10 max-w-3xl text-[13px] leading-6 text-white/40">
        Estos documentos son de carácter general y no constituyen asesoría legal
        individualizada. Ante cualquier duda sobre su alcance para tu caso concreto,
        consulta con tu asesor legal.
      </p>
    </div>
  );
}
