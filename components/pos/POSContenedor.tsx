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
  User,
  X,
  Check,
  Loader2,
  TriangleAlert,
  Store,
} from "lucide-react";
import { cn, formatearMoneda } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { procesarVenta } from "@/lib/actions/ventas";
import { abrirSesion } from "@/lib/actions/caja";
import type { PaisCodigo } from "@/lib/paises";

type ProductoPOS = {
  id: string;
  sku: string;
  codigoBarras: string;
  nombre: string;
  precio: number;
  costo: number;
  impuestoTasa: number;
};

type ClientePOS = {
  id: string;
  nombre: string;
  tieneCredito: boolean;
  diasCredito: number;
  esConsumidorFinal: boolean;
};

type FormaPagoPOS = {
  id: string;
  codigo: string;
  nombre: string;
  requiereReferencia: boolean;
};

type ItemCarrito = {
  producto: ProductoPOS;
  cantidad: number;
  descuento: number;
};

export function POSContenedor({
  pais,
  sucursalId,
  sucursalNombre,
  almacenId,
  nombreUsuario,
  productos,
  clientes,
  formasPago,
  hayCajaAbierta,
  cajas,
}: {
  pais: PaisCodigo;
  sucursalId: string;
  sucursalNombre: string;
  almacenId: string;
  nombreUsuario: string;
  productos: ProductoPOS[];
  clientes: ClientePOS[];
  formasPago: FormaPagoPOS[];
  hayCajaAbierta: boolean;
  cajas: { value: string; label: string }[];
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [clienteId, setClienteId] = useState<string>("");
  const [modalPago, setModalPago] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [ventaExito, setVentaExito] = useState<{ id: string; numero: string } | null>(null);
  const [cajaAbierta, setCajaAbierta] = useState(hayCajaAbierta);
  const [modalCaja, setModalCaja] = useState(!hayCajaAbierta);
  const buscadorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    buscadorRef.current?.focus();
  }, []);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        buscadorRef.current?.focus();
      }
      if (e.key === "F12" && carrito.length > 0 && !modalPago) {
        e.preventDefault();
        intentarCobrar();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrito.length, modalPago, cajaAbierta]);

  // Sin caja abierta no se puede cobrar: se reabre el aviso de abrir caja.
  function intentarCobrar() {
    if (!cajaAbierta) {
      setModalCaja(true);
      return;
    }
    setModalPago(true);
  }

  const productosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return productos.slice(0, 50);
    const q = busqueda.trim().toLowerCase();
    return productos
      .filter(
        (p) =>
          p.sku.toLowerCase().includes(q) ||
          p.nombre.toLowerCase().includes(q) ||
          (p.codigoBarras && p.codigoBarras.toLowerCase().includes(q)),
      )
      .slice(0, 50);
  }, [productos, busqueda]);

  function agregarAlCarrito(producto: ProductoPOS) {
    setCarrito((c) => {
      const existente = c.find((it) => it.producto.id === producto.id);
      if (existente) {
        return c.map((it) =>
          it.producto.id === producto.id
            ? { ...it, cantidad: it.cantidad + 1 }
            : it,
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
      setClienteId("");
    }
  }

  const subtotal = carrito.reduce(
    (acc, it) => acc + it.cantidad * it.producto.precio - it.descuento,
    0,
  );
  const impuesto = carrito.reduce(
    (acc, it) =>
      acc + (it.cantidad * it.producto.precio - it.descuento) * it.producto.impuestoTasa,
    0,
  );
  const total = subtotal + impuesto;

  const cliente = clientes.find((c) => c.id === clienteId);

  return (
    <div className="flex h-screen flex-col bg-[color:var(--color-neutral)]">
      {/* Aviso de entorno de prueba (sin caja abierta) */}
      {!cajaAbierta && (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-[color:var(--color-warning)]/15 px-4 py-1.5 text-center text-[12px] font-medium text-[color:var(--color-warning)]">
          <TriangleAlert size={14} />
          Entorno de prueba — no se guardará ningún dato.
          <button
            type="button"
            onClick={() => setModalCaja(true)}
            className="font-semibold text-[color:var(--color-primary)] underline"
          >
            Abrir caja
          </button>
        </div>
      )}

      {/* Header POS */}
      <header className="flex items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="atria-btn atria-btn-ghost atria-btn-sm"
            title="Volver al dashboard"
          >
            <ArrowLeft size={14} /> Salir POS
          </Link>
          <div className="hidden sm:block">
            <div className="text-base font-semibold text-[color:var(--color-text-primary)]">
              Punto de Venta · {sucursalNombre}
            </div>
            <div className="text-[12px] text-[color:var(--color-text-muted)]">
              Cajero: {nombreUsuario}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cajaAbierta ? (
            <span className="atria-badge atria-badge-success">
              <Store size={12} /> Caja abierta
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setModalCaja(true)}
              className="atria-badge atria-badge-warning"
              title="Abrir caja"
            >
              <Store size={12} /> Sin caja
            </button>
          )}
          <span className="atria-badge atria-badge-success">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            En línea
          </span>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-12">
        {/* Productos */}
        <section className="lg:col-span-7 atria-card flex flex-col overflow-hidden">
          <div className="border-b border-[color:var(--color-border)] p-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]"
              />
              <input
                ref={buscadorRef}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Escanear código o buscar por nombre/SKU (F2)"
                className="atria-input pl-9 text-base"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {productosFiltrados.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[color:var(--color-text-muted)]">
                <div className="text-center">
                  <Search size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-small">
                    {busqueda ? "No se encontraron productos" : "Busca o escanea un producto"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {productosFiltrados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => agregarAlCarrito(p)}
                    className="group flex flex-col items-start rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-left transition hover:border-[color:var(--color-tertiary)] hover:shadow-md"
                  >
                    <div className="text-[11px] font-mono text-[color:var(--color-text-muted)]">
                      {p.sku}
                    </div>
                    <div className="mt-1 line-clamp-2 text-small font-medium text-[color:var(--color-text-primary)]">
                      {p.nombre}
                    </div>
                    <div className="mt-2 text-base font-semibold text-[color:var(--color-primary)]">
                      {formatearMoneda(p.precio, pais)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Carrito */}
        <section className="lg:col-span-5 atria-card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-[color:var(--color-border)] p-3">
            <div>
              <div className="text-base font-semibold text-[color:var(--color-text-primary)]">
                Ticket · {carrito.length} {carrito.length === 1 ? "ítem" : "ítems"}
              </div>
              <button
                type="button"
                onClick={() => {
                  /* abrir selector cliente */
                }}
                className="mt-0.5 flex items-center gap-1 text-small text-[color:var(--color-secondary)] hover:underline"
              >
                <User size={12} />
                {cliente?.nombre ?? "Consumidor final"}
              </button>
            </div>
            <button
              type="button"
              onClick={vaciarCarrito}
              disabled={carrito.length === 0}
              className="atria-btn atria-btn-ghost atria-btn-sm disabled:opacity-30"
              title="Vaciar"
            >
              <X size={14} />
            </button>
          </div>

          <SelectorCliente
            clientes={clientes}
            clienteId={clienteId}
            onChange={setClienteId}
          />

          <div className="flex-1 overflow-y-auto">
            {carrito.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6 text-center text-[color:var(--color-text-muted)]">
                <div>
                  <Receipt size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-small">Agrega productos para iniciar la venta</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-[color:var(--color-border)]">
                {carrito.map((it) => (
                  <li key={it.producto.id} className="flex items-center gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-small font-medium text-[color:var(--color-text-primary)]">
                        {it.producto.nombre}
                      </div>
                      <div className="text-[12px] text-[color:var(--color-text-muted)]">
                        {formatearMoneda(it.producto.precio, pais)} c/u
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
                      <span className="w-8 text-center text-small font-medium">
                        {it.cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(it.producto.id, +1)}
                        className="rounded p-1 hover:bg-[color:var(--color-surface-2)]"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="w-24 text-right text-small font-semibold text-[color:var(--color-text-primary)]">
                      {formatearMoneda(it.cantidad * it.producto.precio, pais)}
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

          {/* Totales */}
          <div className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3">
            <div className="space-y-1 text-small">
              <Fila label="Subtotal" valor={formatearMoneda(subtotal, pais)} />
              {impuesto > 0 && (
                <Fila label="Impuestos" valor={formatearMoneda(impuesto, pais)} />
              )}
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-[color:var(--color-border)] pt-2">
              <span className="text-label">Total</span>
              <span className="text-xl font-bold text-[color:var(--color-primary)]">
                {formatearMoneda(total, pais)}
              </span>
            </div>
            <Button
              onClick={intentarCobrar}
              disabled={carrito.length === 0 || procesando}
              className="mt-3 w-full"
              size="lg"
            >
              Cobrar (F12)
            </Button>
          </div>
        </section>
      </div>

      {modalPago && (
        <ModalPago
          pais={pais}
          total={total}
          subtotal={subtotal}
          impuesto={impuesto}
          carrito={carrito}
          cliente={cliente}
          formasPago={formasPago}
          sucursalId={sucursalId}
          almacenId={almacenId}
          procesando={procesando}
          onCerrar={() => setModalPago(false)}
          onConfirmar={async (datos) => {
            setProcesando(true);
            const res = await procesarVenta({
              sucursalId,
              almacenId,
              clienteId: cliente?.id ?? "",
              items: carrito.map((it) => ({
                productoId: it.producto.id,
                cantidad: it.cantidad,
                precioUnitario: it.producto.precio,
                descuento: it.descuento,
                impuesto:
                  (it.cantidad * it.producto.precio - it.descuento) *
                  it.producto.impuestoTasa,
                costoUnitario: it.producto.costo,
              })),
              pagos: datos.pagos,
              descuentoGlobal: 0,
              esCredito: datos.esCredito,
              diasCredito: datos.esCredito ? (cliente?.diasCredito ?? 30) : 0,
            });
            setProcesando(false);
            if (!res.ok) {
              mostrar("error", res.error);
              return;
            }
            mostrar("success", `Venta ${res.numero} procesada`);
            setCarrito([]);
            setClienteId("");
            setModalPago(false);
            setVentaExito({ id: res.ventaId, numero: res.numero });
            router.refresh();
          }}
        />
      )}

      {ventaExito && (
        <Modal
          abierto={true}
          onCerrar={() => setVentaExito(null)}
          titulo="Venta completada"
          descripcion={`Factura ${ventaExito.numero} registrada correctamente.`}
          ancho="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setVentaExito(null)}>
                Nueva venta
              </Button>
              <Button
                onClick={() =>
                  window.open(`/ticket/${ventaExito.id}?print=1`, "_blank")
                }
              >
                <Receipt size={14} /> Imprimir factura
              </Button>
            </>
          }
        >
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]">
              <Check size={28} />
            </div>
            <p className="text-small text-[color:var(--color-text-muted)]">
              La factura quedó guardada. Puedes imprimir la copia del negocio.
            </p>
          </div>
        </Modal>
      )}

      {modalCaja && (
        <ModalAbrirCaja
          cajas={cajas}
          onMasTarde={() => setModalCaja(false)}
          onAbierta={() => {
            setCajaAbierta(true);
            setModalCaja(false);
            mostrar("success", "Caja abierta. Ya puedes registrar ventas.");
            router.refresh();
          }}
          onError={(msg) => mostrar("error", msg)}
        />
      )}
    </div>
  );
}

function ModalAbrirCaja({
  cajas,
  onMasTarde,
  onAbierta,
  onError,
}: {
  cajas: { value: string; label: string }[];
  onMasTarde: () => void;
  onAbierta: () => void;
  onError: (msg: string) => void;
}) {
  const [cajaId, setCajaId] = useState(cajas[0]?.value ?? "");
  const [montoStr, setMontoStr] = useState("0");
  const [abriendo, setAbriendo] = useState(false);

  async function abrir() {
    if (!cajaId) return;
    setAbriendo(true);
    const res = await abrirSesion({
      cajaId,
      montoInicial: parseFloat(montoStr) || 0,
    });
    setAbriendo(false);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    onAbierta();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-[color:var(--color-text-primary)] shadow-2xl">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[color:var(--color-tertiary)]/15 text-[color:var(--color-primary)]">
            <Store size={18} />
          </div>
          <h2 className="text-lg font-semibold">Abrir caja</h2>
        </div>
        <p className="mb-4 text-small text-[color:var(--color-text-muted)]">
          Para registrar ventas y generar facturas necesitas una caja abierta.
        </p>

        {cajas.length === 0 ? (
          <div className="rounded-md bg-[color:var(--color-warning)]/10 p-3 text-small">
            No hay cajas configuradas.{" "}
            <Link href="/configuracion/cajas" className="font-medium text-[color:var(--color-primary)] underline">
              Crear una caja
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <Select
              label="Caja"
              value={cajaId}
              onChange={(e) => setCajaId(e.target.value)}
              options={cajas}
            />
            <Input
              label="Monto inicial en caja"
              type="text"
              inputMode="decimal"
              value={montoStr}
              onChange={(e) => setMontoStr(e.target.value.replace(/[^0-9.]/g, ""))}
              onFocus={(e) => e.target.select()}
              hint="Efectivo con el que abres la caja"
            />
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={onMasTarde} disabled={abriendo}>
            Abrir más tarde
          </Button>
          {cajas.length > 0 && (
            <Button onClick={abrir} loading={abriendo} disabled={!cajaId}>
              <Store size={14} /> Abrir caja
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[color:var(--color-text-muted)]">{label}</span>
      <span className="font-medium text-[color:var(--color-text-primary)]">{valor}</span>
    </div>
  );
}

function SelectorCliente({
  clientes,
  clienteId,
  onChange,
}: {
  clientes: ClientePOS[];
  clienteId: string;
  onChange: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const cliente = clientes.find((c) => c.id === clienteId);
  return (
    <div className="border-b border-[color:var(--color-border)] p-3">
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex w-full items-center justify-between rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-small transition hover:border-[color:var(--color-border-strong)]"
      >
        <span className="flex items-center gap-2">
          <User size={14} className="text-[color:var(--color-text-muted)]" />
          {cliente?.nombre ?? "Consumidor final"}
        </span>
        <span className="text-[color:var(--color-text-muted)]">Cambiar →</span>
      </button>
      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Seleccionar cliente"
        descripcion="Elige un cliente registrado o continúa como consumidor final."
      >
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setAbierto(false);
            }}
            className={cn(
              "w-full rounded-md border p-3 text-left transition",
              clienteId === ""
                ? "border-[color:var(--color-primary)] bg-[color:var(--color-surface-2)]"
                : "border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]",
            )}
          >
            <div className="font-medium">Consumidor final</div>
            <div className="text-[12px] text-[color:var(--color-text-muted)]">
              Sin datos fiscales · Solo contado
            </div>
          </button>
          {clientes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c.id);
                setAbierto(false);
              }}
              className={cn(
                "w-full rounded-md border p-3 text-left transition",
                clienteId === c.id
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-surface-2)]"
                  : "border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]",
              )}
            >
              <div className="font-medium">{c.nombre}</div>
              <div className="text-[12px] text-[color:var(--color-text-muted)]">
                {c.tieneCredito ? `Crédito ${c.diasCredito} días` : "Solo contado"}
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function ModalPago({
  pais,
  total,
  carrito,
  cliente,
  formasPago,
  procesando,
  onCerrar,
  onConfirmar,
}: {
  pais: PaisCodigo;
  total: number;
  subtotal: number;
  impuesto: number;
  carrito: ItemCarrito[];
  cliente?: ClientePOS;
  formasPago: FormaPagoPOS[];
  sucursalId: string;
  almacenId: string;
  procesando: boolean;
  onCerrar: () => void;
  onConfirmar: (datos: { pagos: { formaPagoId: string; monto: number; referencia?: string }[]; esCredito: boolean }) => void;
}) {
  const efectivo = formasPago.find((f) => f.codigo === "EFE");
  const credito = formasPago.find((f) => f.codigo === "CRE");
  const noCredito = formasPago.filter((f) => f.codigo !== "CRE");

  const [modo, setModo] = useState<"contado" | "mixto" | "credito">("contado");
  const [formaUnica, setFormaUnica] = useState<string>(efectivo?.id ?? noCredito[0]?.id ?? "");
  const [montoEfectivoStr, setMontoEfectivoStr] = useState<string>(total.toFixed(2));
  const [montoMixto, setMontoMixto] = useState<Record<string, string>>({});
  const [referencias, setReferencias] = useState<Record<string, string>>({});

  useEffect(() => {
    setMontoEfectivoStr(total.toFixed(2));
  }, [total]);

  void carrito; // referenciado para tipo

  const montoEfectivo = parseFloat(montoEfectivoStr) || 0;
  const cambio = Math.max(0, montoEfectivo - total);

  function confirmar() {
    if (modo === "contado") {
      if (formaUnica === efectivo?.id && montoEfectivo < total) {
        return;
      }
      const forma = formasPago.find((f) => f.id === formaUnica);
      onConfirmar({
        pagos: [
          {
            formaPagoId: formaUnica,
            monto: forma?.codigo === "EFE" ? total : total,
            referencia: referencias[formaUnica],
          },
        ],
        esCredito: false,
      });
    } else if (modo === "mixto") {
      const pagos = Object.entries(montoMixto)
        .map(([id, monto]) => ({
          formaPagoId: id,
          monto: parseFloat(monto) || 0,
          referencia: referencias[id],
        }))
        .filter((p) => p.monto > 0);
      const sumaTotal = pagos.reduce((a, p) => a + p.monto, 0);
      if (Math.abs(sumaTotal - total) > 0.01) return;
      onConfirmar({ pagos, esCredito: false });
    } else {
      if (!cliente || !cliente.tieneCredito || !credito) return;
      onConfirmar({
        pagos: [{ formaPagoId: credito.id, monto: total }],
        esCredito: true,
      });
    }
  }

  return (
    <Modal
      abierto={true}
      onCerrar={procesando ? () => {} : onCerrar}
      titulo="Cobrar venta"
      descripcion={`Total a cobrar: ${formatearMoneda(total, pais)}`}
      ancho="md"
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={procesando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} loading={procesando}>
            {procesando ? (
              <>
                <Loader2 className="animate-spin" size={14} /> Procesando
              </>
            ) : (
              <>
                <Check size={14} /> Confirmar venta
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-1">
          {(["contado", "mixto", "credito"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              disabled={m === "credito" && !cliente?.tieneCredito}
              className={cn(
                "flex-1 rounded px-3 py-1.5 text-small transition disabled:opacity-30",
                modo === m
                  ? "bg-white font-medium text-[color:var(--color-text-primary)] shadow-sm"
                  : "text-[color:var(--color-text-muted)]",
              )}
            >
              {m === "contado" ? "Contado" : m === "mixto" ? "Mixto" : "Crédito"}
            </button>
          ))}
        </div>

        {modo === "contado" && (
          <div className="space-y-3">
            <Select
              label="Forma de pago"
              value={formaUnica}
              onChange={(e) => setFormaUnica(e.target.value)}
              options={noCredito.map((f) => ({ value: f.id, label: f.nombre }))}
            />
            {formasPago.find((f) => f.id === formaUnica)?.codigo === "EFE" ? (
              <>
                <Input
                  label="Monto recibido"
                  type="text"
                  inputMode="decimal"
                  value={montoEfectivoStr}
                  onChange={(e) =>
                    setMontoEfectivoStr(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  onFocus={(e) => e.target.select()}
                  autoFocus
                />
                <div className="rounded-md bg-[color:var(--color-surface-2)] p-3 text-center">
                  <div className="text-label">Cambio</div>
                  <div className="text-2xl text-[color:var(--color-primary)]">
                    {formatearMoneda(cambio, pais)}
                  </div>
                </div>
              </>
            ) : formasPago.find((f) => f.id === formaUnica)?.requiereReferencia ? (
              <Input
                label="Número de referencia / autorización"
                value={referencias[formaUnica] ?? ""}
                onChange={(e) =>
                  setReferencias((r) => ({ ...r, [formaUnica]: e.target.value }))
                }
              />
            ) : null}
          </div>
        )}

        {modo === "mixto" && (
          <div className="space-y-3">
            <p className="text-small text-[color:var(--color-text-muted)]">
              Divide el pago entre dos o más formas.
            </p>
            {noCredito.map((f) => (
              <div key={f.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    label={f.nombre}
                    type="text"
                    inputMode="decimal"
                    value={montoMixto[f.id] ?? ""}
                    onChange={(e) =>
                      setMontoMixto((m) => ({
                        ...m,
                        [f.id]: e.target.value.replace(/[^0-9.]/g, ""),
                      }))
                    }
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>
            ))}
            <div className="rounded-md bg-[color:var(--color-surface-2)] p-3 text-small">
              <Fila
                label="Suma de pagos"
                valor={formatearMoneda(
                  Object.values(montoMixto).reduce(
                    (a, b) => a + (parseFloat(b) || 0),
                    0,
                  ),
                  pais,
                )}
              />
              <Fila label="Total venta" valor={formatearMoneda(total, pais)} />
            </div>
          </div>
        )}

        {modo === "credito" && (
          <div className="rounded-md bg-[color:var(--color-warning-bg)] p-4 text-small text-[color:var(--color-text-primary)]">
            <p className="font-medium">Venta al crédito</p>
            <p className="mt-1 text-[color:var(--color-text-muted)]">
              Se cargará al cliente <strong>{cliente?.nombre}</strong> con vencimiento a{" "}
              <strong>{cliente?.diasCredito} días</strong>. Se generará automáticamente
              la cuenta por cobrar.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
