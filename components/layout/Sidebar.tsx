"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Users,
  Truck,
  BookOpen,
  Wallet,
  BarChart3,
  Settings,
  CircleAlert,
  HandCoins,
  Banknote,
  Store,
  UsersRound,
  UserRound,
  CalendarCheck,
  Inbox,
  Briefcase,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon };

const GRUPOS: { titulo: string; items: Item[] }[] = [
  {
    titulo: "Operativo",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/pos", label: "POS", icon: ShoppingCart },
      { href: "/caja", label: "Caja", icon: Store },
      { href: "/ventas", label: "Ventas", icon: Receipt },
      { href: "/inventario", label: "Inventario", icon: Package },
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/compras", label: "Compras", icon: Truck },
    ],
  },
  {
    titulo: "Finanzas",
    items: [
      { href: "/cxc", label: "Cobros (CxC)", icon: HandCoins },
      { href: "/cxp", label: "Pagos (CxP)", icon: Banknote },
      { href: "/contabilidad", label: "Contabilidad", icon: BookOpen },
      { href: "/tesoreria", label: "Tesorería", icon: Wallet },
    ],
  },
  {
    titulo: "Recursos Humanos",
    items: [
      { href: "/rrhh", label: "Panel RRHH", icon: UsersRound },
      { href: "/rrhh/empleados", label: "Empleados", icon: UserRound },
      { href: "/rrhh/asistencia", label: "Asistencia", icon: CalendarCheck },
      { href: "/rrhh/nomina", label: "Nómina", icon: Wallet },
      { href: "/rrhh/solicitudes", label: "Solicitudes", icon: Inbox },
      { href: "/rrhh/reclutamiento", label: "Reclutamiento", icon: Briefcase },
    ],
  },
  {
    titulo: "Gestión",
    items: [
      { href: "/reportes", label: "Reportes", icon: BarChart3 },
      { href: "/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

const ANCHO_ABIERTO = "240px";
const ANCHO_COLAPSADO = "68px";
const STORAGE_KEY = "atria:sidebar-colapsado";

export function Sidebar({
  nombreEmpresa,
  planNombre,
  esDemo,
  nombreUsuario,
}: {
  nombreEmpresa: string;
  planNombre: string;
  esDemo: boolean;
  nombreUsuario: string;
}) {
  const pathname = usePathname();
  const [colapsado, setColapsado] = useState(false);

  useEffect(() => {
    const guardado = localStorage.getItem(STORAGE_KEY) === "1";
    setColapsado(guardado);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      colapsado ? ANCHO_COLAPSADO : ANCHO_ABIERTO,
    );
  }, [colapsado]);

  function toggle() {
    setColapsado((prev) => {
      const siguiente = !prev;
      localStorage.setItem(STORAGE_KEY, siguiente ? "1" : "0");
      return siguiente;
    });
  }

  return (
    <aside
      style={{ width: "var(--sidebar-width)" }}
      className="fixed inset-y-0 left-0 z-30 flex flex-col bg-[color:var(--color-dark-bg)] text-[color:var(--color-text-on-dark)] transition-[width] duration-200"
    >
      <div
        className={cn(
          "flex items-center px-3 pt-5 pb-4",
          colapsado ? "justify-center" : "justify-between px-5",
        )}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-tertiary)]/15 text-[color:var(--color-tertiary-light)]">
            <span className="text-lg font-bold">A</span>
          </div>
          {!colapsado && (
            <div className="min-w-0">
              <div className="text-base font-semibold leading-tight">ATRIA</div>
              <div className="truncate text-[10px] uppercase tracking-wider text-white/50 leading-tight">
                {nombreEmpresa}
              </div>
            </div>
          )}
        </div>
        {!colapsado && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Colapsar menú"
            title="Colapsar menú"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/60 hover:bg-white/5 hover:text-white"
          >
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      {colapsado && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Expandir menú"
          title="Expandir menú"
          className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-md text-white/60 hover:bg-white/5 hover:text-white"
        >
          <PanelLeftOpen size={18} />
        </button>
      )}

      <nav className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
        {GRUPOS.map((g) => (
          <div key={g.titulo} className="mt-4 first:mt-1">
            {!colapsado && (
              <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {g.titulo}
              </div>
            )}
            <div className="space-y-0.5">
              {g.items.map(({ href, label, icon: Icon }) => {
                const activo = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    title={colapsado ? label : undefined}
                    className={cn(
                      "flex items-center rounded-md py-2 text-[13px] transition-colors",
                      colapsado ? "justify-center px-0" : "gap-2.5 px-2.5",
                      activo
                        ? "bg-[color:var(--color-tertiary)]/20 text-white font-medium"
                        : "text-white/70 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    {!colapsado && label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        {!colapsado && (
          <div className="rounded-md bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/50">
                Plan {planNombre}
              </span>
              {esDemo && (
                <CircleAlert size={12} className="text-[color:var(--color-warning)]" />
              )}
            </div>
            {esDemo ? (
              <>
                <p className="mt-1 text-[12px] text-white/70">
                  Funciones limitadas
                </p>
                <Link
                  href="/configuracion/facturacion"
                  className="mt-2 inline-block text-[12px] font-medium text-[color:var(--color-tertiary-light)] hover:text-white"
                >
                  Mejorar plan →
                </Link>
              </>
            ) : (
              <p className="mt-1 text-[12px] text-white/70">Suscripción activa</p>
            )}
          </div>
        )}

        <Link
          href="/mi-cuenta"
          title={colapsado ? nombreUsuario : undefined}
          className={cn(
            "mt-3 flex items-center rounded-md p-2 text-[13px] text-white/80 hover:bg-white/5",
            colapsado ? "justify-center" : "gap-2.5",
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-tertiary)]/30 text-[11px] font-semibold uppercase">
            {iniciales(nombreUsuario)}
          </div>
          {!colapsado && (
            <div className="min-w-0">
              <div className="truncate text-[12px] font-medium leading-tight">
                {nombreUsuario}
              </div>
              <div className="text-[10px] text-white/50 leading-tight">Mi cuenta</div>
            </div>
          )}
        </Link>
      </div>
    </aside>
  );
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "??";
}
