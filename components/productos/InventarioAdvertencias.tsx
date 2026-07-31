"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { resolverAdvertenciaProducto } from "@/lib/actions/productos";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export type AdvertenciaInventario = {
  id: string;
  productoId: string;
  producto: string;
  sku: string;
  filaExcel: number | null;
  campo: string;
  mensaje: string;
  valorOriginal: string | null;
};

export function InventarioAdvertencias({
  advertencias,
}: {
  advertencias: AdvertenciaInventario[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();
  const { mostrar } = useToast();
  const preview = advertencias
    .slice(0, 5)
    .map((a) => `${a.producto} - ${a.mensaje}`)
    .join("\n");

  function resolver(id: string) {
    startTransition(async () => {
      const res = await resolverAdvertenciaProducto(id);
      if (!res.ok) {
        mostrar("error", res.error);
        return;
      }
      mostrar("success", "Advertencia marcada como revisada");
      router.refresh();
    });
  }

  if (advertencias.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={preview}
        className="arca-btn arca-btn-secondary arca-btn-sm border-[color:var(--color-warning)]/40 text-[color:var(--color-warning)]"
      >
        <TriangleAlert size={14} /> {advertencias.length} advertencias
      </button>
      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Advertencias de inventario"
        descripcion="Productos cargados con datos completados por el sistema."
        ancho="xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead className="border-b border-[color:var(--color-border)]">
              <tr>
                <th className="text-label px-3 py-2 text-left">Producto</th>
                <th className="text-label px-3 py-2 text-left">Fila</th>
                <th className="text-label px-3 py-2 text-left">Campo</th>
                <th className="text-label px-3 py-2 text-left">Advertencia</th>
                <th className="text-label px-3 py-2 text-right">Accion</th>
              </tr>
            </thead>
            <tbody>
              {advertencias.map((a) => (
                <tr key={a.id} className="border-b border-[color:var(--color-border)] last:border-b-0">
                  <td className="px-3 py-2">
                    <div className="font-medium">{a.producto}</div>
                    <div className="font-mono text-[11px] text-[color:var(--color-text-muted)]">
                      {a.sku}
                    </div>
                  </td>
                  <td className="px-3 py-2">{a.filaExcel ?? "-"}</td>
                  <td className="px-3 py-2">{a.campo}</td>
                  <td className="px-3 py-2">
                    <div>{a.mensaje}</div>
                    {a.valorOriginal && (
                      <div className="text-[11px] text-[color:var(--color-text-muted)]">
                        Valor: {a.valorOriginal}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/inventario/${a.productoId}`}
                        className="arca-btn arca-btn-ghost arca-btn-sm"
                      >
                        Abrir
                      </Link>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pendiente}
                        onClick={() => resolver(a.id)}
                      >
                        <Check size={13} /> Revisada
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
}
