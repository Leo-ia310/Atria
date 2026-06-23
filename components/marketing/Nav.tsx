"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 8);
    handle();
    window.addEventListener("scroll", handle, { passive: true });
    return () => window.removeEventListener("scroll", handle);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-200",
        scrolled
          ? "bg-[color:var(--color-surface)]/85 backdrop-blur-md border-b border-[color:var(--color-border)]"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[color:var(--color-primary)] text-white">
            <span className="text-base font-bold">A</span>
          </div>
          <span className="text-base font-semibold text-[color:var(--color-text-primary)]">
            ATRIA
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-small md:flex">
          <a
            href="#caracteristicas"
            className="text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
          >
            Características
          </a>
          <a
            href="#precios"
            className="text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
          >
            Precios
          </a>
          <a
            href="#faq"
            className="text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
          >
            FAQ
          </a>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="atria-btn atria-btn-ghost atria-btn-sm"
          >
            Iniciar sesión
          </Link>
          <Link href="/registro" className="atria-btn atria-btn-primary atria-btn-sm">
            Empieza gratis
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuAbierto((s) => !s)}
          className="atria-btn atria-btn-ghost p-2 md:hidden"
          aria-label="Menú"
        >
          {menuAbierto ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {menuAbierto && (
        <div className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-3 text-small">
            <a href="#caracteristicas" onClick={() => setMenuAbierto(false)}>
              Características
            </a>
            <a href="#precios" onClick={() => setMenuAbierto(false)}>
              Precios
            </a>
            <a href="#faq" onClick={() => setMenuAbierto(false)}>
              FAQ
            </a>
            <div className="mt-2 flex flex-col gap-2 border-t border-[color:var(--color-border)] pt-3">
              <Link href="/login" className="atria-btn atria-btn-secondary">
                Iniciar sesión
              </Link>
              <Link href="/registro" className="atria-btn atria-btn-primary">
                Empieza gratis
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
