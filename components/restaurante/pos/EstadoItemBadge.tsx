import { ChefHat, CheckCircle2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function EstadoItemBadge({ estado }: { estado: string }) {
  const data = estadoItemInfo(estado);
  return (
    <div className={cn("mt-1 inline-flex items-center gap-1 text-[11px] font-semibold", data.className)}>
      {data.icon}
      {data.label}
    </div>
  );
}

function estadoItemInfo(estado: string) {
  if (estado === "nuevo") {
    return { label: "Nuevo", className: "text-[color:var(--color-warning)]", icon: <Plus size={12} /> };
  }
  if (estado === "preparando") {
    return { label: "Preparando", className: "text-[color:var(--color-info)]", icon: <ChefHat size={12} /> };
  }
  if (estado === "lista" || estado === "entregado") {
    return { label: "Lista", className: "text-[color:var(--color-success)]", icon: <CheckCircle2 size={12} /> };
  }
  return { label: "Enviada", className: "text-[color:var(--color-text-muted)]", icon: <CheckCircle2 size={12} /> };
}
