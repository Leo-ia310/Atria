"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Search, X } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { procesarCompra } from "@/lib/actions/compras";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

type ProductoOpcion = {
  id: string;
  sku: string;
  nombre: string;
  costoActual: number;
  impuestoTasa: number;
};

type CuentaFinOpcion = { id: string; nombre: string };

type Linea = {
  id: string;
  productoId: string;
  cantidad: number;
  costoUnitario: number;
  impuesto: number;
};

export function NuevaCompraForm({
  pais,
  proveedores,
  almacenes,
  cuentasFinancieras,
  productos,
}: {
  pais: PaisCodigo;
  proveedores: { value: string; label: string; diasCredito: number }[];
  almacenes: { value: string; label: string }[];
  cuentasFinancieras: CuentaFinOpcion[];
  productos: ProductoOpcion[];
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);

  const [proveedorId, setProveedorId] = useState(proveedores[0]?.value ?? "");
  const [almacenId, setAlmacenId] = useState(almacenes[0]?.value ?? "");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [esCredito, setEsCredito] = useState(false);
  const [diasCredito, setDiasCredito] = useState(0);
  const [cuentaFinId, setCuentaFinId] = useState(cuentasFinancieras[0]?.id ?? "");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [lineaAReemplazar, setLineaAReemplazar] = useState<string | null>(null);
  const buscadorRef = useRef<HTMLInputElement>(null);

  const productosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return [];
    const q = busqueda.trim().toLowerCase();
    return productos
      .filter(
        (p) =>
          p.sku.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [productos, busqueda]);

  function agregarProducto(p: ProductoOpcion) {
    if (lineaAReemplazar) {
      setLineas((ls) =>
        ls.map((linea) =>
          linea.id === lineaAReemplazar
            ? {
                ...linea,
                productoId: p.id,
                costoUnitario: p.costoActual,
                impuesto: linea.cantidad * p.costoActual * p.impuestoTasa,
              }
            : linea,
        ),
      );
      setLineaAReemplazar(null);
      setBusqueda("");
      return;
    }
    setLineas((ls) => [
      ...ls,
      {
        id: crypto.randomUUID(),
        productoId: p.id,
        cantidad: 1,
        costoUnitario: p.costoActual,
        impuesto: p.costoActual * p.impuestoTasa,
      },
    ]);
    setBusqueda("");
  }

  function iniciarReemplazo(lineaId: string) {
    setLineaAReemplazar(lineaId);
    setBusqueda("");
    window.setTimeout(() => buscadorRef.current?.focus(), 0);
  }

  function actualizarLinea(id: string, cambios: Partial<Linea>) {
    setLineas((ls) =>
      ls.map((l) => {
        if (l.id !== id) return l;
        const actualizada = { ...l, ...cambios };
        const producto = productos.find((p) => p.id === actualizada.productoId);
        if (producto && (cambios.cantidad !== undefined || cambios.costoUnitario !== undefined)) {
          actualizada.impuesto =
            actualizada.cantidad * actualizada.costoUnitario * producto.impuestoTasa;
        }
        return actualizada;
      }),
    );
  }

  function quitarLinea(id: string) {
    setLineas((ls) => ls.filter((l) => l.id !== id));
    if (lineaAReemplazar === id) setLineaAReemplazar(null);
  }

  const subtotal = lineas.reduce((acc, l) => acc + l.cantidad * l.costoUnitario, 0);
  const impuesto = lineas.reduce((acc, l) => acc + l.impuesto, 0);
  const total = subtotal + impuesto;

  async function enviar() {
    if (lineas.length === 0) {
      mostrar("warning", "Agrega al menos un producto");
      return;
    }
    setEnviando(true);
    const res = await procesarCompra({
      proveedorId,
      almacenId,
      numeroFactura,
      fecha,
      esCredito,
      diasCredito: esCredito ? diasCredito : 0,
      cuentaFinancieraId: esCredito ? "" : cuentaFinId,
      items: lineas.map((l) => ({
        productoId: l.productoId,
        cantidad: l.cantidad,
        costoUnitario: l.costoUnitario,
        impuesto: l.impuesto,
      })),
    });
    setEnviando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", "Compra registrada");
    router.push("/compras");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Datos de la compra" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Proveedor"
              value={proveedorId}
              onChange={(e) => {
                setProveedorId(e.target.value);
                const prov = proveedores.find((p) => p.value === e.target.value);
                if (prov) setDiasCredito(prov.diasCredito);
              }}
              options={proveedores.map((p) => ({ value: p.value, label: p.label }))}
            />
            <Select
              label="Almacén destino"
              value={almacenId}
              onChange={(e) => setAlmacenId(e.target.value)}
              options={almacenes}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Número de factura del proveedor"
              value={numeroFactura}
              onChange={(e) => setNumeroFactura(e.target.value)}
              placeholder="FAC-1234"
            />
            <Input
              label="Fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 rounded-md bg-[color:var(--color-surface-2)] p-3">
            <label className="flex items-center gap-2 text-small">
              <input
                type="checkbox"
                checked={esCredito}
                onChange={(e) => setEsCredito(e.target.checked)}
              />
              Compra al crédito
            </label>
            {esCredito ? (
              <Input
                label="Días de crédito"
                type="number"
                value={diasCredito}
                onChange={(e) => setDiasCredito(parseInt(e.target.value, 10) || 0)}
                className="max-w-[140px]"
              />
            ) : (
              <Select
                label="Pago con"
                value={cuentaFinId}
                onChange={(e) => setCuentaFinId(e.target.value)}
                options={cuentasFinancieras.map((c) => ({ value: c.id, label: c.nombre }))}
                className="max-w-[260px]"
              />
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Productos comprados"
          subtitle={lineaAReemplazar ? "Busca el producto que reemplazará la línea seleccionada" : "Busca y agrega productos al detalle"}
        />
        <CardBody>
          {lineaAReemplazar && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-md bg-[color:var(--color-warning-bg)] px-3 py-2 text-small">
              <span>Selecciona un producto para modificar la línea.</span>
              <button
                type="button"
                onClick={() => setLineaAReemplazar(null)}
                className="rounded p-1 text-[color:var(--color-text-muted)] hover:bg-white"
                title="Cancelar cambio"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="relative mb-4">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]"
            />
            <input
              ref={buscadorRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={lineaAReemplazar ? "Buscar producto de reemplazo..." : "Buscar producto por SKU o nombre..."}
              className="arca-input pl-9"
            />
            {productosFiltrados.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg">
                {productosFiltrados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => agregarProducto(p)}
                    className="flex w-full items-center justify-between gap-3 border-b border-[color:var(--color-border)] px-3 py-2 text-left text-small last:border-b-0 hover:bg-[color:var(--color-surface-2)]"
                  >
                    <div>
                      <div className="font-medium">{p.nombre}</div>
                      <div className="text-[11px] text-[color:var(--color-text-muted)]">
                        {p.sku}
                      </div>
                    </div>
                    <div className="text-[color:var(--color-text-muted)]">
                      Costo: {formatearMoneda(p.costoActual, pais)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lineas.length === 0 ? (
            <p className="py-4 text-center text-small text-[color:var(--color-text-muted)]">
              Aún no hay productos. Busca arriba para agregar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead className="border-b border-[color:var(--color-border)]">
                  <tr className="text-label">
                    <th className="px-2 py-2 text-left">Producto</th>
                    <th className="px-2 py-2 text-right">Cant.</th>
                    <th className="px-2 py-2 text-right">Costo</th>
                    <th className="px-2 py-2 text-right">Impuesto</th>
                    <th className="px-2 py-2 text-right">Subtotal</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => {
                    const p = productos.find((pp) => pp.id === l.productoId);
                    return (
                      <tr key={l.id} className="border-b border-[color:var(--color-border)]">
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium">{p?.nombre}</div>
                              <div className="text-[11px] text-[color:var(--color-text-muted)]">{p?.sku}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => iniciarReemplazo(l.id)}
                              className="rounded p-1.5 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-surface-2)]"
                              title="Cambiar producto"
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            step="0.01"
                            value={l.cantidad}
                            onChange={(e) =>
                              actualizarLinea(l.id, { cantidad: parseFloat(e.target.value) || 0 })
                            }
                            className="arca-input w-20 text-right"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            step="0.01"
                            value={l.costoUnitario}
                            onChange={(e) =>
                              actualizarLinea(l.id, {
                                costoUnitario: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="arca-input w-28 text-right"
                          />
                        </td>
                        <td className="px-2 py-2 text-right text-[color:var(--color-text-muted)]">
                          {formatearMoneda(l.impuesto, pais)}
                        </td>
                        <td className="px-2 py-2 text-right font-medium">
                          {formatearMoneda(l.cantidad * l.costoUnitario, pais)}
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => quitarLinea(l.id)}
                            className="rounded p-1 text-[color:var(--color-error)] hover:bg-[color:var(--color-error-bg)]"
                            title="Quitar producto"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="ml-auto max-w-sm space-y-1 text-small">
            <Fila label="Subtotal" valor={formatearMoneda(subtotal, pais)} />
            <Fila label="Impuestos" valor={formatearMoneda(impuesto, pais)} />
            <div className="mt-2 flex justify-between border-t border-[color:var(--color-border)] pt-2">
              <span className="text-label">Total</span>
              <span className="text-xl font-bold text-[color:var(--color-primary)]">
                {formatearMoneda(total, pais)}
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()} disabled={enviando}>
          Cancelar
        </Button>
        <Button onClick={enviar} loading={enviando} disabled={lineas.length === 0}>
          <Plus size={14} /> Registrar compra
        </Button>
      </div>
    </div>
  );
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[color:var(--color-text-muted)]">{label}</span>
      <span className="font-medium">{valor}</span>
    </div>
  );
}
