"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Barcode, Package, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatearMoneda, desdeDecimal, cn } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

export type FilaInventario = {
  id: string;
  sku: string;
  nombre: string;
  codigoBarras: string;
  precio: string;
  costo: string;
  existencia: number;
  stockMinimo: string;
  activo: boolean;
};

function normalizar(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function InventarioBuscador({
  filas,
  pais,
}: {
  filas: FilaInventario[];
  pais: PaisCodigo;
}) {
  const [query, setQuery] = useState("");
  const [modoBarras, setModoBarras] = useState(false);

  const filtradas = useMemo(() => {
    const q = normalizar(query);
    if (!q) return filas;
    if (modoBarras) {
      const raw = query.trim();
      return filas.filter((f) => f.codigoBarras && f.codigoBarras.includes(raw));
    }
    return filas.filter(
      (f) => normalizar(f.sku).includes(q) || normalizar(f.nombre).includes(q),
    );
  }, [filas, query, modoBarras]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]"
          />
          <input
            type="text"
            inputMode={modoBarras ? "numeric" : "text"}
            value={query}
            autoFocus={modoBarras}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              modoBarras
                ? "Escanea o escribe el código de barras…"
                : "Buscar por SKU o nombre de producto…"
            }
            className="arca-input arca-input-con-icono arca-input-pw w-full"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setModoBarras((v) => !v)}
          aria-pressed={modoBarras}
          title="Buscar por código de barras"
          className={cn(
            "arca-btn arca-btn-sm shrink-0",
            modoBarras ? "arca-btn-primary" : "arca-btn-secondary",
          )}
        >
          <Barcode size={16} />
          <span className="hidden sm:inline">Código</span>
        </button>
      </div>

      <div className="arca-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-small sm:min-w-full">
            <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
              <tr>
                <th className="text-label px-3 py-3 text-left font-semibold sm:px-4" style={{ width: "120px" }}>
                  SKU
                </th>
                <th className="text-label px-3 py-3 text-left font-semibold sm:px-4">Producto</th>
                <th className="text-label px-3 py-3 text-right font-semibold sm:px-4">Precio</th>
                <th className="text-label px-3 py-3 text-right font-semibold sm:px-4">Costo prom.</th>
                <th className="text-label px-3 py-3 text-right font-semibold sm:px-4" style={{ width: "110px" }}>
                  Existencia
                </th>
                <th className="text-label px-3 py-3 text-right font-semibold sm:px-4">Stock mín.</th>
                <th className="text-label px-3 py-3 text-left font-semibold sm:px-4" style={{ width: "100px" }}>
                  Estado
                </th>
                <th className="text-label px-3 py-3 text-right font-semibold sm:px-4" style={{ width: "100px" }}></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[color:var(--color-border)] transition-colors last:border-b-0"
                >
                  <td className="px-3 py-3 sm:px-4">
                    <span className="font-mono text-[12px]">{r.sku}</span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <Link
                      href={`/inventario/${r.id}/detalle`}
                      className="font-medium text-[color:var(--color-text-primary)] hover:text-[color:var(--color-secondary)] hover:underline"
                    >
                      {r.nombre}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right sm:px-4">
                    {formatearMoneda(desdeDecimal(r.precio), pais)}
                  </td>
                  <td className="px-3 py-3 text-right text-[color:var(--color-text-muted)] sm:px-4">
                    {formatearMoneda(desdeDecimal(r.costo), pais)}
                  </td>
                  <td className="px-3 py-3 text-right sm:px-4">{r.existencia.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right sm:px-4">
                    {desdeDecimal(r.stockMinimo).toFixed(0)}
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    {r.activo ? (
                      <Badge variant="success">Activo</Badge>
                    ) : (
                      <Badge variant="neutral">Inactivo</Badge>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right sm:px-4">
                    <Link
                      href={`/inventario/${r.id}`}
                      className="text-[color:var(--color-secondary)] hover:underline"
                    >
                      Editar →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtradas.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Package size={28} className="text-[color:var(--color-text-muted)]" />
            <p className="text-small text-[color:var(--color-text-muted)]">
              {modoBarras
                ? "Ningún producto con ese código de barras."
                : "Ningún producto coincide con la búsqueda."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
