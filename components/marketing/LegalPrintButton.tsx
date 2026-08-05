"use client";

import { Printer } from "lucide-react";

export function LegalPrintButton() {
  const imprimir = () => {
    document.body.classList.add("legal-imprimiendo");
    const limpiar = () => document.body.classList.remove("legal-imprimiendo");
    window.addEventListener("afterprint", limpiar, { once: true });
    window.print();
    // Respaldo por si el navegador no dispara afterprint.
    window.setTimeout(limpiar, 1500);
  };

  return (
    <button
      type="button"
      onClick={imprimir}
      className="arca-btn arca-btn-sm border-white/20 bg-white/10 text-white transition-colors hover:bg-white/16"
    >
      <Printer size={14} />
      Imprimir / PDF
    </button>
  );
}
