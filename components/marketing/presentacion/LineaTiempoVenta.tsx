"use client";

import { useEffect, useState } from "react";
import { BarChart3, BookOpen, Check, CreditCard, Package, Receipt, ShoppingCart } from "lucide-react";

const pasosVenta = [
  {
    icon: ShoppingCart,
    tag: "Punto de venta",
    titulo: "Se registra la venta",
    detalle: "El cajero agrega los productos, aplica descuentos y presiona Cobrar. Entrega el ticket en segundos.",
  },
  {
    icon: CreditCard,
    tag: "Caja",
    titulo: "La caja se actualiza",
    detalle: "El pago entra automáticamente a la caja del turno. Al cierre, el arqueo siempre cuadra.",
  },
  {
    icon: Package,
    tag: "Inventario",
    titulo: "El inventario baja solo",
    detalle: "Se descuentan las unidades vendidas del stock, con su lote y vencimiento. Sin conteos manuales.",
  },
  {
    icon: Receipt,
    tag: "Facturación",
    titulo: "Se emite la factura",
    detalle: "Documento fiscal válido según tu país, con su secuencia correcta y listo para el cliente.",
  },
  {
    icon: BookOpen,
    tag: "Contabilidad",
    titulo: "Se genera el asiento contable",
    detalle: "Partida doble registrada en el libro diario. Tu contador ya no digita nada a mano.",
  },
  {
    icon: BarChart3,
    tag: "Reportes",
    titulo: "Los reportes se actualizan",
    detalle: "Ventas, margen y utilidad al instante. Tomas decisiones con datos reales, no con corazonadas.",
  },
];

export function LineaTiempoVenta() {
  // paso = cantidad de etapas completadas (0..6). Al llegar a 6 hace una pausa y reinicia.
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    const espera = paso >= pasosVenta.length ? 2200 : 1300;
    const t = setTimeout(() => {
      setPaso((p) => (p >= pasosVenta.length ? 0 : p + 1));
    }, espera);
    return () => clearTimeout(t);
  }, [paso]);

  const completado = Math.min(paso, pasosVenta.length);
  const progreso = (completado / pasosVenta.length) * 100;
  const cobrada = paso >= 1;

  return (
    <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
      {/* Panel de la venta */}
      <div className="lg:sticky lg:top-24">
        <div className="relative overflow-hidden rounded-[16px] border border-white/14 bg-[#0c0518]/95 shadow-[0_30px_90px_rgba(9,4,20,0.6)]">
          <div className="arca-scanline" />
          <div className="flex items-center justify-between border-b border-white/10 bg-[#160827] px-4 py-3">
            <p className="text-[12px] font-semibold text-white">Venta #1042 · Caja 1</p>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#34d399]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75 [animation:arca-pulse_2s_ease-out_infinite]" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#34d399]" />
              </span>
              En vivo
            </span>
          </div>

          <div className="bg-[#f7f4fc] p-4">
            <div className="space-y-2">
              {[
                { n: "Cemento gris 42.5kg", c: 3, t: "C$ 1,155" },
                { n: "Pintura blanca 1gal", c: 1, t: "C$ 540" },
                { n: "Foco LED 9W", c: 4, t: "C$ 380" },
              ].map((item) => (
                <div key={item.n} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="flex items-center gap-1.5 text-[#5b667a]">
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-[#efe7ff] px-1 text-[9px] font-semibold text-[#5b21b6]">
                      {item.c}
                    </span>
                    <span className="line-clamp-1">{item.n}</span>
                  </span>
                  <span className="font-medium text-[#273042]">{item.t}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-[#e7edf6] pt-3 text-[15px] font-semibold text-[#151b2c]">
              <span>Total</span>
              <span className="text-[#5b21b6]">C$ 2,075</span>
            </div>

            <div className="mt-3">
              {!cobrada ? (
                <div className="flex items-center justify-center gap-2 rounded-[8px] bg-[linear-gradient(135deg,#7c3aed,#2563eb)] py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(124,58,237,0.4)] [animation:arca-floatY2_1.6s_ease-in-out_infinite]">
                  <CreditCard size={15} /> Cobrar
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-[8px] bg-[#ecfdf5] py-2.5 text-[13px] font-semibold text-[#16803c]">
                  <span className="arca-check-pop flex h-4 w-4 items-center justify-center rounded-full bg-[#16803c] text-white">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  Venta cobrada · C$ 2,075
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 bg-[#160827] px-4 py-3">
            <div className="flex items-center justify-between text-[11px] text-white/60">
              <span>Procesos automáticos</span>
              <span className="font-semibold text-white">{completado} de {pasosVenta.length}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#a78bfa,#2563eb)] transition-[width] duration-700 ease-out"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-[12px] text-white/45">
          El cajero solo cobra. ARCA hace el resto por detrás.
        </p>
      </div>

      {/* Línea de tiempo */}
      <ol className="relative space-y-3 pl-2">
        <span aria-hidden className="absolute left-[24px] top-4 bottom-4 w-px bg-white/10" />
        <span
          aria-hidden
          className="absolute left-[24px] top-4 w-px bg-[linear-gradient(180deg,#a78bfa,#2563eb)] transition-[height] duration-700 ease-out"
          style={{ height: `calc((100% - 2rem) * ${completado / pasosVenta.length})` }}
        />
        {pasosVenta.map(({ icon: Icon, tag, titulo, detalle }, i) => {
          const hecho = i < paso;
          const activo = i === paso && paso < pasosVenta.length;
          return (
            <li key={titulo} className="relative flex gap-4">
              <div className="relative z-10 flex-shrink-0">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                    hecho
                      ? "border-[#34d399] bg-[#0f2a22] text-[#34d399]"
                      : activo
                        ? "border-[#a78bfa] bg-white text-[#4c1d95] shadow-[0_0_0_6px_rgba(167,139,250,0.18)]"
                        : "border-white/15 bg-[#150a26] text-white/40"
                  }`}
                >
                  {hecho ? (
                    <span className="arca-check-pop">
                      <Check size={18} strokeWidth={3} />
                    </span>
                  ) : (
                    <Icon size={18} />
                  )}
                </div>
                {activo && (
                  <span className="absolute inset-0 rounded-full border-2 border-[#a78bfa] [animation:arca-pulse_1.6s_ease-out_infinite]" />
                )}
              </div>

              <div
                className={`flex-1 rounded-[14px] border p-4 transition-all duration-500 ${
                  hecho
                    ? "border-[#34d399]/30 bg-[#12261f]/70"
                    : activo
                      ? "border-[#a78bfa]/55 bg-[#24123f] shadow-[0_18px_44px_rgba(124,58,237,0.28)]"
                      : "border-white/10 bg-[#1b0d31]/70 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c4b5fd]">
                    {tag}
                  </span>
                  <span className="text-[11px] font-semibold text-white/35">0{i + 1}</span>
                </div>
                <h3 className="mt-1.5 text-[15px] font-semibold text-white">{titulo}</h3>
                <p className="mt-1 text-[13px] leading-6 text-white/60">{detalle}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
