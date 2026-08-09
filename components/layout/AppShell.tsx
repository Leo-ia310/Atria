"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header, type SucursalScopeHeader } from "@/components/layout/Header";
import type { Notificacion } from "@/components/layout/NotificacionesBell";
import type { CommandItem } from "@/components/layout/nav-items";
import type { ModuloAcceso } from "@/lib/access-control";

export function AppShell({
  children,
  banner,
  nombreEmpresa,
  planNombre,
  esDemo,
  nombreUsuario,
  modulosPermitidos,
  notificaciones,
  commandItems,
  sucursalScope,
}: {
  children: ReactNode;
  banner?: ReactNode;
  nombreEmpresa: string;
  planNombre: string;
  esDemo: boolean;
  nombreUsuario: string;
  modulosPermitidos: ModuloAcceso[];
  notificaciones: Notificacion[];
  commandItems: CommandItem[];
  sucursalScope?: SucursalScopeHeader;
}) {
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const cerrarMenuMovil = useCallback(() => setMenuMovilAbierto(false), []);

  return (
    <div className="min-h-screen bg-[color:var(--color-neutral)]">
      <Sidebar
        nombreEmpresa={nombreEmpresa}
        planNombre={planNombre}
        esDemo={esDemo}
        nombreUsuario={nombreUsuario}
        modulosPermitidos={modulosPermitidos}
        mobileOpen={menuMovilAbierto}
        onMobileClose={cerrarMenuMovil}
      />

      <div className="min-w-0 transition-[margin] duration-200 md:ml-[var(--sidebar-width)]">
        <Header
          breadcrumb={[{ label: nombreEmpresa }]}
          notificaciones={notificaciones}
          commandItems={commandItems}
          sucursalScope={sucursalScope}
          onAbrirMenu={() => setMenuMovilAbierto(true)}
        />
        {banner}
        <main className="min-w-0 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
