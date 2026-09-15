"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";

export function ConfiguracionBackLink() {
  const pathname = usePathname();
  if (pathname === "/restaurante/configuracion") return null;

  return (
    <Link href="/restaurante/configuracion" className="arca-btn arca-btn-secondary arca-btn-sm mb-4 inline-flex">
      <ArrowLeft size={14} /> Regresar a Configuracion
    </Link>
  );
}
