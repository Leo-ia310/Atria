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
  FileCheck2,
  Headphones,
  LineChart,
  LockKeyhole,
  Package,
  Receipt,
  Shield,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Users,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { Nav } from "@/components/marketing/Nav";
import { PricingToggle } from "@/components/marketing/PricingToggle";
import { FAQ } from "@/components/marketing/FAQ";

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

function ProductMockup() {
  return (
    <div className="relative">
      <div className="absolute inset-x-6 -bottom-6 h-12 bg-[linear-gradient(90deg,rgba(124,58,237,0.36),rgba(37,99,235,0.34),rgba(168,85,247,0.32))] blur-xl" />
      <div className="relative overflow-hidden rounded-[8px] border border-white/20 bg-white/95 shadow-[0_30px_90px_rgba(18,5,31,0.40)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-[#25143d] bg-[#160827] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ea4335]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#fbbc05]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#34a853]" />
          </div>
          <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/55 sm:block">
            app.atria / operaciones
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[180px_1fr]">
          <aside className="hidden border-r border-[#e4eaf4] bg-[#faf7ff] p-4 lg:block">
            <div className="mb-5 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#3b0f70] text-white">
                A
              </div>
              <div>
                <p className="text-[12px] font-semibold text-[#273042]">ATRIA</p>
                <p className="text-[10px] text-[#7a8699]">Dashboard</p>
              </div>
            </div>
            {["Inicio", "POS", "Inventario", "Caja", "Contabilidad"].map((item, index) => (
              <div
                key={item}
                className={`mb-1 flex items-center justify-between rounded-[6px] px-3 py-2 text-[12px] ${
                  index === 0
                    ? "bg-[#efe7ff] font-medium text-[#5b21b6]"
                    : "text-[#738096]"
                }`}
              >
                {item}
                {index === 0 ? <ChevronRight size={13} /> : null}
              </div>
            ))}
          </aside>

          <div className="p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-3 border-b border-[#e7edf6] pb-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[11px] uppercase text-[#7b8496]">Hoy en la tienda</p>
                <h2 className="text-[22px] font-semibold text-[#1f2937]">
                  Todo avanza en el mismo pulso.
                </h2>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#ecfdf5] px-3 py-1.5 text-[12px] font-medium text-[#16803c]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#34a853]" />
                En línea
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Ventas hoy", value: "C$ 48,260", color: "text-[#5b21b6]" },
                { label: "Margen", value: "34.8%", color: "text-[#0b8043]" },
                { label: "Stock bajo", value: "12 SKU", color: "text-[#b06000]" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[8px] border border-[#e3ebf6] bg-white p-4"
                >
                  <p className="text-[11px] text-[#7b8496]">{item.label}</p>
                  <p className={`mt-2 text-[21px] font-semibold ${item.color}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-[8px] border border-[#e3ebf6] bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[#273042]">
                    Ventas y reposición
                  </p>
                  <span className="text-[11px] text-[#7b8496]">Últimos 7 días</span>
                </div>
                <div className="flex h-40 items-end gap-2">
                  {[48, 64, 42, 78, 56, 88, 72].map((height, index) => (
                    <div key={index} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t-[6px] bg-[linear-gradient(180deg,#a78bfa_0%,#2563eb_100%)]"
                        style={{ height: `${height}%` }}
                      />
                      <span className="h-1 w-1 rounded-full bg-[#c8d3e3]" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[8px] border border-[#e9d5ff]/30 bg-[#190b2b] p-4 text-white">
                <p className="text-[13px] font-medium">Cierre inteligente</p>
                <p className="mt-1 text-[12px] text-white/55">
                  Caja, inventario y asiento listos para revisar.
                </p>
                <div className="mt-5 space-y-3">
                  {["Caja cuadrada", "CxC actualizada", "Libro diario"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-[12px]">
                      <Check size={14} className="text-[#34a853]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-[6px] bg-white/10 p-3">
                  <p className="text-[10px] uppercase text-white/45">Siguiente acción</p>
                  <p className="mt-1 text-[13px] font-medium">
                    Reponer 12 productos antes del viernes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SynchronizedSection() {
  return (
    <section className="relative bg-[linear-gradient(180deg,#1e18d8_0%,#5f2bff_18%,#fbf9ff_88%)] py-20 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white/78 backdrop-blur">
            <Sparkles size={13} className="text-[#d8b4fe]" />
            Operación sincronizada
          </div>
          <h2 className="mt-5 text-[34px] font-semibold leading-tight sm:text-[42px]">
            Cada módulo se mueve con el mismo ritmo.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-7 text-white/68">
            Una acción en caja actualiza inventario, documentos, cuentas y reportes.
            ATRIA mantiene el negocio alineado sin perseguir hojas ni cerrar el día a
            mano.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-5xl rounded-[8px] border border-white/15 bg-[#12051f]/72 p-3 shadow-[0_28px_80px_rgba(12,5,31,0.34)] backdrop-blur-xl">
          <div className="grid gap-2 md:grid-cols-6">
            {flujo.map(({ icon: Icon, label }, index) => (
              <div
                key={label}
                className="flex min-h-[128px] flex-col items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.06] p-4 text-center"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-white text-[#3b0f70]">
                  <Icon size={20} />
                </div>
                <p className="mt-4 text-[13px] font-medium leading-snug">{label}</p>
                <span className="mt-3 text-[11px] text-white/35">0{index + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {seguridad.map(({ icon: Icon, texto }) => (
            <div
              key={texto}
              className="flex items-center gap-3 rounded-[8px] border border-white/12 bg-white/[0.08] p-4 backdrop-blur"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[8px] bg-white text-[#4c1d95]">
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
      className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-5xl rounded-[8px] border border-[#d9e3f1] bg-white/95 p-4 shadow-[0_20px_60px_rgba(31,41,55,0.18)] backdrop-blur-md"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <p className="text-[14px] font-semibold text-[#1f2937]">Cookies en ATRIA</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#5b667a]">
            Usamos cookies necesarias para que el sitio funcione y medición básica para
            entender qué información ayuda mejor a los negocios que nos visitan.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={aceptar}
            className="atria-btn border-[#d8e2f2] bg-white text-[#273042] hover:bg-[#f3f7ff]"
          >
            Solo necesarias
          </button>
          <button
            type="button"
            onClick={aceptar}
            className="atria-btn bg-[#271b38] text-white hover:bg-[#3b2a52]"
          >
            Aceptar
          </button>
          <button
            type="button"
            onClick={aceptar}
            className="atria-btn p-2 text-[#647084] hover:bg-[#f3f7ff]"
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
      <Nav />

      <main className="overflow-hidden bg-[#fbf9ff] text-[#1f2937]">
        <section className="relative bg-[#12051f] pt-28 text-white sm:pt-32">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#190725_0%,#24105a_42%,#123cff_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:46px_46px]" />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(180deg,transparent,#1e18d8)]" />
          <div className="relative mx-auto max-w-6xl px-5 pb-20 sm:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white/75 shadow-sm backdrop-blur">
                <span className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#a78bfa]" />
                  <span className="h-2 w-2 rounded-full bg-[#60a5fa]" />
                  <span className="h-2 w-2 rounded-full bg-[#d8b4fe]" />
                </span>
                Sistema operativo para negocios latinoamericanos
              </div>

              <h1 className="mx-auto mt-6 max-w-4xl text-[44px] font-semibold leading-[1.03] text-white sm:text-[62px] lg:text-[72px]">
                ATRIA acompaña todo el viaje de tu negocio.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-[18px] leading-8 text-white/68">
                Desde la primera venta hasta el reporte financiero: punto de venta,
                inventario, facturación, caja y contabilidad conectados en una sola
                plataforma clara, rápida y lista para crecer contigo.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/registro"
                  className="atria-btn atria-btn-lg group bg-white text-[#160827] shadow-[0_18px_40px_rgba(255,255,255,0.18)] hover:bg-[#efe7ff]"
                >
                  Empezar prueba gratis
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
                <a
                  href="#caracteristicas"
                  className="atria-btn atria-btn-lg border-white/18 bg-white/10 text-white hover:bg-white/16"
                >
                  Conocer ATRIA
                </a>
              </div>
            </div>

            <div className="mx-auto mt-12 max-w-5xl">
              <ProductMockup />
            </div>

            <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
              {metricas.map((metrica) => (
                <div
                  key={metrica.etiqueta}
                  className="rounded-[8px] border border-white/12 bg-white/[0.08] p-4 text-center backdrop-blur"
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

        <section id="caracteristicas" className="bg-[#fbf9ff] py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="max-w-3xl">
              <span className="text-label">Qué es ATRIA</span>
              <h2 className="mt-3 text-[36px] font-semibold leading-tight text-[#151b2c]">
                Un centro de control para vender, administrar y decidir con datos
                confiables.
              </h2>
              <p className="mt-4 text-[16px] leading-7 text-[#5d6a80]">
                ATRIA une las áreas que normalmente viven separadas. Cuando algo pasa
                en caja, inventario, compras o contabilidad, el resto del negocio se
                actualiza sin perseguir archivos ni duplicar trabajo.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {modulos.map(({ icon: Icon, titulo, texto }) => (
                <div
                  key={titulo}
                  className="group rounded-[8px] border border-[#e6ddf6] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#c4b5fd] hover:shadow-[0_18px_50px_rgba(91,33,182,0.14)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[linear-gradient(135deg,#f0e7ff,#eef2ff)] text-[#4c1d95]">
                    <Icon size={21} />
                  </div>
                  <h3 className="mt-5 text-[17px] font-semibold text-[#151b2c]">
                    {titulo}
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#66758c]">{texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
              <div>
                <span className="text-label">Tu viaje con ATRIA</span>
                <h2 className="mt-3 text-[36px] font-semibold leading-tight text-[#151b2c]">
                  No solo te damos software. Te acompañamos mientras el negocio se
                  ordena, opera y escala.
                </h2>
                <p className="mt-4 text-[16px] leading-7 text-[#5d6a80]">
                  La meta no es llenar otra pantalla. La meta es que tu equipo tenga un
                  camino claro: implementar, vender, controlar y tomar mejores
                  decisiones cada semana.
                </p>
                <div className="mt-7 flex flex-wrap gap-2">
                  {industrias.map((industria) => (
                    <span
                      key={industria}
                      className="rounded-full border border-[#d8e4f4] bg-[#f8fbff] px-3 py-1.5 text-[12px] font-medium text-[#536177]"
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
                    className="rounded-[8px] border border-[#dfe7f2] bg-[#fbfdff] p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white text-[#6d28d9] shadow-sm">
                        <Icon size={19} />
                      </div>
                      <span className="rounded-full bg-[#efe7ff] px-2.5 py-1 text-[11px] font-semibold text-[#5b21b6]">
                        {etapa}
                      </span>
                    </div>
                    <h3 className="mt-5 text-[16px] font-semibold text-[#151b2c]">
                      {titulo}
                    </h3>
                    <p className="mt-2 text-[13px] leading-6 text-[#66758c]">{texto}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative bg-[#14071f] py-24 text-white">
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(124,58,237,0.35),transparent_30%,rgba(37,99,235,0.26)_58%,rgba(168,85,247,0.20)_84%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:54px_54px]" />
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-[11px] font-semibold uppercase text-white/50">
                Automatización operativa
              </span>
              <h2 className="mt-3 text-[36px] font-semibold leading-tight">
                Una venta. Seis procesos actualizados.
              </h2>
              <p className="mt-4 text-[16px] leading-7 text-white/65">
                ATRIA conecta la acción de caja con inventario, documentos, cuentas y
                reportes. Menos trabajo repetido, más control para decidir.
              </p>
            </div>

            <div className="mt-12 grid gap-3 md:grid-cols-6">
              {flujo.map(({ icon: Icon, label }, index) => (
                <div key={label} className="relative">
                  <div className="flex h-full flex-col items-center rounded-[8px] border border-white/12 bg-white/[0.06] p-4 text-center backdrop-blur">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-white text-[#4c1d95]">
                      <Icon size={20} />
                    </div>
                    <p className="mt-4 text-[13px] font-medium leading-snug">{label}</p>
                    <span className="mt-3 text-[11px] text-white/40">
                      0{index + 1}
                    </span>
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
                  className="rounded-[8px] border border-white/12 bg-white/[0.06] p-5"
                >
                  <Icon size={20} className="text-[#c4b5fd]" />
                  <h3 className="mt-4 text-[16px] font-semibold">{titulo}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-white/58">{texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="precios" className="bg-[#fbf9ff] py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-label">Precios</span>
              <h2 className="mt-3 text-[36px] font-semibold leading-tight text-[#151b2c]">
                Un plan para cada etapa del negocio.
              </h2>
              <p className="mt-4 text-[16px] leading-7 text-[#66758c]">
                Empieza pequeño, valida el flujo y sube de plan cuando necesites más
                usuarios, sucursales o control financiero.
              </p>
            </div>

            <div className="mt-10">
              <PricingToggle />
            </div>

            <p className="mt-10 text-center text-small text-[color:var(--color-text-muted)]">
              Todos los planes incluyen actualizaciones, copias de seguridad y soporte
              en español.
            </p>
          </div>
        </section>

        <section className="bg-white py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-label">Confianza</span>
              <h2 className="mt-3 text-[36px] font-semibold leading-tight text-[#151b2c]">
                Hecho para equipos que necesitan orden sin volverse técnicos.
              </h2>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                {
                  nombre: "Marvin Cortés",
                  rol: "Dueño, ferretería",
                  texto:
                    "ATRIA nos quitó el cierre eterno. Ahora ventas, caja e inventario terminan el día hablando el mismo idioma.",
                },
                {
                  nombre: "Daniela Mejía",
                  rol: "Administradora, farmacia",
                  texto:
                    "Los lotes, vencimientos y reportes nos dan una tranquilidad que antes no teníamos en hojas de cálculo.",
                },
                {
                  nombre: "José Luis Ramírez",
                  rol: "Gerente, distribuidora",
                  texto:
                    "Abrimos otra sucursal y no perdimos visibilidad. Puedo comparar tiendas y tomar decisiones con números frescos.",
                },
              ].map((testimonio) => (
                <div
                  key={testimonio.nombre}
                  className="rounded-[8px] border border-[#dfe7f2] bg-[#fbfdff] p-6"
                >
                  <div className="flex gap-0.5 text-[#fbbc05]">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} size={14} fill="currentColor" />
                    ))}
                  </div>
                  <p className="mt-5 text-[15px] leading-7 text-[#38465a]">
                    “{testimonio.texto}”
                  </p>
                  <div className="mt-6 border-t border-[#e4eaf4] pt-4">
                    <p className="font-semibold text-[#151b2c]">{testimonio.nombre}</p>
                    <p className="text-[12px] text-[#66758c]">{testimonio.rol}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="bg-[#fbf9ff] py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-label">Preguntas frecuentes</span>
              <h2 className="mt-3 text-[36px] font-semibold leading-tight text-[#151b2c]">
                Respuestas claras antes de empezar.
              </h2>
            </div>
            <div className="mt-12">
              <FAQ />
            </div>
          </div>
        </section>

        <section className="bg-[#14071f] py-20 text-white">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className="text-[11px] font-semibold uppercase text-white/45">
                  Siguiente paso
                </span>
                <h2 className="mt-3 max-w-3xl text-[38px] font-semibold leading-tight">
                  Deja de administrar tu negocio a ciegas.
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
                  className="atria-btn atria-btn-lg bg-white text-[#160827] hover:bg-[#efe7ff]"
                >
                  Empezar prueba gratis
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="#precios"
                  className="atria-btn atria-btn-lg border border-white/25 bg-transparent text-white hover:bg-white/10"
                >
                  Ver planes
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dde7f5] bg-white py-12">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#271b38] text-white">
                <span className="text-base font-bold">A</span>
              </div>
              <span className="text-base font-semibold text-[#151b2c]">ATRIA</span>
            </Link>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-small text-[#66758c]">
              <a href="#caracteristicas">Qué es ATRIA</a>
              <a href="#precios">Precios</a>
              <a href="#faq">FAQ</a>
              <Link href="/login">Iniciar sesión</Link>
            </nav>
          </div>
          <div className="mt-8 flex flex-col justify-between gap-3 border-t border-[#e4eaf4] pt-6 text-[12px] text-[#7a8699] sm:flex-row">
            <span>
              Hecho para negocios latinoamericanos. © {new Date().getFullYear()} ATRIA.
            </span>
            <span>Honduras · Nicaragua · Guatemala · Costa Rica · El Salvador</span>
          </div>
        </div>
      </footer>

      <CookieNotice />
    </>
  );
}
