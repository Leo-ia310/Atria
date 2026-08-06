"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CreditCard,
  FileClock,
  Notebook,
  Package,
  Play,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Table2,
  WifiOff,
} from "lucide-react";
import { ArcaLogo } from "@/components/marketing/ArcaLogo";

const VIDEO_URL = process.env.NEXT_PUBLIC_ARCA_PRESENTACION_VIDEO_URL || "";

const presentacionStyles = `
  html{scrollbar-width:thin;scrollbar-color:rgba(124,58,237,.46) #0b0416;overflow-x:clip;}
  body{overflow-x:clip;}
  html::-webkit-scrollbar,body::-webkit-scrollbar{width:7px;height:7px;}
  html::-webkit-scrollbar-track,body::-webkit-scrollbar-track{background:#0b0416;}
  html::-webkit-scrollbar-thumb,body::-webkit-scrollbar-thumb{min-height:48px;border:2px solid #0b0416;border-radius:999px;background:linear-gradient(180deg,rgba(139,92,246,.34),rgba(37,99,235,.44));}

  @keyframes arca-bar{from{transform:scaleY(0)}to{transform:scaleY(1)}}
  @keyframes arca-scan{0%{transform:translate3d(0,-120%,0)}100%{transform:translate3d(0,560%,0)}}
  @keyframes arca-floatY{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-12px,0)}}
  @keyframes arca-pulse{0%{transform:scale(.85);opacity:.6}70%{transform:scale(1.7);opacity:0}100%{opacity:0}}
  @keyframes arca-gradient-flow{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
  @keyframes arca-orb-a{0%,100%{transform:translate3d(-8vw,-4vh,0) scale(1)}50%{transform:translate3d(34vw,20vh,0) scale(1.12)}}
  @keyframes arca-orb-b{0%,100%{transform:translate3d(8vw,-8vh,0) scale(1.05)}50%{transform:translate3d(-32vw,28vh,0) scale(.92)}}
  @keyframes arca-orb-c{0%,100%{transform:translate3d(-6vw,8vh,0) scale(.95)}50%{transform:translate3d(24vw,-30vh,0) scale(1.08)}}

  .arca-rainbow,.arca-grad-text{background:linear-gradient(90deg,#c4b5fd,#60a5fa,#e9d5ff,#a78bfa,#c4b5fd);background-size:240% 100%;background-clip:text;-webkit-background-clip:text;color:transparent;-webkit-text-fill-color:transparent;animation:arca-gradient-flow 6s ease-in-out infinite;}
  .arca-orb{position:absolute;border-radius:9999px;contain:strict;backface-visibility:hidden;will-change:transform;pointer-events:none;}
  .arca-orb-a{left:-12vmin;top:-8vmin;width:58vmin;height:58vmin;background:radial-gradient(circle,rgba(168,85,247,.92) 0%,rgba(124,58,237,.52) 42%,rgba(124,58,237,0) 72%);animation:arca-orb-a 18s ease-in-out infinite;}
  .arca-orb-b{right:-14vmin;top:10vh;width:64vmin;height:64vmin;background:radial-gradient(circle,rgba(37,99,235,.9) 0%,rgba(79,70,229,.48) 44%,rgba(37,99,235,0) 72%);animation:arca-orb-b 23s ease-in-out infinite;}
  .arca-orb-c{left:22vw;bottom:-24vmin;width:60vmin;height:60vmin;background:radial-gradient(circle,rgba(192,38,211,.78) 0%,rgba(109,40,217,.44) 43%,rgba(109,40,217,0) 72%);animation:arca-orb-c 27s ease-in-out infinite;}
  .arca-bar{transform-origin:bottom;animation:arca-bar .9s cubic-bezier(.16,1,.3,1) both;}
  .arca-scanline{position:absolute;left:0;right:0;top:0;height:34%;background:linear-gradient(180deg,transparent,rgba(167,139,250,.16),transparent);animation:arca-scan 6s ease-in-out infinite;pointer-events:none;z-index:20;}
  .arca-tilt{transition:transform .5s cubic-bezier(.16,1,.3,1),box-shadow .5s cubic-bezier(.16,1,.3,1),border-color .5s ease,background-color .5s ease;}
  .arca-tilt:hover{transform:translateY(-6px);}

  @keyframes arca-spin{to{transform:rotate(360deg)}}
  .arca-gradborder{position:relative;padding:1.5px;border-radius:18px;overflow:hidden;}
  .arca-gradborder::before{content:"";position:absolute;inset:-150%;background:conic-gradient(from 0deg,#7c3aed,#2563eb,#22d3ee,#a855f7,#ec4899,#7c3aed);animation:arca-spin 7s linear infinite;}
  .arca-gradborder>*{position:relative;border-radius:16.5px;height:100%;}

  @media (max-width:767px){
    .arca-orb-a{width:82vmin;height:82vmin;}
    .arca-orb-b{width:88vmin;height:88vmin;}
    .arca-orb-c{display:none;}
  }
  @media (prefers-reduced-motion: reduce){
    .arca-rainbow,.arca-grad-text,.arca-orb,.arca-bar,.arca-scanline,.arca-gradborder::before{animation:none !important;}
  }
`;

function FloatingOrbs() {
  return (
    <div aria-hidden className="fixed inset-0 z-0 overflow-hidden bg-[#0b0416]">
      <div className="arca-orb arca-orb-a" />
      <div className="arca-orb arca-orb-b" />
      <div className="arca-orb arca-orb-c" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
    </div>
  );
}

function Stars({ rating, size = 15 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5 text-[#fbbf24]">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={rating >= i - 0.25 ? "currentColor" : "none"} className={rating >= i - 0.25 ? "" : "text-white/20"} />
      ))}
    </div>
  );
}

const pantallas = ["Dashboard", "Punto de venta", "Inventario"] as const;

function PantallaDashboard() {
  return (
    <div className="grid h-full gap-3 sm:grid-cols-[1.1fr_0.9fr]">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Ventas hoy", value: "C$ 48,260", color: "text-[#5b21b6]" },
            { label: "Margen", value: "34.8%", color: "text-[#0b8043]" },
            { label: "Stock bajo", value: "12 SKU", color: "text-[#b06000]" },
          ].map((item) => (
            <div key={item.label} className="rounded-[8px] border border-[#e3ebf6] bg-white p-3">
              <p className="text-[10px] text-[#7b8496]">{item.label}</p>
              <p className={`mt-1 text-[16px] font-semibold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
        <div className="flex-1 rounded-[8px] border border-[#e3ebf6] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12px] font-medium text-[#273042]">Ventas y reposición</p>
            <span className="text-[10px] text-[#7b8496]">Últimos 7 días</span>
          </div>
          <div className="flex h-32 items-end gap-2">
            {[48, 64, 42, 78, 56, 88, 72].map((height, index) => (
              <div key={index} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="arca-bar w-full rounded-t-[5px] bg-[linear-gradient(180deg,#a78bfa_0%,#2563eb_100%)]"
                  style={{ height: `${height}%`, animationDelay: `${index * 90}ms` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-[8px] border border-[#e9d5ff]/40 bg-[#190b2b] p-4 text-white">
        <p className="text-[12px] font-medium">Cierre inteligente</p>
        <p className="mt-1 text-[11px] text-white/55">Caja, inventario y asiento listos.</p>
        <div className="mt-4 space-y-2.5">
          {["Caja cuadrada", "CxC actualizada", "Libro diario"].map((item) => (
            <div key={item} className="flex items-center gap-2 text-[11px]">
              <Check size={13} className="text-[#34a853]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-[6px] bg-white/10 p-3">
          <p className="text-[9px] uppercase text-white/45">Siguiente acción</p>
          <p className="mt-1 text-[12px] font-medium">Reponer 12 productos antes del viernes.</p>
        </div>
      </div>
    </div>
  );
}

function PantallaPOS() {
  const productos = [
    { n: "Cemento gris 42.5kg", p: "C$ 385" },
    { n: 'Tubo PVC 1/2"', p: "C$ 62" },
    { n: "Pintura blanca 1gal", p: "C$ 540" },
    { n: 'Clavos 2" (lb)', p: "C$ 28" },
    { n: "Cable THHN 12", p: "C$ 18" },
    { n: "Foco LED 9W", p: "C$ 95" },
  ];
  const carrito = [
    { n: "Cemento gris 42.5kg", c: 3, t: "C$ 1,155" },
    { n: "Pintura blanca 1gal", c: 1, t: "C$ 540" },
    { n: "Foco LED 9W", c: 4, t: "C$ 380" },
  ];
  return (
    <div className="grid h-full gap-3 sm:grid-cols-[1.15fr_0.85fr]">
      <div>
        <div className="mb-2 flex items-center gap-2 rounded-[7px] border border-[#e3ebf6] bg-white px-3 py-2 text-[11px] text-[#7b8496]">
          <ShoppingCart size={13} className="text-[#5b21b6]" />
          Buscar producto o escanear código…
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {productos.map((item) => (
            <div key={item.n} className="rounded-[7px] border border-[#e3ebf6] bg-white p-2.5 transition hover:border-[#c4b5fd] hover:shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-[6px] bg-[linear-gradient(135deg,#f0e7ff,#eef2ff)] text-[#5b21b6]">
                <Package size={15} />
              </div>
              <p className="mt-2 line-clamp-2 text-[10px] font-medium leading-tight text-[#273042]">{item.n}</p>
              <p className="mt-1 text-[11px] font-semibold text-[#5b21b6]">{item.p}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col rounded-[8px] border border-[#e3ebf6] bg-white p-3">
        <p className="text-[12px] font-semibold text-[#273042]">Ticket #1042</p>
        <div className="mt-2 flex-1 space-y-2">
          {carrito.map((item) => (
            <div key={item.n} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-[#5b667a]">
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-[#efe7ff] px-1 text-[9px] font-semibold text-[#5b21b6]">
                  {item.c}
                </span>
                <span className="line-clamp-1">{item.n}</span>
              </span>
              <span className="font-medium text-[#273042]">{item.t}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-[#e7edf6] pt-2">
          <div className="flex items-center justify-between text-[13px] font-semibold text-[#151b2c]">
            <span>Total</span>
            <span className="text-[#5b21b6]">C$ 2,075</span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 rounded-[7px] bg-[linear-gradient(135deg,#7c3aed,#2563eb)] py-2 text-[12px] font-semibold text-white">
            <CreditCard size={14} /> Cobrar
          </div>
        </div>
      </div>
    </div>
  );
}

function PantallaInventario() {
  const filas = [
    { n: "Cemento gris 42.5kg", sku: "CEM-425", stock: "128", estado: "ok" },
    { n: "Pintura blanca 1gal", sku: "PIN-BLA", stock: "34", estado: "ok" },
    { n: 'Tubo PVC 1/2"', sku: "PVC-012", stock: "9", estado: "bajo" },
    { n: "Foco LED 9W", sku: "LED-009", stock: "6", estado: "bajo" },
    { n: "Cable THHN 12", sku: "CAB-012", stock: "260", estado: "ok" },
  ];
  return (
    <div className="h-full rounded-[8px] border border-[#e3ebf6] bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#273042]">Inventario · Sucursal Central</p>
        <span className="rounded-full bg-[#efe7ff] px-2 py-0.5 text-[10px] font-medium text-[#5b21b6]">437 productos</span>
      </div>
      <div className="grid grid-cols-[1.6fr_0.8fr_0.6fr_0.8fr] gap-2 border-b border-[#e7edf6] pb-2 text-[9px] font-semibold uppercase text-[#8b95a6]">
        <span>Producto</span>
        <span>SKU</span>
        <span>Stock</span>
        <span>Estado</span>
      </div>
      {filas.map((f) => (
        <div key={f.sku} className="grid grid-cols-[1.6fr_0.8fr_0.6fr_0.8fr] items-center gap-2 border-b border-[#f0f3f8] py-2 text-[11px] last:border-b-0">
          <span className="flex items-center gap-1.5 font-medium text-[#273042]">
            <span className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-[#f4f0ff] text-[#5b21b6]">
              <Package size={12} />
            </span>
            <span className="line-clamp-1">{f.n}</span>
          </span>
          <span className="text-[#7b8496]">{f.sku}</span>
          <span className="font-semibold text-[#273042]">{f.stock}</span>
          <span>
            {f.estado === "ok" ? (
              <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-medium text-[#16803c]">En stock</span>
            ) : (
              <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[10px] font-medium text-[#b06000]">Stock bajo</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function LivePreview() {
  const [activa, setActiva] = useState(0);
  const [pausa, setPausa] = useState(false);

  useEffect(() => {
    if (pausa) return;
    const t = setInterval(() => setActiva((a) => (a + 1) % pantallas.length), 3800);
    return () => clearInterval(t);
  }, [pausa]);

  return (
    <div
      className="relative animate-[arca-floatY_9s_ease-in-out_infinite]"
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
    >
      <div className="absolute inset-x-6 -bottom-6 h-12 bg-[linear-gradient(90deg,rgba(124,58,237,0.45),rgba(37,99,235,0.42),rgba(168,85,247,0.40))] blur-2xl" />
      <div className="relative overflow-hidden rounded-[14px] border border-white/20 bg-[#0c0518]/95 shadow-[0_40px_110px_rgba(9,4,20,0.7)]">
        <div className="arca-scanline" />
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#160827] px-4 py-2.5">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ea4335]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#fbbc05]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#34a853]" />
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
            {pantallas.map((p, i) => (
              <button
                key={p}
                type="button"
                onClick={() => setActiva(i)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                  activa === i ? "bg-white text-[#160827]" : "text-white/55 hover:text-white/80"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="hidden items-center gap-1.5 text-[11px] font-medium text-[#34d399] sm:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75 [animation:arca-pulse_2s_ease-out_infinite]" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#34d399]" />
            </span>
            En vivo
          </div>
        </div>

        <div className="relative min-h-[340px] bg-[#f7f4fc] p-3 sm:min-h-[360px] sm:p-4">
          {[<PantallaDashboard key="d" />, <PantallaPOS key="p" />, <PantallaInventario key="i" />].map((pantalla, i) => (
            <div
              key={i}
              className={`absolute inset-0 p-3 transition-all duration-700 sm:p-4 ${
                activa === i ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
              }`}
            >
              {pantalla}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-1.5 border-t border-white/10 bg-[#160827] py-2.5">
          {pantallas.map((p, i) => (
            <button
              key={p}
              type="button"
              aria-label={p}
              onClick={() => setActiva(i)}
              className={`h-1.5 rounded-full transition-all ${activa === i ? "w-6 bg-[#a78bfa]" : "w-1.5 bg-white/25"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function VideoBloque() {
  const [reproducir, setReproducir] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const esArchivo = /\.(mp4|webm|mov)(\?|$)/i.test(VIDEO_URL);
  const esYoutube = /youtu\.?be/i.test(VIDEO_URL);
  const embedYoutube = esYoutube
    ? VIDEO_URL.replace("watch?v=", "embed/").replace("youtu.be/", "www.youtube.com/embed/")
    : "";

  return (
    <div className="arca-gradborder mx-auto max-w-3xl">
      <div className="relative aspect-video overflow-hidden rounded-[16px] border border-white/12 bg-[#0c0518]">
        {reproducir && esArchivo && (
          <video ref={videoRef} src={VIDEO_URL} controls autoPlay playsInline className="h-full w-full object-cover" />
        )}
        {reproducir && esYoutube && (
          <iframe
            src={`${embedYoutube}?autoplay=1`}
            title="Presentación de ARCA"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        )}
        {!reproducir && (
          <button
            type="button"
            onClick={() => VIDEO_URL && setReproducir(true)}
            className="group absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.35),rgba(12,5,24,0.9))]"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#160827] shadow-[0_18px_50px_rgba(124,58,237,0.5)] transition group-hover:scale-110">
              <Play size={26} fill="currentColor" className="ml-1" />
            </span>
            <span className="text-[14px] font-medium text-white/85">
              {VIDEO_URL ? "Reproducir presentación" : "Video de presentación (próximamente)"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

const dolores = [
  { icon: Table2, texto: "Tu información vive en cinco Excel distintos que nadie logra cuadrar." },
  { icon: Notebook, texto: "El cuaderno de fiado se pierde y nunca sabes cuánto te deben de verdad." },
  { icon: Package, texto: "Compras inventario \"a ojo\" y terminas con productos vencidos o sin stock." },
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

const flujo = [
  { icon: ShoppingCart, label: "Venta" },
  { icon: CreditCard, label: "Caja" },
  { icon: Package, label: "Stock" },
  { icon: Receipt, label: "Factura" },
  { icon: BookOpen, label: "Contabilidad" },
  { icon: BarChart3, label: "Reportes" },
];

const beneficios = [
  "Empieza a vender en menos de 10 minutos",
  "Pensado para Honduras, Nicaragua, Guatemala, Costa Rica y El Salvador",
  "Funciona aunque se caiga el internet",
  "Soporte humano en español",
];

export function Presentacion() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: presentacionStyles }} />
      <FloatingOrbs />

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
        {/* HERO */}
        <section className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(36,16,90,0.36)_0%,rgba(18,60,255,0.12)_55%,transparent_100%)] pt-28 sm:pt-32">
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-white/80">
                <Sparkles size={14} className="text-[#c4b5fd]" />
                El sistema todo-en-uno para tu negocio
              </span>
              <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] sm:text-[54px]">
                Tu negocio completo en <span className="arca-rainbow">un solo sistema</span>.
              </h1>
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
                  Empezar prueba gratis
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#video"
                  className="arca-btn arca-btn-lg border-white/18 bg-white/10 text-white transition hover:-translate-y-0.5 hover:bg-white/16"
                >
                  <Play size={15} fill="currentColor" /> Ver en 90 segundos
                </a>
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

            <div className="lg:pl-4">
              <LivePreview />
            </div>
          </div>
        </section>

        {/* DOLOR */}
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

        {/* VIDEO */}
        <section id="video" className="relative overflow-hidden py-20 text-white">
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
                Míralo en acción
              </span>
              <h2 className="mt-3 text-[32px] font-semibold leading-tight sm:text-[38px]">
                Conoce ARCA en <span className="arca-grad-text">90 segundos</span>.
              </h2>
              <p className="mt-4 text-[16px] leading-7 text-white/65">
                Un recorrido rápido por lo que ARCA hace por tu negocio todos los días.
              </p>
            </div>
            <div className="mt-12">
              <VideoBloque />
            </div>
          </div>
        </section>

        {/* SOLUCIÓN / MÓDULOS */}
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

        {/* UNA VENTA, TODO ACTUALIZADO */}
        <section className="relative overflow-hidden py-20 text-white">
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
                Así de simple
              </span>
              <h2 className="mt-3 text-[32px] font-semibold leading-tight sm:text-[38px]">
                Una venta. <span className="arca-grad-text">Todo se actualiza solo</span>.
              </h2>
              <p className="mt-4 text-[16px] leading-7 text-white/65">
                El cajero solo cobra. Por detrás, ARCA mueve inventario, factura, contabilidad y reportes.
              </p>
            </div>

            <div className="mt-12 grid gap-3 md:grid-cols-6">
              {flujo.map(({ icon: Icon, label }, index) => (
                <div
                  key={label}
                  className="arca-tilt flex flex-col items-center rounded-[12px] border border-white/12 bg-[#1b0d31]/90 p-4 text-center hover:border-[#a78bfa]/50"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-white text-[#4c1d95] shadow-[0_8px_20px_rgba(167,139,250,0.4)]">
                    <Icon size={20} />
                  </div>
                  <p className="mt-4 text-[13px] font-medium leading-snug">{label}</p>
                  <span className="mt-3 text-[11px] text-white/40">0{index + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BENEFICIOS + PRUEBA SOCIAL */}
        <section className="relative overflow-hidden py-20 text-white">
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-[30px] font-semibold leading-tight sm:text-[36px]">
                  Hecho para negocios reales de <span className="arca-grad-text">Latinoamérica</span>.
                </h2>
                <ul className="mt-7 space-y-4">
                  {beneficios.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[15px] leading-7 text-white/80">
                      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c3aed,#2563eb)] text-white">
                        <Check size={14} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="arca-tilt rounded-[16px] border border-white/12 bg-[#190c2d]/90 p-8 text-center">
                <Stars rating={4.5} size={20} />
                <p className="mt-4 text-[18px] font-medium leading-8 text-white/85">
                  “Pasamos del cuaderno y el Excel a tener todo el negocio ordenado y bajo control.
                  La diferencia se nota desde la primera semana.”
                </p>
                <p className="mt-5 text-[13px] text-white/55">
                  Negocios que ya trabajan con ARCA · Ferreterías · Farmacias · Distribuidoras
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="relative overflow-hidden py-24 text-white">
          <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
            <h2 className="mx-auto max-w-3xl text-[36px] font-semibold leading-tight sm:text-[46px]">
              Deja de administrar tu negocio <span className="arca-grad-text">a ciegas</span>.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-8 text-white/68">
              Empieza gratis hoy. Sin tarjeta y sin contrato. En 10 minutos estás vendiendo con ARCA.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/registro"
                className="arca-btn arca-btn-lg group bg-white text-[#160827] shadow-[0_18px_40px_rgba(255,255,255,0.18)] transition hover:-translate-y-0.5 hover:bg-[#efe7ff]"
              >
                Crear mi cuenta gratis
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/precios"
                className="arca-btn arca-btn-lg border border-white/25 bg-transparent text-white transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                Ver planes y precios
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-[#07020f] py-8 text-center text-[12px] text-white/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-5 sm:px-8">
          <span>© {new Date().getFullYear()} ARCA. Todos los derechos reservados.</span>
          <span>Honduras · Nicaragua · Guatemala · Costa Rica · El Salvador</span>
        </div>
      </footer>
    </>
  );
}
