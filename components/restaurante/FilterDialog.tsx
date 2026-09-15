"use client";

import { type ReactNode, useState } from "react";
import { Filter, X } from "lucide-react";

export function FilterDialog({
  title = "Filtros",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="arca-btn arca-btn-secondary arca-btn-sm">
        <Filter size={14} /> Filtros
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar filtros" onClick={() => setOpen(false)} />
          <section className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold leading-tight">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-2)]"
                aria-label="Cerrar filtros"
              >
                <X size={18} />
              </button>
            </div>
            {children}
          </section>
        </div>
      )}
    </>
  );
}
