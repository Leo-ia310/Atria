"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: React.ComponentType<{ size?: number }> };

const GRUPOS: { titulo: string; items: Item[] }[] = [
  {
    titulo: "Operativo",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/pos", label: "POS", icon: ShoppingCart },
      { href: "/ventas", label: "Ventas", icon: Receipt },
      { href: "/inventario", label: "Inventario", icon: Package },
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/compras", label: "Compras", icon: Truck },
    ],
  },
  {
    titulo: "Finanzas",
    items: [
      { href: "/contabilidad", label: "Contabilidad", icon: BookOpen },
      { href: "/tesoreria", label: "Tesorería", icon: Wallet },
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
  return (
    <aside
      style={{ width: "var(--sidebar-width)" }}
      className="fixed inset-y-0 left-0 z-30 flex flex-col bg-[color:var(--color-dark-bg)] text-[color:var(--color-text-on-dark)]"
    >
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[color:var(--color-tertiary)]/15 text-[color:var(--color-tertiary-light)]">
          <span className="text-lg font-bold">A</span>
        </div>
        <div>
          <div className="text-base font-semibold leading-tight">ATRIA</div>
          <div className="text-[10px] uppercase tracking-wider text-white/50 leading-tight">
            {nombreEmpresa}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {GRUPOS.map((g) => (
          <div key={g.titulo} className="mt-4 first:mt-1">
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              {g.titulo}
            </div>
            <div className="space-y-0.5">
              {g.items.map(({ href, label, icon: Icon }) => {
                const activo = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                      activo
                        ? "bg-[color:var(--color-tertiary)]/20 text-white font-medium"
                        : "text-white/70 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
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

        <Link
          href="/configuracion"
          className="mt-3 flex items-center gap-2.5 rounded-md p-2 text-[13px] text-white/80 hover:bg-white/5"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--color-tertiary)]/30 text-[11px] font-semibold uppercase">
            {iniciales(nombreUsuario)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium leading-tight">
              {nombreUsuario}
            </div>
            <div className="text-[10px] text-white/50 leading-tight">Mi cuenta</div>
          </div>
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
