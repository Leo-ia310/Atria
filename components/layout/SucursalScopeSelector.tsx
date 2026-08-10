"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const COOKIE_NAME = "arca:sucursal-scope";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type SucursalOption = {
  id: string;
  nombre: string;
};

type SucursalScopeHeader = {
  visible: boolean;
  modo: "all" | "selected";
  sucursales: SucursalOption[];
  sucursalIds: string[];
  etiqueta: string;
};

export function SucursalScopeSelector({
  scope,
}: {
  scope: SucursalScopeHeader;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const allIds = useMemo(() => scope.sucursales.map((s) => s.id), [scope.sucursales]);
  const [abierto, setAbierto] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState(
    scope.modo === "all" ? allIds : scope.sucursalIds,
  );

  useEffect(() => {
    setSeleccionadas(scope.modo === "all" ? allIds : scope.sucursalIds);
  }, [allIds, scope.modo, scope.sucursalIds]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setAbierto(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAbierto(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (!scope.visible) return null;

  const todasActivas = seleccionadas.length === allIds.length;
  const etiqueta = todasActivas
    ? "Todas las sucursales"
    : `${seleccionadas.length} sucursal${seleccionadas.length === 1 ? "" : "es"}`;

  function guardar(nextIds: string[]) {
    const normalizadas =
      nextIds.length === 0 || nextIds.length === allIds.length ? allIds : nextIds;
    const cookieValue =
      normalizadas.length === allIds.length ? "all" : normalizadas.join(",");
    setSeleccionadas(normalizadas);
    document.cookie = `${COOKIE_NAME}=${cookieValue}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    router.refresh();
  }

  function alternarSucursal(id: string) {
    const ids = seleccionadas.includes(id)
      ? seleccionadas.filter((actual) => actual !== id)
      : [...seleccionadas, id];
    guardar(ids);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((actual) => !actual)}
        aria-expanded={abierto}
        className="flex h-9 w-9 items-center justify-center gap-2 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-0 text-small text-[color:var(--color-text-secondary)] transition hover:border-[color:var(--color-border-strong)] sm:w-auto sm:max-w-[230px] sm:justify-start sm:px-3"
        title={etiqueta}
      >
        <Building2 size={14} className="shrink-0 text-[color:var(--color-primary)]" />
        <span className="hidden truncate sm:block">{etiqueta}</span>
        <ChevronDown
          size={14}
          className={cn(
            "hidden shrink-0 text-[color:var(--color-text-muted)] transition sm:block",
            abierto && "rotate-180",
          )}
        />
      </button>

      {abierto && (
        <div className="absolute right-0 z-50 mt-2 w-[min(88vw,18rem)] overflow-hidden rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg">
          <div className="border-b border-[color:var(--color-border)] px-3 py-2">
            <label className="flex cursor-pointer items-center gap-2 text-small font-medium text-[color:var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={todasActivas}
                onChange={() => guardar(allIds)}
                className="h-4 w-4 rounded border-[color:var(--color-border)]"
              />
              Todas las sucursales
            </label>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {scope.sucursales.map((sucursal) => {
              const activa = seleccionadas.includes(sucursal.id);
              return (
                <label
                  key={sucursal.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-small text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-2)]"
                >
                  <input
                    type="checkbox"
                    checked={activa}
                    onChange={() => alternarSucursal(sucursal.id)}
                    className="h-4 w-4 rounded border-[color:var(--color-border)]"
                  />
                  <span className="min-w-0 flex-1 truncate">{sucursal.nombre}</span>
                  {activa && (
                    <Check size={13} className="shrink-0 text-[color:var(--color-success)]" />
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
