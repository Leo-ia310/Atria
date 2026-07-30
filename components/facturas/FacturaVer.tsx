"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Printer, X } from "lucide-react";
import { Recibo, type ReciboData } from "@/components/pos/Recibo";
import { imprimirRecibo } from "@/components/pos/TicketPrint";

export function FacturaVer({ data }: { data: ReciboData }) {
  const [abierto, setAbierto] = useState(false);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function onEnter(e: React.MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const anchoPreview = 340;
    let left = r.left - anchoPreview - 12;
    if (left < 8) left = r.right + 12;
    const top = Math.min(Math.max(8, r.bottom - 220), window.innerHeight - 460);
    setPos({ top, left });
    setHover(true);
  }

  return (
    <>
      <button
        type="button"
        onMouseEnter={onEnter}
        onMouseLeave={() => setHover(false)}
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1 text-[color:var(--color-secondary)] hover:underline"
      >
        <Eye size={13} /> Ver
      </button>

      {/* Preview flotante al pasar el mouse */}
      {hover &&
        !abierto &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[60]"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="max-h-[440px] overflow-hidden rounded-lg shadow-2xl ring-1 ring-black/10">
              <Recibo data={data} />
            </div>
          </div>,
          document.body,
        )}

      {/* Modal al hacer click */}
      {abierto &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10 backdrop-blur-md"
            onClick={() => setAbierto(false)}
          >
            <div onClick={(e) => e.stopPropagation()} className="relative">
              <div className="mb-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={imprimirRecibo}
                  className="arca-btn arca-btn-primary arca-btn-sm"
                >
                  <Printer size={14} /> Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="arca-btn arca-btn-secondary arca-btn-sm"
                >
                  <X size={14} /> Cerrar
                </button>
              </div>
              <div className="recibo-imprimible">
                <Recibo data={data} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
