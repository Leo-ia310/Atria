import Link from "next/link";
import { Clock3 } from "lucide-react";
import { agregarItemOrdenRestauranteForm } from "@/lib/actions/restaurante-vertical";
import { cn, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import type { OrdenPos, ProductoPos } from "@/components/restaurante/pos/types";
import {
  labelTipoProducto,
  productoRequiereModal,
} from "@/components/restaurante/pos/utils";

export function ProductoButton({
  producto,
  orden,
  pais,
  href,
  puedeEditar,
}: {
  producto: ProductoPos;
  orden: OrdenPos | null;
  pais: PaisCodigo;
  href: string;
  puedeEditar: boolean;
}) {
  const requiereModal = productoRequiereModal(producto);
  const contenido = (
    <div
      className={cn(
        "flex min-h-28 flex-col justify-between rounded-md border p-3 text-left shadow-sm transition",
        orden && puedeEditar
          ? "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)]/5"
          : "border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] opacity-60",
      )}
    >
      <div>
        <div className="line-clamp-2 font-semibold">{producto.nombre}</div>
        <div className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
          {producto.categoriaNombre ?? labelTipoProducto(producto.tipoRestaurante)}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-base font-bold text-[color:var(--color-primary)]">
          {formatearMoneda(producto.precioBase, pais)}
        </span>
        {producto.tiempoPreparacionMin > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--color-text-muted)]">
            <Clock3 size={12} /> {producto.tiempoPreparacionMin}m
          </span>
        )}
      </div>
    </div>
  );

  if (!orden || !puedeEditar) return contenido;

  if (requiereModal) {
    return (
      <Link href={href} className="block">
        {contenido}
      </Link>
    );
  }

  return (
    <form action={agregarItemOrdenRestauranteForm}>
      <input type="hidden" name="redirectTo" value="/restaurante/pos" />
      <input type="hidden" name="ordenId" value={orden.id} />
      <input type="hidden" name="productoId" value={producto.id} />
      <input type="hidden" name="cantidad" value="1" />
      <input type="hidden" name="precioUnitario" value="0" />
      <input type="hidden" name="descuento" value="0" />
      <input type="hidden" name="impuesto" value="0" />
      <input type="hidden" name="costoUnitario" value="0" />
      <button type="submit" className="w-full">
        {contenido}
      </button>
    </form>
  );
}
