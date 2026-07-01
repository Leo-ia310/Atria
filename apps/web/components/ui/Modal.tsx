"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
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
  useEffect(() => {
    if (!abierto) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", handle);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handle);
      document.body.style.overflow = "";
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const anchoClase = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[ancho];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-dark-bg)]/50 p-4 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div
        className={cn(
          "atria-card w-full overflow-hidden bg-[color:var(--color-surface)]",
          anchoClase,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-border)] px-5 py-4">
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
            className="rounded-md p-1 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-text-primary)]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
