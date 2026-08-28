"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Modal({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
  footer,
  ancho = "md",
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  footer?: ReactNode;
  ancho?: "sm" | "md" | "lg" | "xl";
}) {
  const onCerrarRef = useRef(onCerrar);

  useEffect(() => {
    onCerrarRef.current = onCerrar;
  }, [onCerrar]);

  useEffect(() => {
    if (!abierto) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrarRef.current();
    };
    window.addEventListener("keydown", handle);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handle);
      document.body.style.overflow = "";
    };
  }, [abierto]);

  if (!abierto) return null;

  const anchoClase = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[ancho];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--color-dark-bg)]/50 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar modal"
        className="absolute inset-0 cursor-default"
        onClick={onCerrar}
      />
      <div
        className={cn(
          "arca-card relative max-h-[92vh] w-full overflow-hidden bg-[color:var(--color-surface)]",
          anchoClase,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-border)] px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-[color:var(--color-text-primary)]">
              {titulo}
            </h2>
            {descripcion && (
              <p className="mt-0.5 text-small text-[color:var(--color-text-muted)]">
                {descripcion}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar modal"
            className="rounded-md p-1 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-text-primary)]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3 sm:px-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
