"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Check,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Database,
  Facebook,
  FileCheck2,
  Headphones,
  Instagram,
  LineChart,
  Linkedin,
  LockKeyhole,
  Package,
  Quote,
  Receipt,
  Shield,
  ShoppingCart,
  Star,
  StarHalf,
  Store,
  Users,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { Nav } from "@/components/marketing/Nav";
import { AtriaLogo } from "@/components/marketing/AtriaLogo";
import { PricingToggle } from "@/components/marketing/PricingToggle";
import { FAQ } from "@/components/marketing/FAQ";

const REDES_SOCIALES = [
  {
    nombre: "Instagram",
    href:
      process.env.NEXT_PUBLIC_ATRIA_INSTAGRAM_URL || "https://www.instagram.com/",
    icono: Instagram,
  },
  {
    nombre: "Facebook",
    href: process.env.NEXT_PUBLIC_ATRIA_FACEBOOK_URL || "https://www.facebook.com/",
    icono: Facebook,
  },
  {
    nombre: "LinkedIn",
    href: process.env.NEXT_PUBLIC_ATRIA_LINKEDIN_URL || "https://www.linkedin.com/",
    icono: Linkedin,
  },
] as const;

const metricas = [
  { valor: "10 min", etiqueta: "para empezar a vender" },
  { valor: "24/7", etiqueta: "operación visible" },
  { valor: "5 países", etiqueta: "pensado para LATAM" },
  { valor: "1 sistema", etiqueta: "ventas, stock y contabilidad" },
];

const modulos = [
  {
    icon: ShoppingCart,
    titulo: "Punto de venta",
    texto:
      "Vende rápido, aplica descuentos, cobra mixto y sigue operando cuando el internet falla.",
  },
  {
    icon: Package,
    titulo: "Inventario vivo",
    texto:
      "Controla existencias, lotes, vencimientos, almacenes y movimientos entre sucursales.",
  },
  {
    icon: Receipt,
    titulo: "Facturación fiscal",
    texto:
      "Emite documentos válidos, maneja secuencias y deja cada venta lista para revisión.",
  },
  {
    icon: BookOpen,
    titulo: "Contabilidad automática",
    texto:
      "Cada venta, compra, gasto y cobro alimenta los libros sin volver a digitar datos.",
  },
  {
    icon: Building2,
    titulo: "Multi-sucursal",
    texto:
      "Compara tiendas, consolida resultados y mueve inventario con trazabilidad completa.",
  },
  {
    icon: BarChart3,
    titulo: "Reportes para decidir",
    texto:
      "Ventas, rentabilidad, cuentas por cobrar, stock bajo y cierres en una vista confiable.",
  },
];

const viaje = [
  {
    etapa: "Arranque",
    titulo: "Ordenamos tu base",
    texto:
      "Configuramos empresa, sucursal, caja, impuestos, roles y catálogo inicial para que salgas con una estructura limpia.",
    icon: ClipboardList,
  },
  {
    etapa: "Operación",
    titulo: "Acompañamos el día a día",
    texto:
      "El equipo vende, cobra, factura, repone inventario y registra gastos desde el mismo flujo de trabajo.",
    icon: Store,
  },
  {
    etapa: "Control",
    titulo: "Convertimos datos en claridad",
    texto:
      "La administración ve cierres, cuentas, márgenes y contabilidad sin esperar hojas separadas ni reportes manuales.",
    icon: LineChart,
  },
  {
    etapa: "Crecimiento",
    titulo: "Escalamos contigo",
    texto:
      "Cuando abres otra sucursal o agregas más equipo, ATRIA mantiene permisos, auditoría y reportes consolidados.",
    icon: Users,
  },
];

const flujo = [
  { icon: ShoppingCart, label: "Venta registrada" },
  { icon: CreditCard, label: "Caja actualizada" },
  { icon: Package, label: "Stock descontado" },
  { icon: Receipt, label: "Factura emitida" },
  { icon: BookOpen, label: "Asiento generado" },
  { icon: BarChart3, label: "Reporte listo" },
];

const industrias = [
  "Ferreterías",
  "Farmacias",
  "Distribuidoras",
  "Tiendas",
  "Restaurantes rápidos",
  "Servicios con inventario",
];

const seguridad = [
  { icon: LockKeyhole, texto: "Datos protegidos por empresa y roles" },
  { icon: Database, texto: "Copias de seguridad y trazabilidad" },
  { icon: Shield, texto: "Permisos claros para cada usuario" },
  { icon: Headphones, texto: "Soporte humano en español" },
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
      "Buscábamos una plataforma moderna y estable. Atria nos permitió organizar procesos que antes dependían completamente de hojas de cálculo.",
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

const landingStyles = `
  [data-reveal]{opacity:1;transform:none;}

  @keyframes atria-spin{to{transform:rotate(360deg)}}
  @keyframes atria-bar{from{transform:scaleY(0)}to{transform:scaleY(1)}}
  @keyframes atria-twinkle{0%,100%{opacity:.15}50%{opacity:.9}}
  @keyframes atria-scan{0%{transform:translate3d(0,-120%,0)}100%{transform:translate3d(0,560%,0)}}
  @keyframes atria-floatY{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-12px,0)}}
  @keyframes atria-marquee-l{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}
  @keyframes atria-marquee-r{from{transform:translate3d(-50%,0,0)}to{transform:translate3d(0,0,0)}}
  @keyframes atria-pulse{0%{transform:scale(.85);opacity:.6}70%{transform:scale(1.7);opacity:0}100%{opacity:0}}
  @keyframes atria-gradient-flow{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}

  @keyframes atria-orb-a{0%,100%{transform:translate3d(-8vw,-4vh,0) scale(1)}50%{transform:translate3d(34vw,20vh,0) scale(1.12)}}
  @keyframes atria-orb-b{0%,100%{transform:translate3d(8vw,-8vh,0) scale(1.05)}50%{transform:translate3d(-32vw,28vh,0) scale(.92)}}
  @keyframes atria-orb-c{0%,100%{transform:translate3d(-6vw,8vh,0) scale(.95)}50%{transform:translate3d(24vw,-30vh,0) scale(1.08)}}

  @keyframes atria-wavecard{
    0%,100%{transform:translate3d(0,0,0);}
    50%{transform:translate3d(0,-10px,0);}
  }

  .atria-rainbow,.atria-grad-text{background:linear-gradient(90deg,#c4b5fd,#60a5fa,#e9d5ff,#a78bfa,#c4b5fd);background-size:240% 100%;background-clip:text;-webkit-background-clip:text;color:transparent;-webkit-text-fill-color:transparent;animation:atria-gradient-flow 6s ease-in-out infinite;}

  .atria-orb{position:absolute;border-radius:9999px;contain:strict;backface-visibility:hidden;will-change:transform;pointer-events:none;}
  .atria-orb-a{left:-12vmin;top:-8vmin;width:58vmin;height:58vmin;background:radial-gradient(circle,rgba(168,85,247,.92) 0%,rgba(124,58,237,.52) 42%,rgba(124,58,237,0) 72%);animation:atria-orb-a 18s ease-in-out infinite;}
  .atria-orb-b{right:-14vmin;top:10vh;width:64vmin;height:64vmin;background:radial-gradient(circle,rgba(37,99,235,.9) 0%,rgba(79,70,229,.48) 44%,rgba(37,99,235,0) 72%);animation:atria-orb-b 23s ease-in-out infinite;}
  .atria-orb-c{left:22vw;bottom:-24vmin;width:60vmin;height:60vmin;background:radial-gradient(circle,rgba(192,38,211,.78) 0%,rgba(109,40,217,.44) 43%,rgba(109,40,217,0) 72%);animation:atria-orb-c 27s ease-in-out infinite;}

  .atria-bar{transform-origin:bottom;animation:atria-bar .9s cubic-bezier(.16,1,.3,1) both;}
  .atria-scanline{position:absolute;left:0;right:0;top:0;height:34%;background:linear-gradient(180deg,transparent,rgba(167,139,250,.16),transparent);animation:atria-scan 6s ease-in-out infinite;pointer-events:none;z-index:20;}

  .atria-wavecard{background:rgba(255,255,255,.07);color:#fff;border-color:rgba(255,255,255,.14);animation:atria-wavecard 4.6s ease-in-out infinite;}

  .atria-marquee-wrap{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);}
  .atria-marquee{display:flex;gap:1rem;width:max-content;will-change:transform;animation:atria-marquee-l 60s linear infinite;}
  .atria-marquee.rev{animation-name:atria-marquee-r;animation-duration:72s;}
  .atria-marquee-wrap:hover .atria-marquee{animation-play-state:paused;}

  .atria-tilt{transition:transform .5s cubic-bezier(.16,1,.3,1),box-shadow .5s cubic-bezier(.16,1,.3,1),border-color .5s ease,background-color .5s ease;}
  .atria-tilt:hover{transform:translateY(-6px);}

  .atria-gradborder{position:relative;padding:1.5px;border-radius:18px;overflow:hidden;}
  .atria-gradborder::before{content:"";position:absolute;inset:-150%;background:conic-gradient(from 0deg,#7c3aed,#2563eb,#22d3ee,#a855f7,#ec4899,#7c3aed);animation:atria-spin 7s linear infinite;}
  .atria-gradborder.fast::before{animation-duration:4.5s;}
  .atria-gradborder>*{position:relative;border-radius:16.5px;height:100%;}

  @media (max-width:767px){
    .atria-orb-a{width:82vmin;height:82vmin;}
    .atria-orb-b{width:88vmin;height:88vmin;}
    .atria-orb-c{display:none;}
  }

  @media (prefers-reduced-motion: reduce){
    [data-reveal]{opacity:1 !important;transform:none !important;transition:none !important;}
    .atria-rainbow,.atria-grad-text,.atria-orb,.atria-bar,.atria-scanline,.atria-marquee,.atria-wavecard,.atria-gradborder::before{animation:none !important;}
    .atria-marquee{transform:none !important;}
  }
`;

function FloatingOrbs() {
  return (
    <div aria-hidden className="fixed inset-0 z-0 overflow-hidden bg-[#0b0416]">
      <div className="atria-orb atria-orb-a" />
      <div className="atria-orb atria-orb-b" />
      <div className="atria-orb atria-orb-c" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
    </div>
  );
}

function Stars({ rating, size = 15 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5 text-[#fbbf24]">
      {[1, 2, 3, 4, 5].map((i) => {
        if (rating >= i) return <Star key={i} size={size} fill="currentColor" />;
        if (rating >= i - 0.5) return <StarHalf key={i} size={size} fill="currentColor" />;
        return <Star key={i} size={size} className="text-white/20" />;
      })}
    </div>
  );
}

function Avatar({ nombre, foto }: { nombre: string; foto: string }) {
  const [error, setError] = useState(false);
  const iniciales = nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  if (error) {
    return (
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c3aed,#2563eb)] text-[13px] font-semibold text-white ring-2 ring-white/20">
        {iniciales}
      </div>
    );
  }

  return (
    <img
      src={foto}
      alt={nombre}
      loading="lazy"
      onError={() => setError(true)}
      className="h-11 w-11 flex-shrink-0 rounded-full object-cover ring-2 ring-[#a78bfa]/40"
    />
  );
}

function TestimonioCard({ testimonio }: { testimonio: Testimonio }) {
  return (
    <figure className="atria-tilt flex min-h-[224px] w-[330px] flex-shrink-0 flex-col rounded-[14px] border border-white/12 bg-[#190c2d]/95 p-6 hover:border-[#a78bfa]/50 hover:shadow-[0_24px_60px_rgba(124,58,237,0.28)] sm:w-[360px]">
      <div className="flex items-center justify-between">
        <Stars rating={testimonio.rating} />
        <Quote size={26} className="text-[#a78bfa]/35" />
      </div>
      <blockquote className="mt-4 flex-1 text-[14px] leading-7 text-white/80">
        “{testimonio.texto}”
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
        <Avatar nombre={testimonio.nombre} foto={testimonio.foto} />
        <div>
          <p className="text-[14px] font-semibold text-white">{testimonio.nombre}</p>
          <p className="text-[12px] text-white/55">{testimonio.puesto}</p>
        </div>
      </figcaption>
    </figure>
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
                  className="atria-bar w-full rounded-t-[5px] bg-[linear-gradient(180deg,#a78bfa_0%,#2563eb_100%)]"
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
    { n: "Tubo PVC 1/2\"", p: "C$ 62" },
    { n: "Pintura blanca 1gal", p: "C$ 540" },
    { n: "Clavos 2\" (lb)", p: "C$ 28" },
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
            <div
              key={item.n}
              className="rounded-[7px] border border-[#e3ebf6] bg-white p-2.5 transition hover:border-[#c4b5fd] hover:shadow-sm"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[6px] bg-[linear-gradient(135deg,#f0e7ff,#eef2ff)] text-[#5b21b6]">
                <Package size={15} />
              </div>
              <p className="mt-2 line-clamp-2 text-[10px] font-medium leading-tight text-[#273042]">
                {item.n}
              </p>
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
    { n: "Tubo PVC 1/2\"", sku: "PVC-012", stock: "9", estado: "bajo" },
    { n: "Foco LED 9W", sku: "LED-009", stock: "6", estado: "bajo" },
    { n: "Cable THHN 12", sku: "CAB-012", stock: "260", estado: "ok" },
  ];
  return (
    <div className="h-full rounded-[8px] border border-[#e3ebf6] bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#273042]">Inventario · Sucursal Central</p>
        <span className="rounded-full bg-[#efe7ff] px-2 py-0.5 text-[10px] font-medium text-[#5b21b6]">
          437 productos
        </span>
      </div>
      <div className="grid grid-cols-[1.6fr_0.8fr_0.6fr_0.8fr] gap-2 border-b border-[#e7edf6] pb-2 text-[9px] font-semibold uppercase text-[#8b95a6]">
        <span>Producto</span>
        <span>SKU</span>
        <span>Stock</span>
        <span>Estado</span>
      </div>
      {filas.map((f) => (
        <div
          key={f.sku}
          className="grid grid-cols-[1.6fr_0.8fr_0.6fr_0.8fr] items-center gap-2 border-b border-[#f0f3f8] py-2 text-[11px] last:border-b-0"
        >
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
              <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-medium text-[#16803c]">
                En stock
              </span>
            ) : (
              <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[10px] font-medium text-[#b06000]">
                Stock bajo
              </span>
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
      className="relative animate-[atria-floatY_9s_ease-in-out_infinite]"
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
    >
      <div className="absolute inset-x-6 -bottom-6 h-12 bg-[linear-gradient(90deg,rgba(124,58,237,0.45),rgba(37,99,235,0.42),rgba(168,85,247,0.40))] blur-2xl" />
      <div className="relative overflow-hidden rounded-[14px] border border-white/20 bg-[#0c0518]/95 shadow-[0_40px_110px_rgba(9,4,20,0.7)]">
        <div className="atria-scanline" />
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
                  activa === i
                    ? "bg-white text-[#160827]"
                    : "text-white/55 hover:text-white/80"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="hidden items-center gap-1.5 text-[11px] font-medium text-[#34d399] sm:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75 [animation:atria-pulse_2s_ease-out_infinite]" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#34d399]" />
            </span>
            En vivo
          </div>
        </div>

        <div className="relative min-h-[340px] bg-[#f7f4fc] p-3 sm:min-h-[360px] sm:p-4">
          {[<PantallaDashboard key="d" />, <PantallaPOS key="p" />, <PantallaInventario key="i" />].map(
            (pantalla, i) => (
              <div
                key={i}
                className={`absolute inset-0 p-3 transition-all duration-700 sm:p-4 ${
                  activa === i
                    ? "translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-3 opacity-0"
                }`}
              >
                {pantalla}
              </div>
            ),
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 border-t border-white/10 bg-[#160827] py-2.5">
          {pantallas.map((p, i) => (
            <button
              key={p}
              type="button"
              aria-label={p}
              onClick={() => setActiva(i)}
              className={`h-1.5 rounded-full transition-all ${
                activa === i ? "w-6 bg-[#a78bfa]" : "w-1.5 bg-white/25"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SynchronizedSection() {
  return (
    <section className="relative overflow-hidden py-24 text-white">
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center" data-reveal>
          <h2 className="text-[34px] font-semibold leading-tight sm:text-[42px]">
            Cada módulo se mueve con el <span className="atria-grad-text">mismo ritmo</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-7 text-white/68">
            Una acción en caja actualiza inventario, documentos, cuentas y reportes.
            ATRIA mantiene el negocio alineado sin perseguir hojas ni cerrar el día a
            mano.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-5xl" data-reveal>
          <div className="grid gap-3 md:grid-cols-6">
            {flujo.map(({ icon: Icon, label }, index) => (
              <div
                key={label}
                className="atria-wavecard flex min-h-[132px] flex-col items-center justify-center rounded-[12px] border p-4 text-center"
                style={{ animationDelay: `${index * 0.42}s` }}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-white text-[#3b0f70] shadow-[0_8px_20px_rgba(167,139,250,0.4)] ring-1 ring-black/5">
                  <Icon size={20} />
                </div>
                <p className="mt-4 text-[13px] font-medium leading-snug">{label}</p>
                <span className="mt-3 text-[11px] opacity-45">0{index + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {seguridad.map(({ icon: Icon, texto }) => (
            <div
              key={texto}
              className="atria-tilt flex items-center gap-3 rounded-[10px] border border-white/12 bg-[#1b0d31]/90 p-4 hover:border-[#a78bfa]/50"
              data-reveal
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-white text-[#4c1d95]">
                <Icon size={18} />
              </div>
              <p className="text-[13px] font-medium leading-snug text-white/76">{texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimoniosSection() {
  const fila1 = testimonios.slice(0, 6);
  const fila2 = testimonios.slice(6);

  return (
    <section className="relative overflow-hidden py-24 text-white">
      <div className="relative">
        <div className="mx-auto max-w-2xl px-5 text-center sm:px-8" data-reveal>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
            Confianza
          </span>
          <h2 className="mt-3 text-[36px] font-semibold leading-tight">
            Negocios reales que ya trabajan con <span className="atria-grad-text">ATRIA</span>.
          </h2>
          <p className="mt-4 text-[16px] leading-7 text-white/62">
            Equipos que dejaron atrás las hojas de cálculo y hoy operan con orden,
            claridad y control en tiempo real.
          </p>
        </div>

        <div className="mt-12 space-y-4" data-reveal>
          <div className="atria-marquee-wrap">
            <div className="atria-marquee">
              {[...fila1, ...fila1].map((testimonio, index) => (
                <TestimonioCard key={`${testimonio.nombre}-${index}`} testimonio={testimonio} />
              ))}
            </div>
          </div>
          <div className="atria-marquee-wrap">
            <div className="atria-marquee rev">
              {[...fila2, ...fila2].map((testimonio, index) => (
                <TestimonioCard key={`${testimonio.nombre}-${index}`} testimonio={testimonio} />
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 text-center">
          <div className="flex items-center gap-2" data-reveal>
            <Stars rating={4.5} size={16} />
            <span className="text-[14px] font-medium text-white/80">
              4.5 de calificación promedio
            </span>
          </div>
          <span className="text-[13px] text-white/45" data-reveal>
            Ferreterías · Farmacias · Distribuidoras y más
          </span>
        </div>
      </div>
    </section>
  );
}

function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem("atria_cookie_consent") !== "accepted");
  }, []);

  const aceptar = () => {
    window.localStorage.setItem("atria_cookie_consent", "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-5xl rounded-[12px] border border-white/12 bg-[#160827]/95 p-4 text-white shadow-[0_20px_60px_rgba(9,4,20,0.5)] backdrop-blur-md"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <p className="text-[14px] font-semibold">Cookies en ATRIA</p>
          <p className="mt-1 text-[13px] leading-relaxed text-white/60">
            Usamos cookies necesarias para que el sitio funcione y medición básica para
            entender qué información ayuda mejor a los negocios que nos visitan.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={aceptar}
            className="atria-btn border-white/20 bg-white/10 text-white hover:bg-white/16"
          >
            Solo necesarias
          </button>
          <button
            type="button"
            onClick={aceptar}
            className="atria-btn bg-white text-[#160827] hover:bg-[#efe7ff]"
          >
            Aceptar
          </button>
          <button
            type="button"
            onClick={aceptar}
            className="atria-btn p-2 text-white/60 hover:bg-white/10"
            aria-label="Cerrar aviso de cookies"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: landingStyles }} />
      <FloatingOrbs />
      <Nav />

      <main className="relative z-10 overflow-hidden text-white">
        <section className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(36,16,90,0.36)_0%,rgba(18,60,255,0.12)_55%,transparent_100%)] pt-28 sm:pt-32">
          <div className="relative mx-auto max-w-6xl px-5 pb-20 sm:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <h1
                className="mx-auto max-w-4xl text-[44px] font-semibold leading-[1.03] text-white sm:text-[62px] lg:text-[72px]"
                data-reveal
              >
                <span className="atria-rainbow">ATRIA</span> acompaña todo el viaje de tu
                negocio.
              </h1>
              <p
                className="mx-auto mt-6 max-w-2xl text-[18px] leading-8 text-white/68"
                data-reveal
              >
                Ventas, inventario, facturación y contabilidad conectados en una sola
                plataforma lista para crecer contigo.
              </p>

              <div
                className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
                data-reveal
              >
                <Link
                  href="/registro"
                  className="atria-btn atria-btn-lg group bg-white text-[#160827] shadow-[0_18px_40px_rgba(255,255,255,0.18)] transition hover:-translate-y-0.5 hover:bg-[#efe7ff]"
                >
                  Empezar prueba gratis
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
                <a
                  href="#caracteristicas"
                  className="atria-btn atria-btn-lg border-white/18 bg-white/10 text-white transition hover:-translate-y-0.5 hover:bg-white/16"
                >
                  Conocer ATRIA
                </a>
              </div>
            </div>

            <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
              {metricas.map((metrica) => (
                <div
                  key={metrica.etiqueta}
                  className="atria-tilt rounded-[10px] border border-white/12 bg-[#1b0d31]/85 p-4 text-center hover:border-[#a78bfa]/50"
                  data-reveal
                >
                  <p className="text-[21px] font-semibold text-white">{metrica.valor}</p>
                  <p className="mt-1 text-[12px] leading-snug text-white/58">
                    {metrica.etiqueta}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <SynchronizedSection />

        <section
          id="caracteristicas"
          className="relative overflow-hidden py-24"
        >
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="max-w-3xl" data-reveal>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
                Qué es ATRIA
              </span>
              <h2 className="mt-3 text-[36px] font-semibold leading-tight text-white">
                Un centro de control para vender, administrar y decidir con datos
                confiables.
              </h2>
              <p className="mt-4 text-[16px] leading-7 text-white/65">
                ATRIA une las áreas que normalmente viven separadas. Cuando algo pasa
                en caja, inventario, compras o contabilidad, el resto del negocio se
                actualiza sin perseguir archivos ni duplicar trabajo.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {modulos.map(({ icon: Icon, titulo, texto }) => (
                <div
                  key={titulo}
                  className="atria-tilt group rounded-[14px] border border-white/10 bg-[linear-gradient(160deg,rgba(51,24,88,0.94),rgba(18,20,63,0.92))] p-6 hover:border-[#a78bfa]/50 hover:shadow-[0_24px_60px_rgba(124,58,237,0.28)]"
                  data-reveal
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

        <section id="viaje" className="relative overflow-hidden py-24 text-white">
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
              <div data-reveal>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
                  Tu viaje con ATRIA
                </span>
                <h2 className="mt-3 text-[36px] font-semibold leading-tight">
                  No solo te damos software. Te acompañamos mientras el negocio se
                  ordena, opera y <span className="atria-grad-text">escala</span>.
                </h2>
                <p className="mt-4 text-[16px] leading-7 text-white/65">
                  La meta no es llenar otra pantalla. La meta es que tu equipo tenga un
                  camino claro: implementar, vender, controlar y tomar mejores
                  decisiones cada semana.
                </p>
                <div className="mt-7 flex flex-wrap gap-2">
                  {industrias.map((industria) => (
                    <span
                      key={industria}
                      className="rounded-full border border-white/15 bg-[#21123a]/90 px-3 py-1.5 text-[12px] font-medium text-white/70"
                    >
                      {industria}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {viaje.map(({ icon: Icon, etapa, titulo, texto }) => (
                  <div
                    key={etapa}
                    className="atria-tilt rounded-[14px] border border-white/12 bg-[#1b0d31]/90 p-5 hover:border-[#a78bfa]/50 hover:bg-[#24123f]"
                    data-reveal
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-white text-[#6d28d9] shadow-[0_10px_24px_rgba(167,139,250,0.35)]">
                        <Icon size={19} />
                      </div>
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-[#d8b4fe]">
                        {etapa}
                      </span>
                    </div>
                    <h3 className="mt-5 text-[16px] font-semibold text-white">{titulo}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-white/60">{texto}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden py-24 text-white">
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-3xl text-center" data-reveal>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
                Automatización operativa
              </span>
              <h2 className="mt-3 text-[36px] font-semibold leading-tight">
                Una venta. <span className="atria-grad-text">Seis procesos</span>{" "}
                actualizados.
              </h2>
              <p className="mt-4 text-[16px] leading-7 text-white/65">
                ATRIA conecta la acción de caja con inventario, documentos, cuentas y
                reportes. Menos trabajo repetido, más control para decidir.
              </p>
            </div>

            <div className="mt-12 grid gap-3 md:grid-cols-6">
              {flujo.map(({ icon: Icon, label }, index) => (
                <div
                  key={label}
                  data-reveal
                >
                  <div className="atria-tilt flex h-full flex-col items-center rounded-[12px] border border-white/12 bg-[#1b0d31]/90 p-4 text-center hover:border-[#a78bfa]/50 hover:bg-[#24123f]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-white text-[#4c1d95] shadow-[0_8px_20px_rgba(167,139,250,0.4)]">
                      <Icon size={20} />
                    </div>
                    <p className="mt-4 text-[13px] font-medium leading-snug">{label}</p>
                    <span className="mt-3 text-[11px] text-white/40">0{index + 1}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: Zap,
                  titulo: "Rápido para el cajero",
                  texto: "Búsqueda ágil, descuentos, pagos mixtos y tickets claros.",
                },
                {
                  icon: WifiOff,
                  titulo: "Preparado para fallos",
                  texto: "El POS puede seguir registrando ventas cuando la conexión no ayuda.",
                },
                {
                  icon: FileCheck2,
                  titulo: "Listo para administración",
                  texto: "Cada movimiento queda respaldado, auditable y conectado a reportes.",
                },
              ].map(({ icon: Icon, titulo, texto }) => (
                <div
                  key={titulo}
                  className="atria-tilt rounded-[12px] border border-white/12 bg-white/[0.06] p-5 hover:border-[#a78bfa]/50"
                  data-reveal
                >
                  <Icon size={20} className="text-[#c4b5fd]" />
                  <h3 className="mt-4 text-[16px] font-semibold">{titulo}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-white/58">{texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="precios" className="relative overflow-hidden py-24">
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center" data-reveal>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
                Precios
              </span>
              <h2 className="mt-3 text-[36px] font-semibold leading-tight text-white">
                Un plan para cada etapa del negocio.
              </h2>
              <p className="mt-4 text-[16px] leading-7 text-white/65">
                Empieza pequeño, valida el flujo y sube de plan cuando necesites más
                usuarios, sucursales o control financiero.
              </p>
            </div>

            <div className="mt-10" data-reveal>
              <PricingToggle />
            </div>

            <p className="mt-10 text-center text-[13px] text-white/50">
              Todos los planes incluyen actualizaciones, copias de seguridad y soporte
              en español.
            </p>
          </div>
        </section>

        <TestimoniosSection />

        <section id="faq" className="relative overflow-hidden py-24">
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center" data-reveal>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
                Preguntas frecuentes
              </span>
              <h2 className="mt-3 text-[36px] font-semibold leading-tight text-white">
                Respuestas claras antes de empezar.
              </h2>
            </div>
            <div className="mt-12" data-reveal>
              <FAQ />
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden py-20 text-white">
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div data-reveal>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  Siguiente paso
                </span>
                <h2 className="mt-3 max-w-3xl text-[38px] font-semibold leading-tight">
                  Deja de administrar tu negocio <span className="atria-grad-text">a ciegas</span>.
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
              <div
                className="flex flex-col gap-3 sm:flex-row lg:flex-col"
                data-reveal
              >
                <Link
                  href="/registro"
                  className="atria-btn atria-btn-lg bg-white text-[#160827] transition hover:-translate-y-0.5 hover:bg-[#efe7ff]"
                >
                  Empezar prueba gratis
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="#precios"
                  className="atria-btn atria-btn-lg border border-white/25 bg-transparent text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Ver planes
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 -mt-20 overflow-hidden bg-[linear-gradient(180deg,rgba(11,4,22,0)_0%,rgba(8,3,17,0.72)_24%,#080311_58%,#07020f_100%)] pt-36 text-white">
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid gap-12 pb-14 lg:grid-cols-[1.05fr_1.35fr] lg:gap-20">
            <div>
              <Link href="/" className="inline-flex items-center gap-3">
                <AtriaLogo className="h-11 w-auto" />
                <span className="text-[20px] font-semibold tracking-[-0.02em]">ATRIA</span>
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
                      aria-label={`${nombre} de ATRIA`}
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
                    ["Qué es ATRIA", "#caracteristicas"],
                    ["Tu viaje", "#viaje"],
                    ["Precios", "#precios"],
                    ["Preguntas frecuentes", "#faq"],
                  ].map(([label, href]) => (
                    <a
                      key={href}
                      href={href}
                      className="group inline-flex w-fit items-center gap-1.5 text-[13px] text-white/58 transition-colors hover:text-white"
                    >
                      {label}
                      <ChevronRight
                        size={13}
                        className="opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                      />
                    </a>
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
                        className="opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
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

          <div className="flex flex-col gap-4 py-7 text-[12px] text-white/38 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} ATRIA. Todos los derechos reservados.</span>
            <span className="max-w-xl sm:text-right">
              Honduras · Nicaragua · Guatemala · Costa Rica · El Salvador
            </span>
          </div>
        </div>
      </footer>

      <CookieNotice />
    </>
  );
}
