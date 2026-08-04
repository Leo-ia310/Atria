"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArcaLogo } from "@/components/marketing/ArcaLogo";

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
          ? "bg-[#0b0416]/50 shadow-[0_10px_35px_rgba(7,2,18,0.22)] backdrop-blur-xl"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <ArcaLogo className="h-8 w-auto" eager />
          <span className="text-base font-semibold text-white">ARCA</span>
        </Link>

        <nav className="hidden items-center gap-5 text-small text-white/75 lg:flex">
          <a href="#caracteristicas" className="transition-colors hover:text-white">
            Características
          </a>
          <a href="#modulos" className="transition-colors hover:text-white">
            Módulos
          </a>
          <a href="#calculadora" className="transition-colors hover:text-white">
            Calculadora
          </a>
          <a href="#precios" className="transition-colors hover:text-white">
            Precios
          </a>
          <a href="#faq" className="transition-colors hover:text-white">
            FAQ
          </a>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/login"
            className="arca-btn arca-btn-sm border-white/20 bg-white/10 text-white transition-colors hover:bg-white/16"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="arca-btn arca-btn-sm bg-white text-[#160827] transition-colors hover:bg-[#efe7ff]"
          >
            Empieza gratis
          </Link>
        </div>

        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setMenuAbierto((s) => !s)}
            className="arca-btn p-2 text-white hover:bg-white/10"
            aria-label="Menú"
            aria-expanded={menuAbierto}
          >
            {menuAbierto ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {menuAbierto && (
        <div className="border-t border-white/10 bg-[#0b0416]/90 px-5 py-4 text-white backdrop-blur-xl lg:hidden">
          <nav className="flex flex-col gap-3 text-small text-white/80">
            <a href="#caracteristicas" onClick={() => setMenuAbierto(false)}>
              Características
            </a>
            <a href="#modulos" onClick={() => setMenuAbierto(false)}>
              Módulos
            </a>
            <a href="#calculadora" onClick={() => setMenuAbierto(false)}>
              Calculadora
            </a>
            <a href="#precios" onClick={() => setMenuAbierto(false)}>
              Precios
            </a>
            <a href="#faq" onClick={() => setMenuAbierto(false)}>
              FAQ
            </a>
            <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-3">
              <Link
                href="/login"
                className="arca-btn border-white/20 bg-white/10 text-white"
              >
                Iniciar sesión
              </Link>
              <Link href="/registro" className="arca-btn bg-white text-[#160827]">
                Empieza gratis
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
