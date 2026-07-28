"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackLink({
  href,
  label,
  hideOn,
}: {
  href: string;
  label: string;
  /** Ruta(s) donde NO se muestra el enlace (típicamente el hub del módulo). */
  hideOn?: string;
}) {
  const pathname = usePathname();
  if (hideOn && pathname === hideOn) return null;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-small text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-primary)]"
    >
      <ArrowLeft size={14} /> {label}
    </Link>
  );
}
