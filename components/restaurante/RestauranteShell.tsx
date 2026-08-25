"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ChefHat,
  ClipboardList,
  Gift,
  LayoutDashboard,
  Menu,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Table2,
  UsersRound,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_PRINCIPAL: NavItem[] = [
  { href: "/restaurante", label: "Dashboard", icon: LayoutDashboard },
  { href: "/restaurante/pos", label: "POS", icon: ShoppingCart },
  { href: "/restaurante/mesas", label: "Mesas", icon: Table2 },
  { href: "/restaurante/kds", label: "KDS", icon: ChefHat },
  { href: "/restaurante/ordenes", label: "Ordenes", icon: ClipboardList },
  { href: "/restaurante/menu", label: "Menu QR", icon: Utensils },
  { href: "/restaurante/recetas", label: "Recetas", icon: ReceiptText },
  { href: "/restaurante/inventario", label: "Insumos", icon: Package },
  { href: "/restaurante/mermas", label: "Mermas", icon: Package },
  { href: "/restaurante/reservaciones", label: "Reservas", icon: CalendarDays },
  { href: "/restaurante/comensales", label: "Comensales", icon: UsersRound },
  { href: "/restaurante/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/restaurante/promociones", label: "Promos", icon: Gift },
];

const NAV_CORE: NavItem[] = [
  { href: "/compras", label: "Compras", icon: Package },
  { href: "/caja", label: "Caja", icon: ShoppingCart },
  { href: "/contabilidad", label: "Contabilidad", icon: BarChart3 },
  { href: "/configuracion", label: "Configuracion", icon: Settings },
];

export function RestauranteShell({
  children,
  nombreEmpresa,
  nombreUsuario,
  planNombre,
}: {
  children: ReactNode;
  nombreEmpresa: string;
  nombreUsuario: string;
  planNombre: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[color:var(--color-neutral)] text-[color:var(--color-text-primary)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-[color:var(--color-border)] px-4">
          <Link href="/restaurante" className="min-w-0">
            <div className="truncate text-base font-semibold">ARCA Restaurante</div>
            <div className="truncate text-[12px] text-[color:var(--color-text-muted)]">
              {nombreEmpresa}
            </div>
          </Link>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-2)] lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-2 text-label">Operacion</div>
          <div className="space-y-1">
            {NAV_PRINCIPAL.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                activo={esActivo(pathname, item.href)}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </div>

          <div className="mb-2 mt-6 px-2 text-label">ARCA Core</div>
          <div className="space-y-1">
            {NAV_CORE.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                activo={esActivo(pathname, item.href)}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </div>
        </nav>

        <div className="border-t border-[color:var(--color-border)] p-4">
          <div className="truncate text-small font-medium">{nombreUsuario}</div>
          <div className="mt-0.5 truncate text-[12px] text-[color:var(--color-text-muted)]">
            {planNombre}
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/35 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menu"
        />
      )}

      <div className="min-w-0 lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--color-border)] text-[color:var(--color-text-secondary)] lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <div className="truncate text-small font-semibold uppercase text-[color:var(--color-secondary)]">
                ARCA Restaurante
              </div>
              <div className="truncate text-[12px] text-[color:var(--color-text-muted)]">
                POS, mesas, cocina, QR y food cost
              </div>
            </div>
          </div>
          <Link href="/pos" className="arca-btn arca-btn-secondary arca-btn-sm">
            POS retail
          </Link>
        </header>
        <main className="min-w-0 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  item,
  activo,
  onClick,
}: {
  item: NavItem;
  activo: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex h-10 items-center gap-3 rounded-md px-3 text-small font-medium transition",
        activo
          ? "bg-[color:var(--color-primary)] text-[color:var(--color-text-on-primary)]"
          : "text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-text-primary)]",
      )}
    >
      <Icon size={17} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function esActivo(pathname: string, href: string): boolean {
  if (href === "/restaurante") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
