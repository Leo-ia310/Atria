"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Users,
  Package,
  Truck,
  BookOpen,
  UserCog,
  Building2,
  BarChart3,
  Settings,
  CreditCard,
  CircleAlert,
} from "lucide-react";
import { primaryNavigation, type NavigationItem } from "@atria/contracts";
import { cn, iniciales } from "@/lib/utils";
import { useSession } from "./SessionProvider";

const ICONOS: Record<string, React.ComponentType<{ size?: number }>> = {
  dashboard: LayoutDashboard,
  pos: ShoppingCart,
  ventas: Receipt,
  clientes: Users,
  inventario: Package,
  compras: Truck,
  contabilidad: BookOpen,
  empleados: UserCog,
  sucursales: Building2,
  reportes: BarChart3,
  configuracion: Settings,
  facturacion: CreditCard,
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useSession();

  const permisos = new Set(user?.permissions ?? []);
  const items = primaryNavigation.filter(
    (i: NavigationItem) => !i.permission || permisos.has(i.permission),
  );

  return (
    <aside
      style={{ width: "var(--sidebar-width)" }}
      className="fixed inset-y-0 left-0 z-30 flex flex-col bg-[color:var(--color-dark-bg)] text-[color:var(--color-text-on-dark)]"
    >
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[color:var(--color-tertiary)]/15 text-[color:var(--color-tertiary-light)]">
          <span className="text-lg font-bold">A</span>
        </div>
        <div className="min-w-0">
          <div className="text-base font-semibold leading-tight">Atria</div>
          <div className="truncate text-[10px] uppercase tracking-wider text-white/50 leading-tight">
            {user?.organizationName ?? "—"}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-0.5">
          {items.map((item) => {
            const Icon = ICONOS[item.key] ?? CircleAlert;
            const activo = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                  activo
                    ? "bg-[color:var(--color-tertiary)]/20 text-white font-medium"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-2.5 rounded-md p-2 text-[13px] text-white/80 hover:bg-white/5"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--color-tertiary)]/30 text-[11px] font-semibold uppercase">
            {iniciales(`${user?.firstName ?? ""} ${user?.lastName ?? ""}`)}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate text-[12px] font-medium leading-tight">
              {user ? `${user.firstName} ${user.lastName}` : "Cargando..."}
            </div>
            <div className="text-[10px] text-white/50 leading-tight">Cerrar sesión</div>
          </div>
        </button>
      </div>
    </aside>
  );
}
