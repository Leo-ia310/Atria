import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  titulo,
  descripcion,
  accion,
}: {
  icon: LucideIcon;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 rounded-full bg-[color:var(--color-surface-2)] p-3 text-[color:var(--color-text-muted)]">
        <Icon size={24} />
      </div>
      <p className="text-base font-medium text-[color:var(--color-text-primary)]">
        {titulo}
      </p>
      {descripcion && (
        <p className="mt-1 max-w-md text-small text-[color:var(--color-text-muted)]">
          {descripcion}
        </p>
      )}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}
