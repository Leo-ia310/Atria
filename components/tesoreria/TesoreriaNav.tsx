"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Receipt, Repeat2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/tesoreria", label: "Resumen", icon: Wallet },
  { href: "/tesoreria/gastos", label: "Gastos", icon: Receipt },
  { href: "/tesoreria/gastos/recurrentes", label: "Recurrentes", icon: Repeat2 },
];

function estaActivo(pathname: string, href: string): boolean {
  if (href === "/tesoreria") return pathname === href;
  if (href === "/tesoreria/gastos") {
    return pathname === href || pathname === `${href}/nuevo`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TesoreriaNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-5 overflow-x-auto border-b border-[color:var(--color-border)]" aria-label="Navegación de tesorería">
      <div className="flex min-w-max gap-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const activo = estaActivo(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-small transition",
                activo
                  ? "border-[color:var(--color-primary)] font-semibold text-[color:var(--color-primary)]"
                  : "border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]",
              )}
            >
              <Icon size={15} /> {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
