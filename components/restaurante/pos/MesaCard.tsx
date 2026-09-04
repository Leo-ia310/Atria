import { Table2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import type { EstadoMesaSimple, MesaPos, OrdenPos } from "@/components/restaurante/pos/types";
import {
  classEstadoMesa,
  labelEstadoMesaSimple,
  variantEstadoMesaSimple,
} from "@/components/restaurante/pos/utils";

export function MesaCard({
  mesa,
  orden,
  estado,
  activa,
  pais,
}: {
  mesa: MesaPos;
  orden?: OrdenPos;
  estado: EstadoMesaSimple;
  activa: boolean;
  pais: PaisCodigo;
}) {
  return (
    <div
      className={cn(
        "min-h-28 rounded-md border p-3 shadow-sm transition",
        activa
          ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/10 ring-2 ring-[color:var(--color-primary)]/25"
          : "border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] hover:border-[color:var(--color-border-strong)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{mesa.nombre}</div>
          <div className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
            {orden ? `${orden.personas} personas` : `${mesa.capacidad} personas`}
          </div>
        </div>
        <Table2 size={17} className={classEstadoMesa(estado)} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Badge variant={variantEstadoMesaSimple(estado)}>{labelEstadoMesaSimple(estado)}</Badge>
        {orden && <span className="text-small font-semibold">{formatearMoneda(orden.total, pais)}</span>}
      </div>
      {estado === "por_limpiar" && (
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-secondary)]">
          Cerrar atencion
        </div>
      )}
    </div>
  );
}
