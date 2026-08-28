"use client";

import { RotateCcw } from "lucide-react";

export default function RestauranteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="arca-card max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">No pudimos cargar esta vista</h1>
        <p className="mt-2 text-small text-[color:var(--color-text-muted)]">
          Intenta de nuevo. Si el problema continua, Soporte puede revisar el evento sin exponer datos tecnicos.
        </p>
        <button
          type="button"
          onClick={reset}
          className="arca-btn arca-btn-primary mt-4 justify-center"
        >
          <RotateCcw size={14} /> Reintentar
        </button>
      </div>
    </div>
  );
}
