"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ChefHat,
  CircleAlert,
  ClipboardList,
  Gift,
  LayoutDashboard,
  LifeBuoy,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  ShoppingCart,
  Table2,
  UsersRound,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react";
import { Header, type SucursalScopeHeader } from "@/components/layout/Header";
import { PlanesModal } from "@/components/layout/PlanesModal";
import { ArcaLogo } from "@/components/marketing/ArcaLogo";
import { cn } from "@/lib/utils";
import type { CommandItem } from "@/components/layout/nav-items";
import type { ModuloAcceso } from "@/lib/access-control";
import type { PlanId } from "@/lib/pricing";

const ANCHO_ABIERTO = "240px";
const ANCHO_COLAPSADO = "68px";
const STORAGE_KEY = "arca:restaurante-sidebar-colapsado";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  modulo: ModuloAcceso;
  exact?: boolean;
};

type NavGroup = {
  titulo: string;
  items: NavItem[];
};

const NAV_GROUPS_RESTAURANTE: NavGroup[] = [
  {
    titulo: "Inicio",
    items: [
      {
        href: "/restaurante",
        label: "Dashboard",
        icon: LayoutDashboard,
        modulo: "restaurante-dashboard",
        exact: true,
      },
    ],
  },
  {
    titulo: "Atencion",
    items: [
      { href: "/restaurante/pos", label: "POS", icon: ShoppingCart, modulo: "restaurante-pos" },
      { href: "/restaurante/mesas", label: "Mesas", icon: Table2, modulo: "restaurante-mesas" },
      {
        href: "/restaurante/ordenes",
        label: "Ordenes",
        icon: ClipboardList,
        modulo: "restaurante-ordenes",
      },
      {
        href: "/restaurante/comensales",
        label: "Comensales",
        icon: UsersRound,
        modulo: "restaurante-comensales",
      },
    ],
  },
  {
    titulo: "Cocina",
    items: [
      { href: "/restaurante/kds", label: "KDS", icon: ChefHat, modulo: "restaurante-kds" },
      { href: "/restaurante/menu", label: "Menu QR", icon: Utensils, modulo: "restaurante-menu" },
      {
        href: "/restaurante/recetas",
        label: "Recetas",
        icon: ReceiptText,
        modulo: "restaurante-recetas",
      },
      {
        href: "/restaurante/inventario",
        label: "Insumos",
        icon: Package,
        modulo: "restaurante-inventario",
      },
      { href: "/restaurante/mermas", label: "Mermas", icon: Package, modulo: "restaurante-mermas" },
    ],
  },
  {
    titulo: "Reservas",
    items: [
      {
        href: "/restaurante/reservaciones",
        label: "Reservas",
        icon: CalendarDays,
        modulo: "restaurante-reservaciones",
      },
      {
        href: "/restaurante/promociones",
        label: "Promos",
        icon: Gift,
        modulo: "restaurante-promociones",
      },
    ],
  },
  {
    titulo: "Gestion",
    items: [
      {
        href: "/restaurante/reportes",
        label: "Reportes",
        icon: BarChart3,
        modulo: "restaurante-reportes",
      },
      {
        href: "/restaurante/configuracion",
        label: "Configuracion",
        icon: Settings,
        modulo: "restaurante-configuracion",
      },
      {
        href: "/restaurante/soporte",
        label: "Soporte",
        icon: LifeBuoy,
        modulo: "restaurante-soporte",
      },
    ],
  },
];

const COMMAND_ITEMS_RESTAURANTE: CommandItem[] = [
  ...NAV_GROUPS_RESTAURANTE.flatMap((grupo) =>
    grupo.items.map((item) => ({
      label: item.label,
      href: item.href,
      grupo: grupo.titulo,
      modulo: item.modulo,
      keywords: `restaurante ${grupo.titulo.toLowerCase()} ${item.label.toLowerCase()}`,
    })),
  ),
  {
    label: "Empresa",
    href: "/restaurante/empresa",
    grupo: "Gestion",
    modulo: "restaurante-configuracion",
    keywords: "empresa giro datos restaurante",
  },
  {
    label: "Dispositivos",
    href: "/restaurante/dispositivos",
    grupo: "Gestion",
    modulo: "restaurante-configuracion",
    keywords: "impresora lector caja dispositivos",
  },
  {
    label: "Plan",
    href: "/restaurante/plan",
    grupo: "Gestion",
    modulo: "restaurante-plan",
    keywords: "plan suscripcion pago",
  },
  {
    label: "Mi cuenta",
    href: "/restaurante/mi-cuenta",
    grupo: "Gestion",
    modulo: "mi-cuenta",
    keywords: "perfil usuario contrasena",
  },
];

export function RestauranteShell({
  children,
  nombreEmpresa,
  nombreUsuario,
  planNombre,
  planActualId,
  suscripcionEstado,
  suscripcionFinISO,
  suscripcionBloqueada = false,
  esDemo,
  modulosPermitidos,
  sucursalScope,
}: {
  children: ReactNode;
  nombreEmpresa: string;
  nombreUsuario: string;
  planNombre: string;
  planActualId?: PlanId;
  suscripcionEstado?: "activa" | "trial" | "vencida" | "cancelada" | "suspendida" | null;
  suscripcionFinISO?: string | null;
  suscripcionBloqueada?: boolean;
  esDemo: boolean;
  modulosPermitidos: ModuloAcceso[];
  sucursalScope?: SucursalScopeHeader;
}) {
  const pathname = usePathname();
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [colapsado, setColapsado] = useState(false);
  const [esMovil, setEsMovil] = useState(false);
  const [planesAbierto, setPlanesAbierto] = useState(false);
  const colapsadoVisual = !esMovil && colapsado;
  const permitidos = new Set(modulosPermitidos);
  const grupos = NAV_GROUPS_RESTAURANTE.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter((item) => permitidos.has(item.modulo)),
  })).filter((grupo) => grupo.items.length > 0);
  const commandItems = COMMAND_ITEMS_RESTAURANTE.filter((item) =>
    permitidos.has(item.modulo),
  );

  useEffect(() => {
    setColapsado(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const actualizar = () => setEsMovil(query.matches);

    actualizar();
    query.addEventListener("change", actualizar);
    return () => query.removeEventListener("change", actualizar);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      colapsadoVisual ? ANCHO_COLAPSADO : ANCHO_ABIERTO,
    );
  }, [colapsadoVisual]);

  useEffect(() => {
    if (!esMovil || !menuMovilAbierto) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [esMovil, menuMovilAbierto]);

  useEffect(() => {
    if (esMovil) setMenuMovilAbierto(false);
  }, [pathname, esMovil]);

  function toggleColapsado() {
    setColapsado((prev) => {
      const siguiente = !prev;
      localStorage.setItem(STORAGE_KEY, siguiente ? "1" : "0");
      return siguiente;
    });
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-neutral)]">
      {menuMovilAbierto && (
        <button
          type="button"
          aria-label="Cerrar menu"
          className="fixed inset-0 z-20 bg-black/45 backdrop-blur-sm sm:hidden"
          onClick={() => setMenuMovilAbierto(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-[min(86vw,300px)] flex-col bg-[color:var(--color-dark-bg)] text-[color:var(--color-text-on-dark)] transition-[width,transform] duration-200 sm:w-[var(--sidebar-width)] sm:translate-x-0",
          menuMovilAbierto ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div
          className={cn(
            "flex items-center px-3 pb-4 pt-5",
            colapsadoVisual ? "justify-center" : "justify-between px-5",
          )}
        >
          <Link href="/restaurante" className="flex min-w-0 items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden">
              <ArcaLogo className="h-6 w-auto object-contain" eager />
            </div>
            {!colapsadoVisual && (
              <div className="min-w-0">
                <div className="text-base font-semibold leading-tight">ARCA</div>
                <div className="truncate text-[10px] uppercase tracking-wider text-white/50 leading-tight">
                  {nombreEmpresa}
                </div>
              </div>
            )}
          </Link>
          {esMovil ? (
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(false)}
              aria-label="Cerrar menu"
              title="Cerrar menu"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/60 hover:bg-white/5 hover:text-white"
            >
              <X size={18} />
            </button>
          ) : !colapsadoVisual ? (
            <button
              type="button"
              onClick={toggleColapsado}
              aria-label="Colapsar menu"
              title="Colapsar menu"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/60 hover:bg-white/5 hover:text-white"
            >
              <PanelLeftClose size={18} />
            </button>
          ) : null}
        </div>

        {colapsadoVisual && (
          <button
            type="button"
            onClick={toggleColapsado}
            aria-label="Expandir menu"
            title="Expandir menu"
            className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-md text-white/60 hover:bg-white/5 hover:text-white"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}

        <nav className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
          {grupos.map((grupo) => (
            <div key={grupo.titulo} className="mt-4 first:mt-1">
              {!colapsadoVisual && (
                <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {grupo.titulo}
                </div>
              )}
              <div className="space-y-0.5">
                {grupo.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    activo={esActivo(pathname, item)}
                    colapsado={colapsadoVisual}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          {!colapsadoVisual && (
            <button
              type="button"
              onClick={() => setPlanesAbierto(true)}
              className="w-full rounded-md bg-white/5 p-3 text-left transition hover:bg-white/10"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider text-white/50">
                  Plan {planNombre}
                </span>
                {(esDemo || suscripcionBloqueada) && (
                  <CircleAlert
                    size={12}
                    className={
                      suscripcionBloqueada
                        ? "text-[color:var(--color-error)]"
                        : "text-[color:var(--color-warning)]"
                    }
                  />
                )}
              </div>
              <p className="mt-1 text-[12px] text-white/70">
                {suscripcionBloqueada
                  ? "Pago pendiente"
                  : esDemo
                    ? "Funciones limitadas"
                    : suscripcionEstado === "trial"
                      ? "Prueba gratis activa"
                      : "Suscripcion activa"}
              </p>
              <span className="mt-2 inline-block text-[12px] font-medium text-[color:var(--color-tertiary-light)]">
                Ver detalles
              </span>
            </button>
          )}

          <Link
            href="/restaurante/mi-cuenta"
            title={colapsadoVisual ? nombreUsuario : undefined}
            className={cn(
              "mt-3 flex items-center rounded-md p-2 text-[13px] text-white/80 hover:bg-white/5",
              colapsadoVisual ? "justify-center" : "gap-2.5",
            )}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-tertiary)]/30 text-[11px] font-semibold uppercase">
              {iniciales(nombreUsuario)}
            </div>
            {!colapsadoVisual && (
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium leading-tight">
                  {nombreUsuario}
                </div>
                <div className="text-[10px] text-white/50 leading-tight">
                  Mi cuenta
                </div>
              </div>
            )}
          </Link>
        </div>

        <PlanesModal
          abierto={planesAbierto}
          onCerrar={() => setPlanesAbierto(false)}
          planActual={planNombre}
          planActualId={planActualId}
          suscripcionEstado={suscripcionEstado}
          suscripcionFinISO={suscripcionFinISO}
          suscripcionBloqueada={suscripcionBloqueada}
        />
      </aside>

      <div className="min-w-0 transition-[margin] duration-200 sm:ml-[var(--sidebar-width)]">
        <Header
          breadcrumb={[{ label: nombreEmpresa }, { label: "Restaurante" }]}
          notificaciones={[]}
          commandItems={commandItems}
          sucursalScope={sucursalScope}
          onAbrirMenu={() => setMenuMovilAbierto(true)}
        />
        <main className="min-w-0 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  item,
  activo,
  colapsado,
}: {
  item: NavItem;
  activo: boolean;
  colapsado: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={colapsado ? item.label : undefined}
      className={cn(
        "flex items-center rounded-md py-2 text-[13px] transition-colors",
        colapsado ? "justify-center px-0" : "gap-2.5 px-2.5",
        activo
          ? "bg-[color:var(--color-tertiary)]/20 text-white font-medium"
          : "text-white/70 hover:bg-white/5 hover:text-white",
      )}
    >
      <Icon size={16} className="shrink-0" />
      {!colapsado && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function esActivo(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "??";
}
