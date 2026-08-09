"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleAlert, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlanesModal } from "@/components/layout/PlanesModal";
import { NAV_GROUPS } from "@/components/layout/nav-items";
import type { ModuloAcceso } from "@/lib/access-control";

const ANCHO_ABIERTO = "240px";
const ANCHO_COLAPSADO = "68px";
const STORAGE_KEY = "arca:sidebar-colapsado";

export function Sidebar({
  nombreEmpresa,
  planNombre,
  esDemo,
  nombreUsuario,
  modulosPermitidos,
  mobileOpen = false,
  onMobileClose,
}: {
  nombreEmpresa: string;
  planNombre: string;
  esDemo: boolean;
  nombreUsuario: string;
  modulosPermitidos: ModuloAcceso[];
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const [colapsado, setColapsado] = useState(false);
  const [esMovil, setEsMovil] = useState(false);
  const [planesAbierto, setPlanesAbierto] = useState(false);
  const colapsadoVisual = !esMovil && colapsado;
  const permitidos = new Set(modulosPermitidos);
  const grupos = NAV_GROUPS.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter((item) => permitidos.has(item.modulo)),
  })).filter((grupo) => grupo.items.length > 0);

  useEffect(() => {
    const guardado = localStorage.getItem(STORAGE_KEY) === "1";
    setColapsado(guardado);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
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
    if (!esMovil || !mobileOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [esMovil, mobileOpen]);

  useEffect(() => {
    if (esMovil) onMobileClose?.();
  }, [pathname, esMovil, onMobileClose]);

  function toggle() {
    setColapsado((prev) => {
      const siguiente = !prev;
      localStorage.setItem(STORAGE_KEY, siguiente ? "1" : "0");
      return siguiente;
    });
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menu"
          className="fixed inset-0 z-20 bg-black/45 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-[min(86vw,300px)] flex-col bg-[color:var(--color-dark-bg)] text-[color:var(--color-text-on-dark)] transition-[width,transform] duration-200 md:w-[var(--sidebar-width)] md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div
          className={cn(
            "flex items-center px-3 pb-4 pt-5",
            colapsadoVisual ? "justify-center" : "justify-between px-5",
          )}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-tertiary)]/15 text-[color:var(--color-tertiary-light)]">
              <span className="text-lg font-bold">A</span>
            </div>
            {!colapsadoVisual && (
              <div className="min-w-0">
                <div className="text-base font-semibold leading-tight">ARCA</div>
                <div className="truncate text-[10px] uppercase tracking-wider text-white/50 leading-tight">
                  {nombreEmpresa}
                </div>
              </div>
            )}
          </div>
          {esMovil ? (
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Cerrar menu"
              title="Cerrar menu"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/60 hover:bg-white/5 hover:text-white"
            >
              <X size={18} />
            </button>
          ) : !colapsadoVisual ? (
            <button
              type="button"
              onClick={toggle}
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
            onClick={toggle}
            aria-label="Expandir menu"
            title="Expandir menu"
            className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-md text-white/60 hover:bg-white/5 hover:text-white"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}

        <nav className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
          {grupos.map((g) => (
            <div key={g.titulo} className="mt-4 first:mt-1">
              {!colapsadoVisual && (
                <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {g.titulo}
                </div>
              )}
              <div className="space-y-0.5">
                {g.items.map(({ href, label, icon: Icon, subitem, exact }) => {
                  const activo = exact
                    ? pathname === href
                    : pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={colapsadoVisual ? label : undefined}
                      className={cn(
                        "flex items-center rounded-md py-2 text-[13px] transition-colors",
                        colapsadoVisual
                          ? "justify-center px-0"
                          : subitem
                            ? "gap-2.5 px-2.5 pl-8 text-[12px]"
                            : "gap-2.5 px-2.5",
                        activo
                          ? "bg-[color:var(--color-tertiary)]/20 text-white font-medium"
                          : "text-white/70 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon size={subitem ? 14 : 16} className="shrink-0" />
                      {!colapsadoVisual && label}
                    </Link>
                  );
                })}
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
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-white/50">
                  Plan {planNombre}
                </span>
                {esDemo && (
                  <CircleAlert
                    size={12}
                    className="text-[color:var(--color-warning)]"
                  />
                )}
              </div>
              {esDemo ? (
                <>
                  <p className="mt-1 text-[12px] text-white/70">
                    Funciones limitadas
                  </p>
                  <span className="mt-2 inline-block text-[12px] font-medium text-[color:var(--color-tertiary-light)] group-hover:text-white">
                    Mejorar plan
                  </span>
                </>
              ) : (
                <p className="mt-1 text-[12px] text-white/70">Suscripcion activa</p>
              )}
            </button>
          )}

          <Link
            href="/mi-cuenta"
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
        />
      </aside>
    </>
  );
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "??";
}
