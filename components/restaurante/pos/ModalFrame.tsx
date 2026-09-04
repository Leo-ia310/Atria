import type { ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export function ModalFrame({
  title,
  subtitle,
  closeHref,
  children,
}: {
  title: string;
  subtitle?: string;
  closeHref: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <Link href={closeHref} className="absolute inset-0" aria-label="Cerrar" />
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle && <p className="text-small text-[color:var(--color-text-muted)]">{subtitle}</p>}
          </div>
          <Link
            href={closeHref}
            className="rounded-md p-2 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-2)]"
            aria-label="Cerrar"
          >
            <X size={18} />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
