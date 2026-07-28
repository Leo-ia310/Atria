"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";

type Item = { label: string; href: string; grupo: string; keywords?: string };

const ITEMS: Item[] = [
  { label: "Dashboard", href: "/dashboard", grupo: "Operativo" },
  { label: "Punto de Venta (POS)", href: "/pos", grupo: "Operativo", keywords: "caja cobrar vender" },
  { label: "Caja / Sesiones", href: "/caja", grupo: "Operativo", keywords: "arqueo apertura cierre" },
  { label: "Ventas", href: "/ventas", grupo: "Operativo" },
  { label: "Inventario", href: "/inventario", grupo: "Operativo", keywords: "productos stock" },
  { label: "Nuevo producto", href: "/inventario/nuevo", grupo: "Operativo" },
  { label: "Clientes", href: "/clientes", grupo: "Operativo" },
  { label: "Compras", href: "/compras", grupo: "Operativo", keywords: "proveedores" },

  { label: "Facturas", href: "/facturas", grupo: "Finanzas", keywords: "documentos recibos" },
  { label: "Cobros (CxC)", href: "/cxc", grupo: "Finanzas", keywords: "cuentas por cobrar" },
  { label: "Pagos (CxP)", href: "/cxp", grupo: "Finanzas", keywords: "cuentas por pagar" },
  { label: "Contabilidad", href: "/contabilidad", grupo: "Finanzas", keywords: "asientos libro diario mayor balance" },
  { label: "Libro Diario", href: "/contabilidad/libro-diario", grupo: "Finanzas" },
  { label: "Estado de Resultados", href: "/contabilidad/estado-resultados", grupo: "Finanzas" },
  { label: "Balance General", href: "/contabilidad/balance-general", grupo: "Finanzas" },
  { label: "Tesorería", href: "/tesoreria", grupo: "Finanzas", keywords: "bancos gastos" },
  { label: "Gastos", href: "/tesoreria/gastos", grupo: "Finanzas" },

  { label: "Panel RRHH", href: "/rrhh", grupo: "Recursos Humanos" },
  { label: "Empleados", href: "/rrhh/empleados", grupo: "Recursos Humanos" },
  { label: "Asistencia", href: "/rrhh/asistencia", grupo: "Recursos Humanos" },
  { label: "Historial de asistencias", href: "/rrhh/asistencia/historial", grupo: "Recursos Humanos" },
  { label: "Nómina", href: "/rrhh/nomina", grupo: "Recursos Humanos", keywords: "pago salario planilla" },
  { label: "Feriados", href: "/rrhh/feriados", grupo: "Recursos Humanos" },
  { label: "Solicitudes", href: "/rrhh/solicitudes", grupo: "Recursos Humanos", keywords: "permisos vacaciones" },
  { label: "Reclutamiento", href: "/rrhh/reclutamiento", grupo: "Recursos Humanos", keywords: "vacantes candidatos" },

  { label: "Reportes", href: "/reportes", grupo: "Gestión" },
  { label: "Reporte de inventario", href: "/reportes/inventario", grupo: "Gestión" },
  { label: "Reporte de ventas", href: "/reportes/ventas", grupo: "Gestión" },
  { label: "Configuración", href: "/configuracion", grupo: "Gestión" },
  { label: "Usuarios", href: "/configuracion/usuarios", grupo: "Gestión" },
  { label: "Roles y permisos", href: "/configuracion/roles", grupo: "Gestión" },
  { label: "Cajas", href: "/configuracion/cajas", grupo: "Gestión" },
  { label: "Impuestos", href: "/configuracion/impuestos", grupo: "Gestión" },
  { label: "Formas de pago", href: "/configuracion/formas-pago", grupo: "Gestión" },
  { label: "Cuentas financieras", href: "/configuracion/cuentas-financieras", grupo: "Gestión" },
  { label: "Facturación fiscal", href: "/configuracion/facturacion", grupo: "Gestión", keywords: "cai secuencias" },
  { label: "Sucursales", href: "/configuracion/sucursales", grupo: "Gestión" },
  { label: "Mi cuenta", href: "/mi-cuenta", grupo: "Gestión", keywords: "perfil contraseña" },
];

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function CommandPalette({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtrados = useMemo(() => {
    const query = norm(q.trim());
    if (!query) return ITEMS;
    return ITEMS.filter((it) =>
      norm(`${it.label} ${it.grupo} ${it.keywords ?? ""}`).includes(query),
    );
  }, [q]);

  useEffect(() => {
    if (abierto) {
      setQ("");
      setIdx(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(t);
        document.body.style.overflow = "";
      };
    }
  }, [abierto]);

  useEffect(() => {
    setIdx(0);
  }, [q]);

  function irA(href: string) {
    onCerrar();
    router.push(href);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCerrar();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, filtrados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtrados[idx];
      if (item) irA(item.href);
    }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${idx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-md"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[color:var(--color-border)] px-4">
          <Search size={16} className="text-[color:var(--color-text-muted)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Buscar módulo o página…"
            className="h-12 flex-1 bg-transparent text-small outline-none placeholder:text-[color:var(--color-text-muted)]"
          />
          <kbd className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-1.5 py-0.5 text-[10px] text-[color:var(--color-text-muted)]">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {filtrados.length === 0 ? (
            <div className="px-3 py-6 text-center text-small text-[color:var(--color-text-muted)]">
              Sin resultados para “{q}”.
            </div>
          ) : (
            filtrados.map((it, i) => (
              <button
                key={it.href}
                data-idx={i}
                type="button"
                onMouseEnter={() => setIdx(i)}
                onClick={() => irA(it.href)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-small transition ${
                  i === idx
                    ? "bg-[color:var(--color-primary)] text-white"
                    : "hover:bg-[color:var(--color-surface-2)]"
                }`}
              >
                <span>
                  <span className="font-medium">{it.label}</span>
                  <span
                    className={`ml-2 text-[11px] ${
                      i === idx ? "text-white/70" : "text-[color:var(--color-text-muted)]"
                    }`}
                  >
                    {it.grupo}
                  </span>
                </span>
                {i === idx && <CornerDownLeft size={13} className="opacity-80" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
