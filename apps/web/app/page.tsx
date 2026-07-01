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
} from "lucide-react";
import { subscriptionPlans } from "@atria/contracts";

export default function LandingPage() {
  const business = subscriptionPlans.business;
  const enterprise = subscriptionPlans.enterprise;

  return (
    <div className="bg-[color:var(--color-surface)]">
      {/* HERO */}
      <section className="relative overflow-hidden bg-[color:var(--color-dark-bg)] pt-24 pb-20 text-[color:var(--color-text-on-dark)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-[color:var(--color-tertiary)]/20 blur-3xl" />
          <div className="absolute -right-32 top-40 h-96 w-96 rounded-full bg-[color:var(--color-secondary)]/30 blur-3xl" />
        </div>

        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white">
              <span className="text-base font-bold">A</span>
            </div>
            <span className="text-base font-semibold text-white">Atria</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="atria-btn atria-btn-ghost atria-btn-sm text-white hover:bg-white/10">
              Iniciar sesión
            </Link>
            <Link href="/registro" className="atria-btn atria-btn-sm bg-[color:var(--color-tertiary-light)] text-[color:var(--color-primary)] hover:bg-white">
              Empieza gratis
            </Link>
          </nav>
        </header>

        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto mt-12 max-w-3xl text-center">
            <h1 className="text-[44px] font-bold leading-[1.05] tracking-tight sm:text-[56px]">
              El sistema que tu
              <br />
              negocio necesita.
            </h1>
            <p className="mt-5 text-[18px] leading-relaxed text-white/70">
              POS · Inventario · Contabilidad · Empleados · Reportes.
              <br />
              Una sola plataforma para tu operación comercial.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/registro"
                className="atria-btn atria-btn-lg bg-[color:var(--color-tertiary-light)] text-[color:var(--color-primary)] hover:bg-white"
              >
                Empieza gratis
                <ArrowRight size={16} />
              </Link>
              <Link
                href="#caracteristicas"
                className="atria-btn atria-btn-lg border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                Ver características
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CARACTERÍSTICAS */}
      <section id="caracteristicas" className="py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-label">Características</span>
            <h2 className="mt-3 text-2xl text-[color:var(--color-text-primary)]">
              Todo lo que tu negocio necesita.
            </h2>
            <p className="mt-3 text-[color:var(--color-text-muted)]">
              Cada módulo habla con los demás. Una venta actualiza inventario, genera factura
              y arma el asiento contable. Sin Excel intermedio.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: ShoppingCart, titulo: "Punto de Venta", texto: "POS rápido con búsqueda por código, descuentos, pago mixto y modo offline." },
              { icon: Package, titulo: "Inventario en tiempo real", texto: "Múltiples almacenes, lotes, vencimientos y conversión de unidades." },
              { icon: Receipt, titulo: "Facturación", texto: "Documentos fiscales válidos por país, ventas y notas de crédito." },
              { icon: BookOpen, titulo: "Contabilidad integrada", texto: "Partida doble automática. Libro diario, mayor, balance y estados financieros." },
              { icon: Building2, titulo: "Multi-sucursal", texto: "Operación consolidada o por sucursal. Transferencias entre almacenes." },
              { icon: Shield, titulo: "Roles y permisos", texto: "RBAC granular: owner, admin, worker, accountant — o crea los tuyos." },
            ].map(({ icon: Icon, titulo, texto }) => (
              <div
                key={titulo}
                className="group rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 transition hover:border-[color:var(--color-border-strong)] hover:shadow-md"
              >
                <div className="inline-flex rounded-md bg-[color:var(--color-surface-2)] p-2.5 text-[color:var(--color-primary)] transition group-hover:bg-[color:var(--color-tertiary)]/20">
                  <Icon size={20} />
                </div>
                <h3 className="mt-4 text-base font-semibold">{titulo}</h3>
                <p className="mt-1.5 text-small text-[color:var(--color-text-muted)]">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANES */}
      <section className="bg-[color:var(--color-neutral)] py-20">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-label">Planes</span>
            <h2 className="mt-3 text-2xl text-[color:var(--color-text-primary)]">
              Dos planes. Cero contratos.
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            {[business, enterprise].map((plan) => (
              <div
                key={plan.code}
                className="flex flex-col rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-7"
              >
                <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">
                  {plan.name}
                </h3>
                <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
                  {plan.userLimit ? `Hasta ${plan.userLimit} usuarios` : "Usuarios ilimitados"}
                  {" · "}
                  {plan.branchLimit ? `${plan.branchLimit} sucursal` : "Multi-sucursal"}
                </p>

                <ul className="mt-6 space-y-2.5 text-small">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check size={14} className="mt-0.5 flex-shrink-0 text-[color:var(--color-success)]" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/registro?plan=${plan.code.toLowerCase()}`}
                  className="atria-btn atria-btn-primary mt-7 w-full justify-center"
                >
                  Empezar {plan.name}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[color:var(--color-primary)] py-20 text-white">
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h2 className="text-3xl font-bold">Tu próximo Lunes, sin Excel.</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/70">
            Te configuramos en 10 minutos y la primera venta es hoy mismo.
          </p>
          <div className="mt-7">
            <Link
              href="/registro"
              className="atria-btn atria-btn-lg bg-white text-[color:var(--color-primary)] hover:bg-[color:var(--color-tertiary-light)]"
            >
              Empieza gratis <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-small text-[color:var(--color-text-muted)] sm:flex-row sm:px-8">
          <span>© {new Date().getFullYear()} Atria. Hecho para Latinoamérica.</span>
          <div className="flex gap-4">
            <Link href="/login">Iniciar sesión</Link>
            <Link href="/registro">Crear cuenta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
