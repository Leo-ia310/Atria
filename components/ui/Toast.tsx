"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTipo = "success" | "error" | "warning" | "info";
type Toast = { id: string; tipo: ToastTipo; mensaje: string };

type Ctx = { mostrar: (tipo: ToastTipo, mensaje: string) => void };
const ToastContext = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast fuera de ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const mostrar = useCallback((tipo: ToastTipo, mensaje: string) => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, tipo, mensaje }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);
  const value = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed inset-x-3 bottom-3 z-50 flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4">
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            tipo={t.tipo}
            mensaje={t.mensaje}
            onCerrar={() => setToasts((arr) => arr.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  tipo,
  mensaje,
  onCerrar,
}: {
  tipo: ToastTipo;
  mensaje: string;
  onCerrar: () => void;
}) {
  const Icon = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  }[tipo];

  return (
    <div
      className={cn(
        "flex w-full items-start gap-3 rounded-md border bg-[color:var(--color-surface)] p-3 shadow-lg sm:w-80",
        tipo === "success" && "border-[color:var(--color-success)]/30",
        tipo === "error" && "border-[color:var(--color-error)]/30",
        tipo === "warning" && "border-[color:var(--color-warning)]/30",
        tipo === "info" && "border-[color:var(--color-info)]/30",
      )}
    >
      <Icon
        size={18}
        className={cn(
          "flex-shrink-0",
          tipo === "success" && "text-[color:var(--color-success)]",
          tipo === "error" && "text-[color:var(--color-error)]",
          tipo === "warning" && "text-[color:var(--color-warning)]",
          tipo === "info" && "text-[color:var(--color-info)]",
        )}
      />
      <p className="flex-1 text-small text-[color:var(--color-text-primary)]">{mensaje}</p>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar notificacion"
        className="flex-shrink-0 rounded p-0.5 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-2)]"
      >
        <X size={14} />
      </button>
    </div>
  );
}
