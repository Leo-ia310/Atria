"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Download,
  X,
  MapPin,
  Truck,
  ArrowUpCircle,
  ArrowDownCircle,
  ShoppingCart,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { useApi, ApiAviso } from "@/lib/use-api";
import { cn, formatearMoneda, formatearFechaHora } from "@/lib/utils";
import { descargarCSV } from "@/lib/csv";

type Inventario = {
  warehouseId: string;
  availableQty: number | string;
  reservedQty: number | string;
  warehouse: { name: string; branch: { name: string } };
};

type Producto = {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  salePrice: string | number;
  costPrice: string | number;
  minStock: string | number;
  category: { name: string } | null;
  brand: { name: string } | null;
  supplier: { id: string; name: string } | null;
  inventory: Inventario[];
};

type ProductosResponse = {
  data: Producto[];
  meta: { page: number; pageSize: number; total: number };
};

type AlertasResponse = {
  stockBajo: { producto: string; disponible: number; minimo: number; sucursal: string }[];
  proximosAVencer: {
    producto: string;
    lote: string;
    cantidad: number;
    expira: string;
    sucursal: string;
  }[];
};

type FiltersResponse = {
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  warehouses: { id: string; name: string; branch: { name: string } }[];
};

type Movimiento = {
  id: string;
  type: string;
  quantity: string | number;
  createdAt: string;
  referenceType: string;
};

const ETIQUETAS_MOVIMIENTO: Record<string, string> = {
  PURCHASE_IN: "Compra recibida",
  SALE_OUT: "Venta",
  ADJUSTMENT: "Ajuste",
  TRANSFER_IN: "Transferencia (entrada)",
  TRANSFER_OUT: "Transferencia (salida)",
  RETURN_IN: "Devolución",
};

export default function InventarioPage() {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [stockLevel, setStockLevel] = useState("");
  const [seleccionado, setSeleccionado] = useState<Producto | null>(null);

  const filtros = useApi<FiltersResponse>("/inventory/filters");

  const query = new URLSearchParams();
  if (busqueda) query.set("search", busqueda);
  if (categoriaId) query.set("categoryId", categoriaId);
  if (supplierId) query.set("supplierId", supplierId);
  if (warehouseId) query.set("warehouseId", warehouseId);
  if (stockLevel) query.set("stockLevel", stockLevel);
  const path = `/inventory/products?${query.toString()}`;
  const { data, loading, apiDisabled, error } = useApi<ProductosResponse>(path, [
    busqueda,
    categoriaId,
    supplierId,
    warehouseId,
    stockLevel,
  ]);
  const alertas = useApi<AlertasResponse>("/inventory/alerts");
  const movimientos = useApi<Movimiento[]>(
    seleccionado ? `/inventory/movements?productId=${seleccionado.id}` : null,
    [seleccionado?.id],
  );

  const productos = data?.data ?? [];
  const totalAlertas =
    (alertas.data?.stockBajo.length ?? 0) + (alertas.data?.proximosAVencer.length ?? 0);

  function exportar() {
    const filas: (string | number)[][] = [
      ["SKU", "Código de barras", "Producto", "Categoría", "Almacén", "Stock", "Precio", "Costo"],
      ...productos.map((p) => [
        p.sku,
        p.barcode ?? "",
        p.name,
        p.category?.name ?? "",
        p.inventory[0]?.warehouse.name ?? "",
        p.inventory.reduce((a, x) => a + Number(x.availableQty), 0),
        Number(p.salePrice),
        Number(p.costPrice),
      ]),
    ];
    descargarCSV("inventario.csv", filas);
  }

  return (
    <div>
      <PageHeader
        title="Inventario"
        subtitle={
          loading
            ? "Cargando..."
            : `${data?.meta.total ?? 0} productos · ${totalAlertas} alertas activas`
        }
        actions={
          <>
            <button
              type="button"
              onClick={exportar}
              disabled={productos.length === 0}
              className="atria-btn atria-btn-secondary atria-btn-sm disabled:opacity-40"
            >
              <Download size={14} /> Exportar
            </button>
            <Link href="/app/inventario/nuevo" className="atria-btn atria-btn-primary atria-btn-sm">
              <Plus size={14} /> Nuevo producto
            </Link>
          </>
        }
      />

      <ApiAviso apiDisabled={apiDisabled} error={error} />

      <div className="atria-card mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-[color:var(--color-border)] px-3 py-2">
          <Search size={14} className="text-[color:var(--color-text-muted)]" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por SKU, nombre o código de barras..."
            className="flex-1 border-none bg-transparent text-small focus:outline-none"
          />
        </div>
        <div className="w-[170px]">
          <Select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            options={[
              { value: "", label: "Todos los almacenes" },
              ...(filtros.data?.warehouses ?? []).map((w) => ({
                value: w.id,
                label: `${w.name} · ${w.branch.name}`,
              })),
            ]}
          />
        </div>
        <div className="w-[160px]">
          <Select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            options={[
              { value: "", label: "Todas las categorías" },
              ...(filtros.data?.categories ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
        <div className="w-[160px]">
          <Select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            options={[
              { value: "", label: "Todos los proveedores" },
              ...(filtros.data?.suppliers ?? []).map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>
        <div className="w-[150px]">
          <Select
            value={stockLevel}
            onChange={(e) => setStockLevel(e.target.value)}
            options={[
              { value: "", label: "Nivel de stock: Todos" },
              { value: "LOW", label: "Stock bajo" },
              { value: "OUT", label: "Agotado" },
            ]}
          />
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-4", seleccionado && "lg:grid-cols-[1fr_340px]")}>
        {productos.length === 0 && !loading ? (
          <div className="atria-card">
            <EmptyState
              icon={Package}
              titulo={busqueda || categoriaId || supplierId || warehouseId || stockLevel ? "Sin resultados" : "Aún no hay productos"}
              descripcion="Ajusta los filtros o crea tu primer producto para empezar a vender."
            />
          </div>
        ) : (
          <div className="atria-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                  <tr>
                    <th className="text-label px-4 py-3 text-left font-semibold">SKU</th>
                    <th className="text-label px-4 py-3 text-left font-semibold">Código de barras</th>
                    <th className="text-label px-4 py-3 text-left font-semibold">Producto</th>
                    <th className="text-label px-4 py-3 text-left font-semibold">Categoría</th>
                    <th className="text-label px-4 py-3 text-left font-semibold">Almacén</th>
                    <th className="text-label px-4 py-3 text-right font-semibold">Stock</th>
                    <th className="text-label px-4 py-3 text-right font-semibold">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => {
                    const total = p.inventory.reduce((a, x) => a + Number(x.availableQty), 0);
                    const min = Number(p.minStock);
                    const bajo = total <= min;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSeleccionado(p)}
                        className={cn(
                          "cursor-pointer border-b border-[color:var(--color-border)] transition-colors last:border-b-0 hover:bg-[color:var(--color-surface-2)]",
                          seleccionado?.id === p.id && "bg-[color:var(--color-tertiary-light)]/20",
                        )}
                      >
                        <td className="px-4 py-3 font-mono text-[12px] text-[color:var(--color-secondary)]">
                          {p.sku}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-[color:var(--color-text-muted)]">
                          {p.barcode ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{p.name}</div>
                          {p.brand && (
                            <div className="text-[11px] text-[color:var(--color-text-muted)]">
                              {p.brand.name}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                          {p.category?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                          {p.inventory[0]?.warehouse.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="flex items-center justify-end gap-2">
                            {bajo && <AlertTriangle size={12} className="text-[color:var(--color-warning)]" />}
                            <span className={bajo ? "font-semibold text-[color:var(--color-warning)]" : ""}>
                              {total.toFixed(0)}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatearMoneda(Number(p.salePrice))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {seleccionado && (
          <PanelDetalle
            producto={seleccionado}
            movimientos={movimientos.data ?? []}
            onCerrar={() => setSeleccionado(null)}
          />
        )}
      </div>

      {!seleccionado && alertas.data && totalAlertas > 0 && (
        <div className="atria-card mt-4">
          <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-5 py-4">
            <h3 className="text-base font-semibold">Alertas de inventario</h3>
            <Badge variant="warning">{totalAlertas}</Badge>
          </div>
          <ul className="divide-y divide-[color:var(--color-border)]">
            {alertas.data.stockBajo.slice(0, 5).map((s, i) => (
              <li key={`stock-${i}`} className="px-5 py-2.5 text-small">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 text-[color:var(--color-warning)]" />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{s.producto}</span>
                    <span className="text-[color:var(--color-text-muted)]">
                      {" "}
                      · {s.sucursal} · {s.disponible}/{s.minimo}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PanelDetalle({
  producto,
  movimientos,
  onCerrar,
}: {
  producto: Producto;
  movimientos: Movimiento[];
  onCerrar: () => void;
}) {
  const disponible = producto.inventory.reduce((a, x) => a + Number(x.availableQty), 0);
  const reservado = producto.inventory.reduce((a, x) => a + Number(x.reservedQty), 0);
  const bajo = disponible <= Number(producto.minStock);
  const agotado = disponible <= 0;

  return (
    <aside className="atria-card h-fit overflow-hidden">
      <div className="flex items-start justify-between gap-2 border-b border-[color:var(--color-border)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[color:var(--color-surface-2)] text-[color:var(--color-text-muted)]">
            <Package size={22} />
          </div>
          <div>
            <div className="font-mono text-[11px] text-[color:var(--color-text-muted)]">{producto.sku}</div>
            <div className="text-small font-semibold leading-tight">{producto.name}</div>
            {(agotado || bajo) && (
              <Badge variant="error" className="mt-1">
                {agotado ? "Agotado" : "Stock bajo"}
              </Badge>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded p-1 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-2)]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4">
        <div className="rounded-md bg-[color:var(--color-surface-2)] p-3">
          <div className="text-label">Disponible</div>
          <div className="text-xl font-bold">{disponible.toFixed(0)}</div>
        </div>
        <div className="rounded-md bg-[color:var(--color-surface-2)] p-3">
          <div className="text-label">Reservado</div>
          <div className="text-xl font-bold">{reservado.toFixed(0)}</div>
        </div>
      </div>

      <div className="space-y-2 px-4 pb-4 text-small">
        <div className="flex items-center gap-2 text-[color:var(--color-text-muted)]">
          <MapPin size={13} />
          {producto.inventory.map((i) => i.warehouse.name).join(", ") || "Sin ubicación"}
        </div>
        <div className="flex items-center gap-2 text-[color:var(--color-text-muted)]">
          <Truck size={13} />
          {producto.supplier?.name ?? "Sin proveedor asignado"}
        </div>
      </div>

      <div className="border-t border-[color:var(--color-border)] p-4">
        <div className="mb-2 text-label">Movimientos recientes</div>
        {movimientos.length === 0 ? (
          <p className="text-[12px] text-[color:var(--color-text-muted)]">Sin movimientos registrados</p>
        ) : (
          <ul className="space-y-2">
            {movimientos.slice(0, 6).map((m) => {
              const entrada = Number(m.quantity) >= 0;
              return (
                <li key={m.id} className="flex items-start gap-2 text-[12px]">
                  {entrada ? (
                    <ArrowUpCircle size={13} className="mt-0.5 text-[color:var(--color-success)]" />
                  ) : (
                    <ArrowDownCircle size={13} className="mt-0.5 text-[color:var(--color-error)]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div>{ETIQUETAS_MOVIMIENTO[m.type] ?? m.type}</div>
                    <div className="text-[color:var(--color-text-muted)]">
                      {Math.abs(Number(m.quantity)).toFixed(0)} un. · {formatearFechaHora(m.createdAt)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-[color:var(--color-border)] p-4">
        <Link
          href="/app/compras/nueva"
          className="atria-btn atria-btn-primary atria-btn-sm w-full justify-center"
        >
          <ShoppingCart size={14} /> Crear orden de compra
        </Link>
      </div>
    </aside>
  );
}
