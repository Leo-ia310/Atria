import Link from "next/link";
import {
  ShoppingCart,
  Package,
  Receipt,
  BookOpen,
  Building2,
  Shield,
  ArrowRight,
  Check,
  Star,
} from "lucide-react";
import { Nav } from "@/components/marketing/Nav";
import { PricingToggle } from "@/components/marketing/PricingToggle";
import { FAQ } from "@/components/marketing/FAQ";

export default function LandingPage() {
  return (
    <>
      <Nav />

      {/* HERO */}
      <section className="relative overflow-hidden bg-[color:var(--color-dark-bg)] pt-32 pb-24 text-[color:var(--color-text-on-dark)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-[color:var(--color-tertiary)]/20 blur-3xl" />
          <div className="absolute -right-32 top-40 h-96 w-96 rounded-full bg-[color:var(--color-secondary)]/30 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-white/80">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--color-tertiary)]" />
              500+ negocios ya operan con ATRIA
            </span>
            <h1 className="mt-6 text-[44px] font-bold leading-[1.05] tracking-tight sm:text-[56px]">
              El sistema que tu
              <br />
              negocio necesita.
            </h1>
            <p className="mt-5 text-[18px] leading-relaxed text-white/70">
              Sin papel. Sin caos. Sin excusas.
              <br />
              Centraliza tu punto de venta, inventario y contabilidad en un solo motor.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/registro"
                className="atria-btn atria-btn-lg group bg-[color:var(--color-tertiary-light)] text-[color:var(--color-primary)] hover:bg-white"
              >
                Empieza gratis sin tarjeta
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
              <a
                href="#caracteristicas"
                className="atria-btn atria-btn-lg border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                Ver cómo funciona
              </a>
            </div>

            <p className="mt-5 text-[12px] text-white/40">
              14 días de prueba en Pro. Cancela cuando quieras.
            </p>
          </div>

          {/* Mockup */}
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[color:var(--color-dark-surface)] shadow-2xl">
              <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="ml-3 text-[11px] text-white/40">
                  app.atria — Operaciones del día
                </span>
              </div>
              <div className="grid grid-cols-12 gap-4 p-5">
                <div className="col-span-3 space-y-2">
                  {["Dashboard", "POS", "Ventas", "Inventario", "Contabilidad"].map(
                    (l, i) => (
                      <div
                        key={l}
                        className={`rounded-md px-3 py-2 text-[12px] ${
                          i === 0
                            ? "bg-[color:var(--color-tertiary)]/20 text-white"
                            : "text-white/40"
                        }`}
                      >
                        {l}
                      </div>
                    ),
                  )}
                </div>
                <div className="col-span-9 space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { l: "Ventas hoy", v: "C$ 12,840" },
                      { l: "Margen", v: "32.4%" },
                      { l: "CxC", v: "C$ 4,200" },
                      { l: "Stock bajo", v: "8 SKU" },
                    ].map((k) => (
                      <div
                        key={k.l}
                        className="rounded-md border border-white/10 bg-black/20 p-3"
                      >
                        <div className="text-[9px] uppercase tracking-wider text-white/40">
                          {k.l}
                        </div>
                        <div className="mt-1.5 text-base font-semibold text-white">
                          {k.v}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-md border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[12px] font-medium text-white">
                        Ventas últimos 7 días
                      </span>
                      <span className="text-[10px] text-white/40">Semanal</span>
                    </div>
                    <div className="flex h-32 items-end gap-3">
                      {[60, 75, 50, 90, 70, 85, 100].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t bg-gradient-to-t from-[color:var(--color-tertiary)] to-[color:var(--color-tertiary-light)] opacity-80"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="border-y border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-8">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 text-center sm:grid-cols-4 sm:px-8">
          {[
            { v: "500+", l: "Negocios activos" },
            { v: "99.9%", l: "Tiempo en línea" },
            { v: "5 países", l: "En Latinoamérica" },
            { v: "100%", l: "Soporte en español" },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-2xl text-[color:var(--color-text-primary)]">
                {s.v}
              </div>
              <div className="mt-0.5 text-small text-[color:var(--color-text-muted)]">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CARACTERÍSTICAS */}
      <section id="caracteristicas" className="py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-label">Características</span>
            <h2 className="mt-3 text-2xl text-[color:var(--color-text-primary)]">
              Todo lo que tu negocio necesita.
              <br />
              Conectado de verdad.
            </h2>
            <p className="mt-3 text-[color:var(--color-text-muted)]">
              Cada módulo habla con los demás. Una venta actualiza inventario, genera
              factura y arma el asiento contable. Sin Excel intermedio.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: ShoppingCart,
                titulo: "Punto de Venta",
                texto:
                  "POS rápido con búsqueda por código, descuentos, pago mixto y modo offline. El cajero solo tiene que cobrar.",
              },
              {
                icon: Package,
                titulo: "Inventario en tiempo real",
                texto:
                  "Múltiples almacenes, lotes, vencimientos, kits y conversión de unidades. Stock siempre exacto.",
              },
              {
                icon: Receipt,
                titulo: "Facturación fiscal",
                texto:
                  "Secuencias autorizadas, formatos por país y emisión automática de documentos válidos.",
              },
              {
                icon: BookOpen,
                titulo: "Contabilidad integrada",
                texto:
                  "Partida doble automática en cada operación. Libro diario, mayor, balance y estados financieros sin esfuerzo.",
              },
              {
                icon: Building2,
                titulo: "Multi-sucursal",
                texto:
                  "Operación consolidada o por sucursal. Transferencias de inventario y reportes comparativos al instante.",
              },
              {
                icon: Shield,
                titulo: "Roles y permisos",
                texto:
                  "Roles base (Admin, Cajero, Contador, Gerente, Auditor) o crea los tuyos. Auditoría detallada de todo.",
              },
            ].map(({ icon: Icon, titulo, texto }) => (
              <div
                key={titulo}
                className="group rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 transition hover:border-[color:var(--color-border-strong)] hover:shadow-md"
              >
                <div className="inline-flex rounded-md bg-[color:var(--color-surface-2)] p-2.5 text-[color:var(--color-primary)] transition group-hover:bg-[color:var(--color-tertiary)]/20">
                  <Icon size={20} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-[color:var(--color-text-primary)]">
                  {titulo}
                </h3>
                <p className="mt-1.5 text-small leading-relaxed text-[color:var(--color-text-muted)]">
                  {texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="bg-[color:var(--color-dark-bg)] py-24 text-[color:var(--color-text-on-dark)]">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
              Cómo funciona
            </span>
            <h2 className="mt-3 text-2xl">Listo en menos de 10 minutos.</h2>
            <p className="mt-3 text-white/60">
              Sin instalaciones, sin servidor propio, sin dolores de cabeza.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                paso: "1",
                titulo: "Crea tu cuenta",
                texto:
                  "Tres datos: tu empresa, tu administrador y el plan. Te configuramos roles, almacén, catálogo de cuentas y formas de pago automáticamente.",
              },
              {
                paso: "2",
                titulo: "Carga tu catálogo",
                texto:
                  "Sube tus productos en Excel o uno por uno. Define precios, impuestos y stock inicial. Tu inventario queda en línea.",
              },
              {
                paso: "3",
                titulo: "Opera",
                texto:
                  "Abre el POS y vende. Tu contabilidad se arma sola. Tus reportes están listos cuando los necesites.",
              },
            ].map((p) => (
              <div
                key={p.paso}
                className="relative rounded-lg border border-white/10 bg-white/[0.03] p-7"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-tertiary)] text-base font-bold text-[color:var(--color-primary)]">
                  {p.paso}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{p.titulo}</h3>
                <p className="mt-1.5 text-small leading-relaxed text-white/60">
                  {p.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section id="precios" className="bg-[color:var(--color-neutral)] py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-label">Precios</span>
            <h2 className="mt-3 text-2xl text-[color:var(--color-text-primary)]">
              Un plan para cada etapa.
            </h2>
            <p className="mt-3 text-[color:var(--color-text-muted)]">
              Empieza gratis. Sube cuando tu negocio lo pida. Sin contratos.
            </p>
          </div>

          <div className="mt-10">
            <PricingToggle />
          </div>

          <p className="mt-10 text-center text-small text-[color:var(--color-text-muted)]">
            Todos los planes incluyen actualizaciones gratuitas, copias de seguridad
            diarias y soporte en español.
          </p>
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-label">Lo dicen ellos</span>
            <h2 className="mt-3 text-2xl text-[color:var(--color-text-primary)]">
              Negocios reales que dejaron Excel atrás.
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              {
                nombre: "Marvin Cortés",
                rol: "Dueño · Ferretería La Esperanza",
                lugar: "Tegucigalpa, HN",
                texto:
                  "Antes hacíamos el cierre del día a las 11 de la noche con cuaderno. Ahora cierro la caja en 5 minutos y mi contadora ya tiene el diario.",
              },
              {
                nombre: "Daniela Mejía",
                rol: "Administradora · Farmacia Vida",
                lugar: "Managua, NI",
                texto:
                  "El control de lotes y vencimientos nos cambió la vida. Recibimos alertas 30 días antes y ya no perdemos medicamento por caducidad.",
              },
              {
                nombre: "José Luis Ramírez",
                rol: "Gerente · Distribuidora El Sol",
                lugar: "Guatemala",
                texto:
                  "Manejo tres sucursales y antes era un caos. Hoy veo el inventario consolidado en tiempo real y el reporte por sucursal sale solo.",
              },
            ].map((t) => (
              <div
                key={t.nombre}
                className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6"
              >
                <div className="flex gap-0.5 text-[color:var(--color-warning)]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="mt-4 text-base leading-relaxed text-[color:var(--color-text-primary)]">
                  &ldquo;{t.texto}&rdquo;
                </p>
                <div className="mt-5 flex items-center gap-3 border-t border-[color:var(--color-border)] pt-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-tertiary-light)] text-[12px] font-semibold uppercase text-[color:var(--color-primary)]">
                    {t.nombre
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="text-small">
                    <div className="font-medium text-[color:var(--color-text-primary)]">
                      {t.nombre}
                    </div>
                    <div className="text-[12px] text-[color:var(--color-text-muted)]">
                      {t.rol} · {t.lugar}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-[color:var(--color-neutral)] py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-label">Preguntas frecuentes</span>
            <h2 className="mt-3 text-2xl text-[color:var(--color-text-primary)]">
              ¿Tienes dudas? Aquí están las respuestas.
            </h2>
          </div>
          <div className="mt-12">
            <FAQ />
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative overflow-hidden bg-[color:var(--color-primary)] py-20 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[color:var(--color-tertiary)]/20 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h2 className="text-[38px] font-bold leading-tight tracking-tight sm:text-[44px]">
            Tu próximo Lunes,
            <br />
            sin Excel.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Únete a los 500+ negocios que ya operan con ATRIA. Te configuramos en
            10 minutos y la primera venta es hoy mismo.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/registro"
              className="atria-btn atria-btn-lg bg-white text-[color:var(--color-primary)] hover:bg-[color:var(--color-tertiary-light)]"
            >
              Empieza gratis
              <ArrowRight size={16} />
            </Link>
            <Link
              href="#precios"
              className="atria-btn atria-btn-lg border border-white/30 bg-transparent text-white hover:bg-white/10"
            >
              Ver planes
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-white/60">
            <li className="flex items-center gap-1.5">
              <Check size={12} /> Sin tarjeta
            </li>
            <li className="flex items-center gap-1.5">
              <Check size={12} /> Sin contrato
            </li>
            <li className="flex items-center gap-1.5">
              <Check size={12} /> Soporte en español
            </li>
          </ul>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-12">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[color:var(--color-primary)] text-white">
                <span className="text-base font-bold">A</span>
              </div>
              <span className="text-base font-semibold text-[color:var(--color-text-primary)]">
                ATRIA
              </span>
            </Link>
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-small text-[color:var(--color-text-muted)]">
              <a href="#caracteristicas">Características</a>
              <a href="#precios">Precios</a>
              <a href="#faq">FAQ</a>
              <Link href="/login">Iniciar sesión</Link>
            </nav>
          </div>
          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-[color:var(--color-border)] pt-6 text-[12px] text-[color:var(--color-text-muted)] sm:flex-row">
            <span>
              Hecho con cariño para negocios latinoamericanos. © {new Date().getFullYear()}{" "}
              ATRIA.
            </span>
            <span>Honduras · Nicaragua · Guatemala · Costa Rica · El Salvador</span>
          </div>
        </div>
      </footer>
    </>
  );
}
