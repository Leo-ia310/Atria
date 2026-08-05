import Link from "next/link";
import { ArcaLogo } from "@/components/marketing/ArcaLogo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#120c1e] lg:grid lg:grid-cols-2">
      {/* Panel del formulario (oscuro) */}
      <div className="auth-dark relative flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:min-h-screen">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <ArcaLogo className="h-8 w-auto" eager />
            <span className="text-base font-semibold text-[color:var(--color-text-primary)]">
              ARCA
            </span>
          </Link>
          <Link
            href="/precios"
            className="text-small text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-primary)]"
          >
            Ver planes
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center py-10">
          {children}
        </main>

        <footer className="text-center text-[12px] text-[color:var(--color-text-muted)] sm:text-left">
          © {new Date().getFullYear()} ARCA ·{" "}
          <Link href="/legal/terminos" className="hover:text-[color:var(--color-text-primary)]">
            Términos
          </Link>{" "}
          ·{" "}
          <Link href="/legal/privacidad" className="hover:text-[color:var(--color-text-primary)]">
            Privacidad
          </Link>
        </footer>
      </div>

      {/* Panel de bienvenida (morado) — oculto en móvil */}
      <div className="auth-welcome relative hidden overflow-hidden lg:block">
        <span className="auth-welcome-blob -right-24 -top-24 h-80 w-80" />
        <span className="auth-welcome-blob bottom-10 left-[-6rem] h-72 w-72" />
        <span className="auth-welcome-blob right-16 top-1/3 h-40 w-40 opacity-70" />

        <div className="relative flex h-full flex-col justify-center px-14 py-16 text-white xl:px-20">
          <h2 className="text-[44px] font-bold leading-[1.05] tracking-tight xl:text-[52px]">
            Bienvenido a
            <br />
            <span className="text-white/95">ARCA</span>
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-white/80">
            Ventas, inventario y contabilidad en una sola plataforma. Ordena tu
            negocio y decide con datos confiables.
          </p>

          <div className="mt-12 max-w-md">
            <DashboardArt />
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardArt() {
  return (
    <svg
      viewBox="0 0 420 260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full drop-shadow-[0_30px_60px_rgba(30,10,60,0.45)]"
      aria-hidden
    >
      {/* Tarjeta principal */}
      <rect x="8" y="20" width="404" height="220" rx="16" fill="white" fillOpacity="0.1" />
      <rect
        x="8"
        y="20"
        width="404"
        height="220"
        rx="16"
        stroke="white"
        strokeOpacity="0.28"
      />
      {/* Barra superior */}
      <circle cx="30" cy="42" r="4" fill="white" fillOpacity="0.6" />
      <circle cx="44" cy="42" r="4" fill="white" fillOpacity="0.4" />
      <circle cx="58" cy="42" r="4" fill="white" fillOpacity="0.3" />
      <rect x="330" y="36" width="66" height="12" rx="6" fill="white" fillOpacity="0.2" />

      {/* KPIs */}
      {[28, 160, 292].map((x, i) => (
        <g key={x}>
          <rect x={x} y="66" width="100" height="44" rx="9" fill="white" fillOpacity="0.14" />
          <rect x={x + 12} y="76" width="46" height="7" rx="3.5" fill="white" fillOpacity="0.4" />
          <rect
            x={x + 12}
            y="90"
            width={[64, 40, 54][i]}
            height="11"
            rx="5"
            fill="white"
            fillOpacity="0.85"
          />
        </g>
      ))}

      {/* Gráfica de barras */}
      <rect x="28" y="126" width="230" height="96" rx="10" fill="white" fillOpacity="0.1" />
      {[38, 62, 30, 78, 50, 88].map((h, i) => (
        <rect
          key={i}
          x={44 + i * 34}
          y={210 - h}
          width="18"
          height={h}
          rx="4"
          fill="white"
          fillOpacity={i === 5 ? 0.95 : 0.55}
        />
      ))}

      {/* Lista lateral */}
      <rect x="272" y="126" width="124" height="96" rx="10" fill="white" fillOpacity="0.1" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx="288" cy={148 + i * 20} r="5" fill="white" fillOpacity="0.7" />
          <rect
            x="300"
            y={144 + i * 20}
            width={[70, 56, 82, 48][i]}
            height="8"
            rx="4"
            fill="white"
            fillOpacity="0.4"
          />
        </g>
      ))}
    </svg>
  );
}
