import { Sheet } from "lucide-react";

/**
 * Enlace de descarga directa hacia /api/exportar/<recurso>. Es un <a> normal
 * (no fetch) para que el navegador maneje la descarga del .xlsx. Reenvía los
 * mismos filtros/searchParams que ve la página, para que el Excel respete lo
 * que el usuario tiene en pantalla.
 */
export function BotonExportarExcel({
  recurso,
  params,
  etiqueta = "Exportar a Excel",
  className,
}: {
  recurso: string;
  params?: Record<string, string | number | undefined | null>;
  etiqueta?: string;
  className?: string;
}) {
  const query = new URLSearchParams();
  if (params) {
    for (const [clave, valor] of Object.entries(params)) {
      if (valor !== undefined && valor !== null && valor !== "") {
        query.set(clave, String(valor));
      }
    }
  }
  const qs = query.toString();
  const href = `/api/exportar/${recurso}${qs ? `?${qs}` : ""}`;

  return (
    <a
      href={href}
      className={className ?? "arca-btn arca-btn-secondary arca-btn-sm"}
      title="Descargar los datos de este módulo en un archivo Excel"
    >
      <Sheet size={14} /> {etiqueta}
    </a>
  );
}
