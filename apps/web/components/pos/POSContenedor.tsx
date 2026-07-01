"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  Receipt,
  X,
  Check,
  Loader2,
  User,
  Banknote,
  CreditCard,
} from "lucide-react";
import { cn, formatearMoneda } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import { apiClient, ApiError, ApiDisabledError } from "@/lib/api-client";
import { encolarVenta } from "@/lib/pos-sync";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { IndicadorConexion } from "@/components/pos/IndicadorConexion";

type ProductoCatalogo = {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  salePrice: number | string;
  costPrice: number | string;
  stockDisponible: number;
  taxRate: { rate: number | string } | null;
  category: { id: string; name: string } | null;
};

type ItemCarrito = {
  producto: ProductoCatalogo;
  cantidad: number;
  descuento: number;
};

type CheckoutResponse = {
  sale: { id: string; number: string };
  totals: {
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    grandTotal: number;
    paidTotal: number;
  };
};

type Cliente = {
  id: string;
  fullName: string;
};

const METODOS_PAGO = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "CREDIT", label: "Crédito" },
];

export function POSContenedor() {
  const router = useRouter();
  const { mostrar } = useToast();
  const [busqueda, setBusqueda] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState<string>("");
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [modalPago, setModalPago] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const buscadorRef = useRef<HTMLInputElement>(null);

  const params = new URLSearchParams();
  if (busqueda) params.set("search", busqueda);
  if (categoriaId) params.set("categoryId", categoriaId);
  if (!busqueda) params.set("pageSize", "60");
  const path = `/pos/catalog?${params.toString()}`;
  const { data: productos, apiDisabled } = useApi<ProductoCatalogo[]>(path, [busqueda, categoriaId]);
  const { data: catalogoCompleto } = useApi<ProductoCatalogo[]>("/pos/catalog?pageSize=200");
  const { data: clientes } = useApi<Cliente[]>("/sales/customers");

  const categorias = useMemo(() => {
    const mapa = new Map<string, string>();
    (catalogoCompleto ?? []).forEach((p) => {
      if (p.category) mapa.set(p.category.id, p.category.name);
    });
    return Array.from(mapa.entries()).map(([id, name]) => ({ id, name }));
  }, [catalogoCompleto]);

  useEffect(() => {
    buscadorRef.current?.focus();
  }, []);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        buscadorRef.current?.focus();
      }
      if (e.key === "F12" && carrito.length > 0 && !modalPago && !procesando) {
        e.preventDefault();
        void cobrarExacto();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrito.length, modalPago, procesando]);

  const productosFiltrados = useMemo(() => productos ?? [], [productos]);

  function agregarAlCarrito(producto: ProductoCatalogo) {
    setCarrito((c) => {
      const existente = c.find((it) => it.producto.id === producto.id);
      if (existente) {
        return c.map((it) =>
          it.producto.id === producto.id ? { ...it, cantidad: it.cantidad + 1 } : it,
        );
      }
      return [...c, { producto, cantidad: 1, descuento: 0 }];
    });
    setBusqueda("");
    buscadorRef.current?.focus();
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setCarrito((c) =>
      c
        .map((it) =>
          it.producto.id === productoId
            ? { ...it, cantidad: Math.max(0, it.cantidad + delta) }
            : it,
        )
        .filter((it) => it.cantidad > 0),
    );
  }

  function eliminarItem(productoId: string) {
    setCarrito((c) => c.filter((it) => it.producto.id !== productoId));
  }

  function vaciarCarrito() {
    if (carrito.length === 0) return;
    if (confirm("¿Vaciar el ticket actual?")) {
      setCarrito([]);
    }
  }

  const subtotal = carrito.reduce(
    (acc, it) => acc + Number(it.producto.salePrice) * it.cantidad,
    0,
  );
  const impuesto = carrito.reduce((acc, it) => {
    const base = Number(it.producto.salePrice) * it.cantidad - it.descuento;
    const tasa = it.producto.taxRate ? Number(it.producto.taxRate.rate) / 100 : 0;
    return acc + base * tasa;
  }, 0);
  const descuentoTotal = carrito.reduce((acc, it) => acc + it.descuento, 0);
  const total = subtotal - descuentoTotal + impuesto;

  async function confirmarVenta(pagos: { method: string; amount: number; reference?: string }[]) {
    setProcesando(true);
    const uuidLocal = crypto.randomUUID();
    const ventaLocal = {
      uuidLocal,
      items: carrito.map((it) => ({
        productId: it.producto.id,
        productName: it.producto.name,
        quantity: it.cantidad,
        unitPrice: Number(it.producto.salePrice),
        discount: it.descuento,
      })),
      payments: pagos,
      subtotal,
      tax: impuesto,
      total,
      createdAt: Date.now(),
    };

    try {
      const res = await apiClient.post<CheckoutResponse>("/pos/checkout", {
        items: carrito.map((it) => ({
          productId: it.producto.id,
          quantity: it.cantidad,
          discount: it.descuento,
        })),
        payments: pagos,
        customerId: clienteId || undefined,
      });
      mostrar("success", `Venta ${res.sale.number} procesada`);
      setCarrito([]);
      setModalPago(false);
      router.refresh();
    } catch (err) {
      const esError = err instanceof ApiError;
      const esRedCaida =
        err instanceof ApiError && (err.code === "NETWORK" || err.status === 0);

      if (esRedCaida || !navigator.onLine) {
        await encolarVenta(ventaLocal);
        mostrar("info", "Sin conexión. La venta quedó en cola para sincronizar.");
        setCarrito([]);
        setModalPago(false);
        return;
      }

      if (err instanceof ApiDisabledError) {
        await encolarVenta(ventaLocal);
        mostrar("info", "API en modo demo. La venta quedó en cola local.");
        setCarrito([]);
        setModalPago(false);
      } else if (esError) {
        mostrar("error", err.message);
      } else {
        mostrar("error", "No pudimos procesar la venta");
      }
    } finally {
      setProcesando(false);
    }
  }

  async function cobrarExacto() {
    await confirmarVenta([{ method: "CASH", amount: total }]);
  }

  return (
    <div className="flex h-screen flex-col bg-[color:var(--color-neutral)]">
      <header className="flex items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-3">
        <div className="flex items-center gap-4">
          <Link href="/app" className="atria-btn atria-btn-ghost atria-btn-sm">
            <ArrowLeft size={14} /> Salir POS
          </Link>
          <div className="hidden sm:block">
            <div className="text-base font-semibold">Punto de Venta</div>
            <div className="text-[12px] text-[color:var(--color-text-muted)]">
              {apiDisabled ? "API deshabilitada" : "En línea"}
            </div>
          </div>
        </div>
        <IndicadorConexion />
      </header>

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-12">
        <section className="atria-card flex flex-col overflow-hidden lg:col-span-7">
          <div className="border-b border-[color:var(--color-border)] p-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]"
              />
              <input
                ref={buscadorRef}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Escanear código o buscar por nombre/SKU (F2)"
                className="atria-input pl-9 text-base"
              />
            </div>
            <div className="mt-3 flex items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setCategoriaId(null)}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide transition",
                  categoriaId === null
                    ? "bg-[color:var(--color-primary)] text-white"
                    : "bg-[color:var(--color-surface-2)] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]",
                )}
              >
                Todos
              </button>
              {categorias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoriaId(c.id)}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide transition",
                    categoriaId === c.id
                      ? "bg-[color:var(--color-primary)] text-white"
                      : "bg-[color:var(--color-surface-2)] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]",
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {productosFiltrados.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[color:var(--color-text-muted)]">
                <div className="text-center">
                  <Search size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-small">
                    {apiDisabled
                      ? "Activa la API para cargar el catálogo"
                      : busqueda
                        ? "Sin resultados"
                        : "Cargando catálogo..."}
                  </p>
                </div>
              </div>
            ) : (
              <table className="w-full text-small">
                <thead className="sticky top-0 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                  <tr>
                    <th className="text-label px-4 py-2.5 text-left font-semibold">SKU</th>
                    <th className="text-label px-4 py-2.5 text-left font-semibold">Producto</th>
                    <th className="text-label px-4 py-2.5 text-right font-semibold">Stock</th>
                    <th className="text-label px-4 py-2.5 text-right font-semibold">Precio</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.map((p) => {
                    const agotado = p.stockDisponible <= 0;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => !agotado && agregarAlCarrito(p)}
                        className={cn(
                          "border-b border-[color:var(--color-border)] last:border-b-0 transition-colors",
                          agotado
                            ? "opacity-40"
                            : "cursor-pointer hover:bg-[color:var(--color-surface-2)]",
                        )}
                      >
                        <td className="px-4 py-2.5 font-mono text-[12px] text-[color:var(--color-secondary)]">
                          {p.sku}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{p.name}</td>
                        <td
                          className={cn(
                            "px-4 py-2.5 text-right",
                            p.stockDisponible <= 5 && "font-semibold text-[color:var(--color-error)]",
                          )}
                        >
                          {p.stockDisponible}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold">
                          {formatearMoneda(Number(p.salePrice))}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Plus size={16} className="ml-auto text-[color:var(--color-tertiary)]" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="atria-card flex flex-col overflow-hidden lg:col-span-5">
          <div className="flex items-center justify-between gap-2 border-b border-[color:var(--color-border)] p-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-surface-2)] text-[color:var(--color-secondary)]">
                <User size={14} />
              </div>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="w-full truncate border-none bg-transparent text-small font-medium focus:outline-none"
              >
                <option value="">Cliente de mostrador</option>
                {(clientes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={vaciarCarrito}
              disabled={carrito.length === 0}
              className="atria-btn atria-btn-ghost atria-btn-sm shrink-0 disabled:opacity-30"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-3 py-2 text-[12px] text-[color:var(--color-text-muted)]">
            <span>
              Ticket actual · {carrito.length} {carrito.length === 1 ? "ítem" : "ítems"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {carrito.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6 text-center text-[color:var(--color-text-muted)]">
                <div>
                  <Receipt size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-small">Agrega productos al ticket</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-[color:var(--color-border)]">
                {carrito.map((it) => (
                  <li key={it.producto.id} className="flex items-center gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-small font-medium">{it.producto.name}</div>
                      <div className="text-[12px] text-[color:var(--color-text-muted)]">
                        {formatearMoneda(Number(it.producto.salePrice))} c/u
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(it.producto.id, -1)}
                        className="rounded p-1 hover:bg-[color:var(--color-surface-2)]"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-small font-medium">{it.cantidad}</span>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(it.producto.id, +1)}
                        className="rounded p-1 hover:bg-[color:var(--color-surface-2)]"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="w-24 text-right text-small font-semibold">
                      {formatearMoneda(Number(it.producto.salePrice) * it.cantidad)}
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminarItem(it.producto.id)}
                      className="rounded p-1 text-[color:var(--color-error)] hover:bg-[color:var(--color-error-bg)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3">
            <div className="space-y-1 text-small">
              <Fila label="Subtotal" valor={formatearMoneda(subtotal)} />
              {descuentoTotal > 0 && (
                <Fila label="Descuento" valor={`- ${formatearMoneda(descuentoTotal)}`} />
              )}
              {impuesto > 0 && <Fila label="Impuestos" valor={formatearMoneda(impuesto)} />}
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-[color:var(--color-border)] pt-2">
              <span className="text-label">Total</span>
              <span className="text-xl font-bold text-[color:var(--color-primary)]">
                {formatearMoneda(total)}
              </span>
            </div>
            <Button
              onClick={() => void cobrarExacto()}
              disabled={carrito.length === 0 || procesando}
              loading={procesando}
              className="mt-3 w-full"
              size="lg"
            >
              <Banknote size={16} /> Efectivo exacto (F12)
            </Button>
            <button
              type="button"
              onClick={() => setModalPago(true)}
              disabled={carrito.length === 0 || procesando}
              className="atria-btn atria-btn-secondary mt-2 w-full justify-center disabled:opacity-30"
            >
              <CreditCard size={14} /> Otro método de pago
            </button>
          </div>
        </section>
      </div>

      {modalPago && (
        <ModalPago
          total={total}
          procesando={procesando}
          onCerrar={() => setModalPago(false)}
          onConfirmar={confirmarVenta}
        />
      )}
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

function ModalPago({
  total,
  procesando,
  onCerrar,
  onConfirmar,
}: {
  total: number;
  procesando: boolean;
  onCerrar: () => void;
  onConfirmar: (pagos: { method: string; amount: number; reference?: string }[]) => void;
}) {
  const [metodo, setMetodo] = useState("CASH");
  const [montoRecibido, setMontoRecibido] = useState(total);
  const [referencia, setReferencia] = useState("");

  const cambio = Math.max(0, montoRecibido - total);
  const requiereRef = metodo === "CARD" || metodo === "TRANSFER";

  function confirmar() {
    if (montoRecibido < total) return;
    onConfirmar([
      {
        method: metodo,
        amount: total,
        reference: requiereRef ? referencia : undefined,
      },
    ]);
  }

  return (
    <Modal
      abierto
      onCerrar={procesando ? () => {} : onCerrar}
      titulo="Cobrar venta"
      descripcion={`Total: ${formatearMoneda(total)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={procesando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} loading={procesando} disabled={montoRecibido < total}>
            {procesando ? (
              <>
                <Loader2 className="animate-spin" size={14} /> Procesando
              </>
            ) : (
              <>
                <Check size={14} /> Confirmar
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Método de pago"
          value={metodo}
          onChange={(e) => setMetodo(e.target.value)}
          options={METODOS_PAGO}
        />
        {metodo === "CASH" && (
          <>
            <Input
              label="Monto recibido"
              type="number"
              step="0.01"
              value={montoRecibido}
              onChange={(e) => setMontoRecibido(parseFloat(e.target.value) || 0)}
              autoFocus
            />
            <div className="rounded-md bg-[color:var(--color-surface-2)] p-3 text-center">
              <div className="text-label">Cambio</div>
              <div className="text-2xl text-[color:var(--color-primary)]">
                {formatearMoneda(cambio)}
              </div>
            </div>
          </>
        )}
        {requiereRef && (
          <Input
            label="Referencia / autorización"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
          />
        )}
        {metodo === "CREDIT" && (
          <div className="rounded-md bg-[color:var(--color-warning-bg)] p-3 text-small">
            Esta venta quedará como pendiente de cobro hasta que el cliente abone.
          </div>
        )}
      </div>
    </Modal>
  );
}
