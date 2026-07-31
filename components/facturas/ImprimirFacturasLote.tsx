"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Recibo, type ReciboData } from "@/components/pos/Recibo";

export function ImprimirFacturasLote({
  recibos,
  label,
}: {
  recibos: ReciboData[];
  label: string;
}) {
  const [imprimiendo, setImprimiendo] = useState(false);
  const disabled = recibos.length === 0 || imprimiendo;

  function imprimir() {
    if (disabled) return;
    setImprimiendo(true);
    document.body.classList.add("imprimiendo-recibos-lote");
    const cleanup = () => {
      document.body.classList.remove("imprimiendo-recibos-lote");
      window.removeEventListener("afterprint", cleanup);
      setImprimiendo(false);
    };
    window.addEventListener("afterprint", cleanup);
    window.setTimeout(() => window.print(), 80);
    window.setTimeout(cleanup, 1500);
  }

  return (
    <>
      <button
        type="button"
        onClick={imprimir}
        disabled={disabled}
        className="arca-btn arca-btn-secondary arca-btn-sm"
        title={recibos.length === 0 ? "No hay facturas imprimibles" : undefined}
      >
        <Printer size={14} /> {imprimiendo ? "Preparando..." : label}
      </button>
      <div className="recibos-lote-imprimible pointer-events-none fixed left-[-10000px] top-0 w-[360px]">
        {recibos.map((recibo) => (
          <div key={recibo.numero} className="recibo-lote-pagina">
            <Recibo data={recibo} />
          </div>
        ))}
      </div>
    </>
  );
}
