"use client";

import { useMemo, useState, useTransition } from "react";
import { Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { agregarItemOrdenRestaurante } from "@/lib/actions/restaurante-vertical";
import { cn, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import type { OrdenPos, ProductoPos } from "@/components/restaurante/pos/types";
import { labelTipoProducto } from "@/components/restaurante/pos/utils";

export function ProductoActionButton({
  producto,
  orden,
  pais,
  puedeEditar,
}: {
  producto: ProductoPos;
  orden: OrdenPos | null;
  pais: PaisCodigo;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [agregados, setAgregados] = useState(0);
  const habilitado = Boolean(orden && puedeEditar);
  const formData = useMemo(() => {
    if (!orden) return null;
    const data = new FormData();
    data.set("ordenId", orden.id);
    data.set("productoId", producto.id);
    data.set("cantidad", "1");
    data.set("precioUnitario", "0");
    data.set("descuento", "0");
    data.set("impuesto", "0");
    data.set("costoUnitario", "0");
    return data;
  }, [orden, producto.id]);

  function agregarProducto() {
    if (!formData || !habilitado) return;
    setAgregados((actual) => actual + 1);
    startTransition(async () => {
      const resultado = await agregarItemOrdenRestaurante(formData);
      if (!resultado.ok) {
        setAgregados((actual) => Math.max(0, actual - 1));
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={!habilitado || isPending}
      onClick={agregarProducto}
      className="w-full"
    >
      <div
        className={cn(
          "relative flex min-h-[132px] min-w-0 flex-col justify-between rounded-md border p-3 text-left shadow-sm transition",
          habilitado
            ? "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)]/5 active:scale-[0.99]"
            : "border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] opacity-60",
        )}
      >
        {agregados > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-[color:var(--color-primary)] px-2 py-0.5 text-[11px] font-semibold text-white">
            +{agregados}
          </span>
        )}
        <div>
          <div className="line-clamp-2 pr-8 font-semibold">{producto.nombre}</div>
          <div className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
            {producto.categoriaNombre ?? labelTipoProducto(producto.tipoRestaurante)}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="shrink-0 text-base font-bold text-[color:var(--color-primary)]">
            {formatearMoneda(producto.precioBase, pais)}
          </span>
          {producto.tiempoPreparacionMin > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[color:var(--color-text-muted)]">
              <Clock3 size={12} className="shrink-0" /> {producto.tiempoPreparacionMin}m
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
