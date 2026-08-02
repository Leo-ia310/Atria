"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

function abrirImpresion() {
  document.body.classList.add("imprimiendo-recibos-lote");
  const cleanup = () => {
    document.body.classList.remove("imprimiendo-recibos-lote");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

export function AutoPrintFacturas({ total }: { total: number }) {
  const [preparando, setPreparando] = useState(true);

  useEffect(() => {
    let activo = true;
    const iniciar = async () => {
      if (total === 0) {
        setPreparando(false);
        return;
      }
      await document.fonts.ready;
      if (!activo) return;
      setPreparando(false);
      window.setTimeout(abrirImpresion, 250);
    };
    iniciar();
    return () => {
      activo = false;
      document.body.classList.remove("imprimiendo-recibos-lote");
    };
  }, [total]);

  return (
    <div className="print:hidden sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-border)] bg-white px-5 py-3 shadow-sm">
      <div>
        <div className="font-semibold">{preparando ? "Preparando facturas..." : "Facturas listas"}</div>
        <div className="text-small text-[color:var(--color-text-muted)]">
          {total} {total === 1 ? "documento" : "documentos"} en este lote
        </div>
      </div>
      <button type="button" onClick={abrirImpresion} disabled={preparando} className="arca-btn arca-btn-primary arca-btn-sm">
        <Printer size={14} /> Imprimir ahora
      </button>
    </div>
  );
}
