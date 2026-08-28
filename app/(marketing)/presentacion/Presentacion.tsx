"use client";

import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  CreditCard,
  Facebook,
  FileClock,
  Instagram,
  Linkedin,
  Notebook,
  Package,
  Quote,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Star,
  StarHalf,
  Table2,
  TrendingUp,
  WifiOff,
} from "lucide-react";
import { ArcaLogo } from "@/components/marketing/ArcaLogo";
import { MarketingAvatar } from "@/components/marketing/MarketingAvatar";
import { LineaTiempoVenta } from "@/components/marketing/presentacion/LineaTiempoVenta";
import { VideoBloque } from "@/components/marketing/presentacion/VideoBloque";

const VIDEO_URL =
  process.env.NEXT_PUBLIC_ARCA_PRESENTACION_VIDEO_URL ||
  "/videos/el-caos-que-conoces.mp4";

const HERO_IMG =
  "https://images.unsplash.com/photo-1753161029695-f1d1e6881257?fm=jpg&q=70&w=1100&auto=format&fit=crop";

const REDES_SOCIALES = [
  {
    nombre: "Instagram",
    href: process.env.NEXT_PUBLIC_ARCA_INSTAGRAM_URL || "https://www.instagram.com/",
    icono: Instagram,
  },
  {
    nombre: "Facebook",
    href: process.env.NEXT_PUBLIC_ARCA_FACEBOOK_URL || "https://www.facebook.com/",
    icono: Facebook,
  },
  {
    nombre: "LinkedIn",
    href: process.env.NEXT_PUBLIC_ARCA_LINKEDIN_URL || "https://www.linkedin.com/",
    icono: Linkedin,
  },
] as const;

const presentacionStyles = `
  html{scrollbar-width:thin;scrollbar-color:rgba(124,58,237,.46) #0b0416;overflow-x:clip;}
  body{overflow-x:clip;}
  html::-webkit-scrollbar,body::-webkit-scrollbar{width:7px;height:7px;}
  html::-webkit-scrollbar-track,body::-webkit-scrollbar-track{background:#0b0416;}
  html::-webkit-scrollbar-thumb,body::-webkit-scrollbar-thumb{min-height:48px;border:2px solid #0b0416;border-radius:999px;background:linear-gradient(180deg,rgba(139,92,246,.34),rgba(37,99,235,.44));}

  @keyframes arca-scan{0%{transform:translate3d(0,-120%,0)}100%{transform:translate3d(0,560%,0)}}
  @keyframes arca-floatY{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-12px,0)}}
  @keyframes arca-floatY2{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-9px,0)}}
  @keyframes arca-pulse{0%{transform:scale(.85);opacity:.6}70%{transform:scale(1.7);opacity:0}100%{opacity:0}}
  @keyframes arca-gradient-flow{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
  @keyframes arca-orb-a{0%,100%{transform:translate3d(-8vw,-4vh,0) scale(1)}50%{transform:translate3d(34vw,20vh,0) scale(1.12)}}
  @keyframes arca-orb-b{0%,100%{transform:translate3d(8vw,-8vh,0) scale(1.05)}50%{transform:translate3d(-32vw,28vh,0) scale(.92)}}
  @keyframes arca-orb-c{0%,100%{transform:translate3d(-6vw,8vh,0) scale(.95)}50%{transform:translate3d(24vw,-30vh,0) scale(1.08)}}
  @keyframes arca-check-pop{0%{transform:scale(0);opacity:0}60%{transform:scale(1.25)}100%{transform:scale(1);opacity:1}}
  @keyframes arca-spin{to{transform:rotate(360deg)}}
  @keyframes arca-marquee-l{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}
  @keyframes arca-marquee-r{from{transform:translate3d(-50%,0,0)}to{transform:translate3d(0,0,0)}}

  .arca-rainbow,.arca-grad-text{background:linear-gradient(90deg,#c4b5fd,#60a5fa,#e9d5ff,#a78bfa,#c4b5fd);background-size:240% 100%;background-clip:text;-webkit-background-clip:text;color:transparent;-webkit-text-fill-color:transparent;animation:arca-gradient-flow 6s ease-in-out infinite;}
  .arca-orb{position:absolute;border-radius:9999px;contain:strict;backface-visibility:hidden;will-change:transform;pointer-events:none;}
  .arca-orb-a{left:-12vmin;top:-8vmin;width:58vmin;height:58vmin;background:radial-gradient(circle,rgba(168,85,247,.92) 0%,rgba(124,58,237,.52) 42%,rgba(124,58,237,0) 72%);animation:arca-orb-a 18s ease-in-out infinite;}
  .arca-orb-b{right:-14vmin;top:10vh;width:64vmin;height:64vmin;background:radial-gradient(circle,rgba(37,99,235,.9) 0%,rgba(79,70,229,.48) 44%,rgba(37,99,235,0) 72%);animation:arca-orb-b 23s ease-in-out infinite;}
  .arca-orb-c{left:22vw;bottom:-24vmin;width:60vmin;height:60vmin;background:radial-gradient(circle,rgba(192,38,211,.78) 0%,rgba(109,40,217,.44) 43%,rgba(109,40,217,0) 72%);animation:arca-orb-c 27s ease-in-out infinite;}
  .arca-scanline{position:absolute;left:0;right:0;top:0;height:34%;background:linear-gradient(180deg,transparent,rgba(167,139,250,.16),transparent);animation:arca-scan 6s ease-in-out infinite;pointer-events:none;z-index:20;}
  .arca-tilt{transition:transform .5s cubic-bezier(.16,1,.3,1),box-shadow .5s cubic-bezier(.16,1,.3,1),border-color .5s ease,background-color .5s ease;}
  .arca-tilt:hover{transform:translateY(-6px);}
  .arca-check-pop{animation:arca-check-pop .4s cubic-bezier(.16,1,.3,1) both;}

  .arca-gradborder{position:relative;padding:1.5px;border-radius:18px;overflow:hidden;}
  .arca-gradborder::before{content:"";position:absolute;inset:-150%;background:conic-gradient(from 0deg,#7c3aed,#2563eb,#22d3ee,#a855f7,#ec4899,#7c3aed);animation:arca-spin 7s linear infinite;}
  .arca-gradborder>*{position:relative;border-radius:16.5px;height:100%;}

  .arca-marquee-wrap{position:relative;width:100%;max-width:100%;overflow:hidden;overflow-x:clip;contain:paint;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);}
  .arca-marquee{display:flex;max-width:none;gap:1rem;width:max-content;will-change:transform;animation:arca-marquee-l 60s linear infinite;}
  .arca-marquee.rev{animation-name:arca-marquee-r;animation-duration:72s;}
  .arca-marquee-wrap:hover .arca-marquee{animation-play-state:paused;}

  @media (max-width:767px){
    .arca-orb-a{width:82vmin;height:82vmin;}
    .arca-orb-b{width:88vmin;height:88vmin;}
    .arca-orb-c{display:none;}
  }
  @media (prefers-reduced-motion: reduce){
    .arca-rainbow,.arca-grad-text,.arca-orb,.arca-scanline,.arca-gradborder::before,.arca-marquee{animation:none !important;}
    .arca-marquee{transform:none !important;}
  }
`;

function floatingOrbs() {
  return (
    <div aria-hidden className="fixed inset-0 z-0 overflow-hidden bg-[#0b0416]">
      <div className="arca-orb arca-orb-a" />
      <div className="arca-orb arca-orb-b" />
      <div className="arca-orb arca-orb-c" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
    </div>
  );
}

function stars({ rating, size = 15 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5 text-[#fbbf24]">
      {[1, 2, 3, 4, 5].map((estrella) => {
        if (rating >= estrella) return <Star key={estrella} size={size} fill="currentColor" />;
        if (rating >= estrella - 0.5) {
          return <StarHalf key={estrella} size={size} fill="currentColor" />;
        }
        return <Star key={estrella} size={size} className="text-white/20" />;
      })}
    </div>
  );
}

/* ---------------- Video ---------------- */

/* ---------------- Timeline animada de una venta ---------------- */

/* ---------------- Datos ---------------- */

const dolores = [
  { icon: Table2, texto: "Tu información vive en cinco Excel distintos que nadie logra cuadrar." },
  { icon: Notebook, texto: "El cuaderno de fiado se pierde y nunca sabes cuánto te deben de verdad." },
  { icon: Package, texto: 'Compras inventario "a ojo" y terminas con productos vencidos o sin stock.' },
  { icon: AlertTriangle, texto: "Al final del mes no sabes si ganaste o perdiste dinero." },
  { icon: FileClock, texto: "El contador siempre trabaja con datos atrasados y a última hora." },
  { icon: WifiOff, texto: "Si se cae el internet, se cae la venta y se detiene el negocio." },
];

const modulos = [
  { icon: ShoppingCart, titulo: "Punto de venta", texto: "Vende y cobra en segundos, con descuentos, pagos mixtos y ticket al instante." },
  { icon: Package, titulo: "Inventario vivo", texto: "Existencias, lotes y vencimientos actualizados con cada venta y compra." },
  { icon: Receipt, titulo: "Facturación fiscal", texto: "Documentos válidos por país, con secuencias y respaldo de cada venta." },
  { icon: BookOpen, titulo: "Contabilidad automática", texto: "Cada movimiento genera su asiento. Sin volver a digitar nada." },
  { icon: BarChart3, titulo: "Reportes para decidir", texto: "Ventas, margen, cuentas por cobrar y stock bajo en una sola vista." },
  { icon: ShieldCheck, titulo: "Control y permisos", texto: "Cada empleado ve solo lo suyo. Tú ves todo, aunque no estés en el local." },
];

const beneficios = [
  "Empieza a vender en menos de 10 minutos",
  "Pensado para Honduras, Nicaragua, Guatemala, Costa Rica y El Salvador",
  "Funciona aunque se caiga el internet",
  "Soporte humano en español",
];

type Testimonio = {
  nombre: string;
  puesto: string;
  texto: string;
  foto: string;
  rating: number;
};

const testimonios: Testimonio[] = [
  {
    nombre: "Carlos Mendoza",
    puesto: "Propietario",
    texto:
      "Antes perdíamos mucho tiempo revisando inventario manualmente. Ahora toda la información está organizada y disponible en segundos.",
    foto: "https://randomuser.me/api/portraits/men/32.jpg",
    rating: 5,
  },
  {
    nombre: "Andrea López",
    puesto: "Administradora",
    texto:
      "La plataforma es muy fácil de utilizar. En pocos días todo el equipo ya trabajaba con el sistema sin complicaciones.",
    foto: "https://randomuser.me/api/portraits/women/44.jpg",
    rating: 4.5,
  },
  {
    nombre: "José Ramírez",
    puesto: "Gerente General",
    texto:
      "Lo que más valoro es poder supervisar el negocio incluso cuando no estoy presente. Tengo información actualizada en cualquier momento.",
    foto: "https://randomuser.me/api/portraits/men/75.jpg",
    rating: 5,
  },
  {
    nombre: "Daniela Ruiz",
    puesto: "Encargada de Inventario",
    texto:
      "Las alertas y el control del inventario nos ayudaron a reducir errores que antes eran muy frecuentes.",
    foto: "https://randomuser.me/api/portraits/women/68.jpg",
    rating: 4,
  },
  {
    nombre: "Miguel Herrera",
    puesto: "Director Operativo",
    texto:
      "Buscábamos una plataforma moderna y estable. Arca nos permitió organizar procesos que antes dependían completamente de hojas de cálculo.",
    foto: "https://randomuser.me/api/portraits/men/11.jpg",
    rating: 5,
  },
  {
    nombre: "Sofía Martínez",
    puesto: "Supervisora Administrativa",
    texto:
      "El sistema nos dio una visión mucho más clara del movimiento diario del negocio. Ahora las decisiones son más rápidas.",
    foto: "https://randomuser.me/api/portraits/women/29.jpg",
    rating: 4.5,
  },
  {
    nombre: "Luis Castillo",
    puesto: "Propietario",
    texto:
      "El soporte ha sido excelente y la implementación fue mucho más sencilla de lo que esperábamos.",
    foto: "https://randomuser.me/api/portraits/men/52.jpg",
    rating: 5,
  },
  {
    nombre: "Karen Flores",
    puesto: "Coordinadora Comercial",
    texto:
      "Centralizar la información en una sola plataforma hizo que todo el equipo trabajara de forma mucho más organizada.",
    foto: "https://randomuser.me/api/portraits/women/90.jpg",
    rating: 4.5,
  },
  {
    nombre: "Ricardo Gómez",
    puesto: "Gerente Administrativo",
    texto:
      "Pasamos de procesos manuales a una operación mucho más eficiente. La diferencia se nota desde las primeras semanas.",
    foto: "https://randomuser.me/api/portraits/men/83.jpg",
    rating: 4,
  },
  {
    nombre: "María Fernández",
    puesto: "Encargada de Operaciones",
    texto:
      "La plataforma transmite confianza. Es rápida, intuitiva y realmente ayuda a mantener el control del negocio.",
    foto: "https://randomuser.me/api/portraits/women/12.jpg",
    rating: 5,
  },
  {
    nombre: "Javier Morales",
    puesto: "Director Comercial",
    texto:
      "Lo que más nos convenció fue la facilidad para acceder a la información y el ahorro de tiempo en las tareas diarias.",
    foto: "https://randomuser.me/api/portraits/men/45.jpg",
    rating: 4.5,
  },
  {
    nombre: "Valeria Navarro",
    puesto: "Administradora General",
    texto:
      "Más que un sistema, sentimos que ahora tenemos una herramienta que acompaña el crecimiento de nuestro negocio.",
    foto: "https://randomuser.me/api/portraits/women/65.jpg",
    rating: 5,
  },
];

function testimonioCard({ testimonio, keySuffix }: { testimonio: Testimonio; keySuffix: string }) {
  return (
    <figure key={`${testimonio.nombre}:${keySuffix}`} className="arca-tilt flex min-h-[224px] w-[330px] flex-shrink-0 flex-col rounded-[14px] border border-white/12 bg-[#190c2d]/95 p-6 hover:border-[#a78bfa]/50 hover:shadow-[0_24px_60px_rgba(124,58,237,0.28)] sm:w-[360px]">
      <div className="flex items-center justify-between">
        {stars({ rating: testimonio.rating })}
        <Quote size={26} className="text-[#a78bfa]/35" />
      </div>
      <blockquote className="mt-4 flex-1 text-[14px] leading-7 text-white/80">
        “{testimonio.texto}”
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
        <MarketingAvatar nombre={testimonio.nombre} foto={testimonio.foto} />
        <div>
          <p className="text-[14px] font-semibold text-white">{testimonio.nombre}</p>
          <p className="text-[12px] text-white/55">{testimonio.puesto}</p>
        </div>
      </figcaption>
    </figure>
  );
}

function testimoniosSection() {
  const fila1 = testimonios.slice(0, 6);
  const fila2 = testimonios.slice(6);

  return (
    <section className="relative overflow-hidden py-24 text-white">
      <div className="relative">
        <div className="mx-auto max-w-2xl px-5 text-center sm:px-8">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
            Confianza
          </span>
          <h2 className="mt-3 text-[36px] font-semibold leading-tight">
            Negocios reales que ya trabajan con <span className="arca-grad-text">ARCA</span>.
          </h2>
          <p className="mt-4 text-[16px] leading-7 text-white/62">
            Equipos que dejaron atrás las hojas de cálculo y hoy operan con orden,
            claridad y control en tiempo real.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          <div className="arca-marquee-wrap">
            <div className="arca-marquee">
              {fila1.map((testimonio) => testimonioCard({ testimonio, keySuffix: "ida" }))}
              {fila1.map((testimonio) => testimonioCard({ testimonio, keySuffix: "vuelta" }))}
            </div>
          </div>
          <div className="arca-marquee-wrap">
            <div className="arca-marquee rev">
              {fila2.map((testimonio) => testimonioCard({ testimonio, keySuffix: "ida" }))}
              {fila2.map((testimonio) => testimonioCard({ testimonio, keySuffix: "vuelta" }))}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 text-center">
          <div className="flex items-center gap-2">
            {stars({ rating: 4.5, size: 16 })}
            <span className="text-[14px] font-medium text-white/80">
              4.5 de calificación promedio
            </span>
          </div>
          <span className="text-[13px] text-white/45">
            Ferreterías · Farmacias · Distribuidoras y más
          </span>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Página ---------------- */

export function Presentacion() {
  return presentacionContent();
}

function presentacionContent() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: presentacionStyles }} />
      {floatingOrbs()}

      <header className="fixed inset-x-0 top-0 z-50 bg-[#0b0416]/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <ArcaLogo className="h-8 w-auto" eager />
            <span className="text-base font-semibold text-white">ARCA</span>
          </Link>
          <Link
            href="/registro"
            className="arca-btn arca-btn-sm bg-white text-[#160827] transition-colors hover:bg-[#efe7ff]"
          >
            Empieza gratis
          </Link>
        </div>
      </header>

      <main className="relative z-10 overflow-hidden text-white">
        {/* 1 · MÍRALO EN ACCIÓN (primero) */}
        <section
          id="video"
          className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(36,16,90,0.36)_0%,rgba(18,60,255,0.12)_55%,transparent_100%)] pt-28 pb-16 sm:pt-32"
        >
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
                Míralo en acción
              </span>
              <h1 className="mt-3 text-[38px] font-semibold leading-[1.05] sm:text-[50px]">
                Conoce ARCA en <span className="arca-rainbow">90 segundos</span>.
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-[17px] leading-8 text-white/70">
                Un recorrido rápido por lo que ARCA hace por tu negocio todos los días:
                vender, controlar el inventario y llevar la contabilidad, todo conectado.
              </p>
            </div>
            <div className="mt-10">
              <VideoBloque videoUrl={VIDEO_URL} heroImg={HERO_IMG} />
            </div>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/registro"
                className="arca-btn arca-btn-lg group bg-white text-[#160827] shadow-[0_18px_40px_rgba(255,255,255,0.18)] transition hover:-translate-y-0.5 hover:bg-[#efe7ff]"
              >
                Empezar prueba gratis
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/precios"
                className="arca-btn arca-btn-lg border-white/18 bg-white/10 text-white transition hover:-translate-y-0.5 hover:bg-white/16"
              >
                Ver planes y precios
              </Link>
            </div>
          </div>
        </section>

        {/* 2 · HERO con imagen de persona */}
        <section className="relative overflow-hidden py-16 sm:py-20">
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <h2 className="text-[38px] font-semibold leading-[1.06] sm:text-[52px]">
                Tu negocio completo en <span className="arca-rainbow">un solo sistema</span>.
              </h2>
              <p className="mt-5 max-w-xl text-[17px] leading-8 text-white/70">
                ARCA conecta tu <strong className="text-white">punto de venta</strong>, tu{" "}
                <strong className="text-white">inventario</strong> y tu{" "}
                <strong className="text-white">contabilidad</strong> en una sola plataforma.
                Vendes, y todo lo demás se actualiza solo. Adiós al Excel y al cuaderno de fiado.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/registro"
                  className="arca-btn arca-btn-lg group bg-white text-[#160827] shadow-[0_18px_40px_rgba(255,255,255,0.18)] transition hover:-translate-y-0.5 hover:bg-[#efe7ff]"
                >
                  Crear mi cuenta gratis
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/precios"
                  className="arca-btn arca-btn-lg border-white/18 bg-white/10 text-white transition hover:-translate-y-0.5 hover:bg-white/16"
                >
                  Ver planes
                </Link>
              </div>

              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/65">
                {["Sin tarjeta", "Sin contrato", "Listo en 10 minutos"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Check size={14} className="text-[#34a853]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative animate-[arca-floatY_9s_ease-in-out_infinite]">
              <div className="absolute -inset-4 bg-[linear-gradient(120deg,rgba(124,58,237,0.4),rgba(37,99,235,0.36),rgba(168,85,247,0.34))] blur-3xl" />
              <div className="relative overflow-hidden rounded-[20px] border border-white/15 shadow-[0_40px_110px_rgba(9,4,20,0.65)]">
                <Image
                  src={HERO_IMG}
                  alt="Dueña de negocio administrando su tienda con ARCA"
                  width={1100}
                  height={825}
                  priority
                  sizes="(min-width: 1024px) 42vw, 100vw"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(11,4,22,0.55))]" />
              </div>

              <div className="absolute left-3 top-4 flex items-center gap-2 rounded-[10px] border border-white/15 bg-[#160827]/90 px-3 py-2 text-white shadow-[0_14px_34px_rgba(9,4,20,0.5)] backdrop-blur-md [animation:arca-floatY2_5s_ease-in-out_infinite]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#16803c] text-white">
                  <Check size={13} strokeWidth={3} />
                </span>
                <span className="text-[12px] font-medium">Venta registrada</span>
              </div>

              <div className="absolute bottom-4 right-3 rounded-[10px] border border-white/15 bg-[#160827]/90 px-3 py-2 text-white shadow-[0_14px_34px_rgba(9,4,20,0.5)] backdrop-blur-md [animation:arca-floatY2_5.6s_ease-in-out_infinite]">
                <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                  <TrendingUp size={13} className="text-[#34d399]" /> Ventas hoy
                </div>
                <p className="mt-0.5 text-[15px] font-semibold">C$ 48,260</p>
              </div>
            </div>
          </div>
        </section>

        {/* 3 · ¿TE SUENA FAMILIAR? */}
        <section className="relative overflow-hidden py-20">
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
                ¿Te suena familiar?
              </span>
              <h2 className="mt-3 text-[32px] font-semibold leading-tight sm:text-[38px]">
                Administrar tu negocio <span className="arca-grad-text">a ciegas</span> cuesta caro.
              </h2>
              <p className="mt-4 text-[16px] leading-7 text-white/65">
                La mayoría de negocios pierde tiempo y dinero por tener todo separado y desordenado.
                Si vives alguna de estas, ARCA es para ti.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dolores.map(({ icon: Icon, texto }) => (
                <div
                  key={texto}
                  className="arca-tilt flex items-start gap-3 rounded-[14px] border border-white/10 bg-[#1b0d31]/85 p-5 hover:border-[#a78bfa]/50"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-[#3b1d2b] text-[#fca5a5]">
                    <Icon size={17} />
                  </div>
                  <p className="text-[14px] leading-6 text-white/78">{texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4 · LA SOLUCIÓN */}
        <section className="relative overflow-hidden py-20">
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
                La solución
              </span>
              <h2 className="mt-3 text-[32px] font-semibold leading-tight sm:text-[38px]">
                Todo lo que tu negocio necesita, <span className="arca-grad-text">conectado</span>.
              </h2>
              <p className="mt-4 text-[16px] leading-7 text-white/65">
                No son seis programas distintos. Es uno solo donde cada área conversa con las demás.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {modulos.map(({ icon: Icon, titulo, texto }) => (
                <div
                  key={titulo}
                  className="arca-tilt group rounded-[14px] border border-white/10 bg-[linear-gradient(160deg,rgba(51,24,88,0.94),rgba(18,20,63,0.92))] p-6 hover:border-[#a78bfa]/50 hover:shadow-[0_24px_60px_rgba(124,58,237,0.28)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#7c3aed,#2563eb)] text-white shadow-[0_10px_24px_rgba(124,58,237,0.4)] transition group-hover:scale-110">
                    <Icon size={21} />
                  </div>
                  <h3 className="mt-5 text-[17px] font-semibold text-white">{titulo}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-white/60">{texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5 · UNA VENTA → LÍNEA DE TIEMPO ANIMADA */}
        <section className="relative overflow-hidden py-20 text-white">
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
                Así trabaja ARCA por ti
              </span>
              <h2 className="mt-3 text-[32px] font-semibold leading-tight sm:text-[38px]">
                Una venta enciende <span className="arca-grad-text">seis procesos</span> automáticos.
              </h2>
              <p className="mt-4 text-[16px] leading-7 text-white/65">
                Mira, paso a paso, todo lo que pasa detrás cada vez que registras una venta.
              </p>
            </div>

            <div className="mt-14">
              <LineaTiempoVenta />
            </div>
          </div>
        </section>

        {/* 6 · TESTIMONIOS */}
        {testimoniosSection()}

        {/* 7 · CTA FINAL (mismo estilo que la landing principal) */}
        <section className="relative overflow-hidden py-20 text-white">
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  Siguiente paso
                </span>
                <h2 className="mt-3 max-w-3xl text-[38px] font-semibold leading-tight">
                  Deja de administrar tu negocio <span className="arca-grad-text">a ciegas</span>.
                </h2>
                <p className="mt-4 max-w-2xl text-[16px] leading-7 text-white/65">
                  Une operación, finanzas y decisiones en una plataforma que acompaña a
                  tu equipo desde el primer día.
                </p>
                <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/65">
                  {["Sin tarjeta", "Sin contrato", "Soporte en español"].map((item) => (
                    <li key={item} className="flex items-center gap-1.5">
                      <Check size={14} className="text-[#34a853]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link
                  href="/registro"
                  className="arca-btn arca-btn-lg bg-white text-[#160827] transition hover:-translate-y-0.5 hover:bg-[#efe7ff]"
                >
                  Empezar prueba gratis
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/precios"
                  className="arca-btn arca-btn-lg border border-white/25 bg-transparent text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Ver planes
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER (mismo que la landing principal) */}
      <footer className="relative z-10 -mt-20 overflow-hidden bg-[linear-gradient(180deg,rgba(11,4,22,0)_0%,rgba(8,3,17,0.72)_24%,#080311_58%,#07020f_100%)] pt-36 text-white">
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid gap-12 pb-14 lg:grid-cols-[1.05fr_1.35fr] lg:gap-20">
            <div>
              <Link href="/" className="inline-flex items-center gap-3">
                <ArcaLogo className="h-11 w-auto" />
                <span className="text-[20px] font-semibold tracking-[-0.02em]">ARCA</span>
              </Link>

              <p className="mt-6 max-w-md text-[18px] font-medium leading-7 text-white/88">
                Un sistema para operar, controlar y hacer crecer tu negocio con claridad.
              </p>
              <p className="mt-3 max-w-md text-[14px] leading-6 text-white/50">
                Ventas, inventario, facturación y contabilidad conectados para que tu
                equipo trabaje con la misma información.
              </p>

              <div className="mt-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                  Síguenos
                </p>
                <div className="mt-3 flex items-center gap-2.5">
                  {REDES_SOCIALES.map(({ nombre, href, icono: Icono }) => (
                    <a
                      key={nombre}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${nombre} de ARCA`}
                      title={nombre}
                      className="group flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/55 transition duration-300 hover:-translate-y-0.5 hover:border-[#a78bfa]/55 hover:bg-white/[0.09] hover:text-white hover:shadow-[0_10px_28px_rgba(124,58,237,0.24)]"
                    >
                      <Icono
                        size={17}
                        strokeWidth={1.8}
                        className="transition-transform duration-300 group-hover:scale-105"
                      />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
              <nav aria-label="Producto">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                  Producto
                </p>
                <div className="mt-5 flex flex-col gap-3.5">
                  {[
                    ["Qué es ARCA", "/#caracteristicas"],
                    ["Módulos", "/#modulos"],
                    ["Calculadora", "/#calculadora"],
                    ["Tu viaje", "/#viaje"],
                    ["Precios", "/precios"],
                    ["Preguntas frecuentes", "/#faq"],
                  ].map(([label, href]) => (
                    <Link
                      key={href}
                      href={href}
                      className="group inline-flex w-fit items-center gap-1.5 text-[13px] text-white/58 transition-colors hover:text-white"
                    >
                      {label}
                      <ChevronRight
                        size={13}
                        className="opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100"
                      />
                    </Link>
                  ))}
                </div>
              </nav>

              <nav aria-label="Cuenta">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                  Cuenta
                </p>
                <div className="mt-5 flex flex-col gap-3.5">
                  {[
                    ["Crear cuenta", "/registro"],
                    ["Iniciar sesión", "/login"],
                    ["Recuperar acceso", "/recuperar"],
                  ].map(([label, href]) => (
                    <Link
                      key={href}
                      href={href}
                      className="group inline-flex w-fit items-center gap-1.5 text-[13px] text-white/58 transition-colors hover:text-white"
                    >
                      {label}
                      <ChevronRight
                        size={13}
                        className="opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100"
                      />
                    </Link>
                  ))}
                </div>
              </nav>

              <div className="col-span-2 sm:col-span-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                  Confianza
                </p>
                <ul className="mt-5 flex flex-col gap-3.5 text-[13px] text-white/58">
                  {["Roles y permisos", "Copias de seguridad", "Soporte en español"].map(
                    (item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-[#a78bfa]" />
                        {item}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div className="h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)]" />

          <nav
            aria-label="Legal"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-6 text-[12px] text-white/45"
          >
            {[
              ["Términos y Condiciones", "/legal/terminos"],
              ["Privacidad", "/legal/privacidad"],
              ["Cookies", "/legal/cookies"],
              ["Tratamiento de Datos", "/legal/tratamiento-datos"],
              ["Uso Aceptable", "/legal/uso-aceptable"],
              ["Inteligencia Artificial", "/legal/inteligencia-artificial"],
              ["Centro legal", "/legal"],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="transition-colors hover:text-white">
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 flex flex-col gap-4 py-7 text-[12px] text-white/38 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} ARCA. Todos los derechos reservados.</span>
            <span className="max-w-xl sm:text-right">
              Honduras · Nicaragua · Guatemala · Costa Rica · El Salvador
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
