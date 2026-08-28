"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import type { CommandItem } from "@/components/layout/nav-items";

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function contieneTexto(texto: string, busqueda: string) {
  return texto.includes(busqueda);
}

export function CommandPalette({
  abierto,
  onCerrar,
  items,
}: {
  abierto: boolean;
  onCerrar: () => void;
  items: CommandItem[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtrados = useMemo(() => {
    const query = norm(q.trim());
    if (!query) return items;
    return items.filter((it) =>
      contieneTexto(norm(`${it.label} ${it.grupo} ${it.keywords ?? ""}`), query),
    );
  }, [items, q]);

  useEffect(() => {
    if (abierto) {
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-md">
      <button
        type="button"
        aria-label="Cerrar paleta de comandos"
        className="absolute inset-0 cursor-default"
        onClick={onCerrar}
      />
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[color:var(--color-border)] px-4">
          <Search size={16} className="text-[color:var(--color-text-muted)]" />
          <label htmlFor="command-palette-search" className="sr-only">
            Buscar modulo o pagina
          </label>
          <input
            id="command-palette-search"
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Buscar módulo o página..."
            className="h-12 flex-1 bg-transparent text-small outline-none placeholder:text-[color:var(--color-text-muted)]"
          />
          <kbd className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-1.5 py-0.5 text-[10px] text-[color:var(--color-text-muted)]">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {filtrados.length === 0 ? (
            <div className="px-3 py-6 text-center text-small text-[color:var(--color-text-muted)]">
              Sin resultados para "{q}".
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
