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
  Barcode,
} from "lucide-react";
import { cn, formatearMoneda } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useBarcodeScanner } from "@/components/dispositivos/useBarcodeScanner";
import { PagoTarjetaPanel, referenciaTarjeta, type ResultadoTarjeta } from "@/components/pos/PagoTarjetaPanel";
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
  identificacionFiscal: string | null;
  telefono: string | null;
  email: string | null;
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

type CantidadEscaneoPendiente = {
  productoId: string;
  nombre: string;
  cantidadTexto: string;
  cantidadAplicada: number;
  expiraEn: number;
};

function dineroPos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function normalizarCodigoBarras(valor: string): string {
  return valor.replace(/[\s\r\n\t]/g, "").trim();
}

function prioridadClickable(a: { producto: ProductoPOS; index: number }, b: { producto: ProductoPOS; index: number }) {
  const aTieneCodigo = normalizarCodigoBarras(a.producto.codigoBarras).length > 0;
  const bTieneCodigo = normalizarCodigoBarras(b.producto.codigoBarras).length > 0;
  if (aTieneCodigo !== bTieneCodigo) return aTieneCodigo ? 1 : -1;
  return a.index - b.index;
}

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
  const [selectorClienteSignal, setSelectorClienteSignal] = useState(0);
  const [selectorClienteAbierto, setSelectorClienteAbierto] = useState(false);
  const [cantidadEscaneo, setCantidadEscaneo] =
    useState<CantidadEscaneoPendiente | null>(null);
  const buscadorRef = useRef<HTMLInputElement>(null);
  const cantidadEscaneoRef = useRef<CantidadEscaneoPendiente | null>(null);

  useEffect(() => {
    buscadorRef.current?.focus();
  }, []);

  useEffect(() => {
    cantidadEscaneoRef.current = cantidadEscaneo;
  }, [cantidadEscaneo]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "F2" && !modalPago && !modalCaja && !ventaExito && !selectorClienteAbierto) {
        e.preventDefault();
        buscadorRef.current?.focus();
      }
      if (e.key === "F4" && !modalPago && !modalCaja && !ventaExito && !selectorClienteAbierto) {
        e.preventDefault();
        setSelectorClienteSignal((signal) => signal + 1);
      }
      if (e.key === "F6" && !cajaAbierta && !modalCaja) {
        e.preventDefault();
        setModalCaja(true);
      }
      if (e.key === "F8" && carrito.length > 0 && !modalPago && !modalCaja && !ventaExito && !selectorClienteAbierto) {
        e.preventDefault();
        vaciarCarrito();
      }
      if (e.key === "F10" && !modalPago && !modalCaja && !ventaExito && !selectorClienteAbierto) {
        e.preventDefault();
        router.push("/dashboard");
      }
      if (e.key === "F12" && carrito.length > 0 && !modalPago && !selectorClienteAbierto) {
        e.preventDefault();
        intentarCobrar();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrito.length, modalPago, modalCaja, ventaExito, cajaAbierta, selectorClienteAbierto, router]);

  useEffect(() => {
    if (modalPago || modalCaja || ventaExito || selectorClienteAbierto) {
      setCantidadEscaneo(null);
    }
  }, [modalPago, modalCaja, ventaExito, selectorClienteAbierto]);

  useEffect(() => {
    function capturarCantidad(event: KeyboardEvent) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    const handle = (event: KeyboardEvent) => {
      const pendiente = cantidadEscaneoRef.current;
      if (!pendiente) return;
      if (modalPago || modalCaja || ventaExito || selectorClienteAbierto) return;
      if (Date.now() > pendiente.expiraEn) {
        setCantidadEscaneo(null);
        return;
      }

      if (/^\d$/.test(event.key)) {
        capturarCantidad(event);
        actualizarCantidadEscaneada((texto) =>
          (texto + event.key).replace(/^0+(?=\d)/, ""),
        );
        return;
      }

      if (event.key === "Backspace") {
        capturarCantidad(event);
        actualizarCantidadEscaneada((texto) => texto.slice(0, -1));
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        capturarCantidad(event);
        setCantidadEscaneo(null);
        buscadorRef.current?.focus();
        return;
      }

      if (event.key === "Escape") {
        capturarCantidad(event);
        setCantidadEscaneo(null);
        buscadorRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalPago, modalCaja, ventaExito, selectorClienteAbierto]);

  // Sin caja abierta no se puede cobrar: se reabre el aviso de abrir caja.
  function intentarCobrar() {
    if (!cajaAbierta) {
      setModalCaja(true);
      return;
    }
    setModalPago(true);
  }

  const productosPorCodigo = useMemo(() => {
    const mapa = new Map<string, ProductoPOS[]>();
    for (const producto of productos) {
      const codigo = normalizarCodigoBarras(producto.codigoBarras);
      if (!codigo) continue;
      const lista = mapa.get(codigo) ?? [];
      lista.push(producto);
      mapa.set(codigo, lista);
    }
    return mapa;
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos
      .map((producto, index) => ({ producto, index }))
      .filter(
        ({ producto }) =>
          !q ||
          producto.sku.toLowerCase().includes(q) ||
          producto.nombre.toLowerCase().includes(q) ||
          (producto.codigoBarras && producto.codigoBarras.toLowerCase().includes(q)),
      )
      .sort(prioridadClickable)
      .map(({ producto }) => producto)
      .slice(0, 50);
  }, [productos, busqueda]);

  useBarcodeScanner({
    enabled: !modalPago && !modalCaja && !ventaExito && !selectorClienteAbierto,
    onScan: (codigo) => {
      const normalizado = normalizarCodigoBarras(codigo);
      const encontrados = productosPorCodigo.get(normalizado) ?? [];
      if (encontrados.length === 0) {
        setBusqueda("");
        mostrar("warning", `Codigo ${normalizado} no registrado en inventario`);
        buscadorRef.current?.focus();
        return;
      }
      if (encontrados.length > 1) {
        setBusqueda("");
        mostrar("error", "Ese codigo esta repetido en varios productos");
        buscadorRef.current?.focus();
        return;
      }
      const producto = encontrados[0];
      agregarAlCarrito(producto, 1);
      setCantidadEscaneo({
        productoId: producto.id,
        nombre: producto.nombre,
        cantidadTexto: "",
        cantidadAplicada: 1,
        expiraEn: Date.now() + 5000,
      });
    },
  });

  function sumarCantidadProducto(productoId: string, delta: number) {
    if (delta === 0) return;
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

  function actualizarCantidadEscaneada(transformar: (texto: string) => string) {
    const actual = cantidadEscaneoRef.current;
    if (!actual) return;
    const texto = transformar(actual.cantidadTexto).slice(0, 6);
    const cantidad = texto ? Math.max(1, parseInt(texto, 10) || 1) : 1;
    const delta = cantidad - actual.cantidadAplicada;
    const siguiente = {
      ...actual,
      cantidadTexto: texto,
      cantidadAplicada: cantidad,
      expiraEn: Date.now() + 5000,
    };
    cantidadEscaneoRef.current = siguiente;
    sumarCantidadProducto(actual.productoId, delta);
    setCantidadEscaneo(siguiente);
  }

  function agregarAlCarrito(producto: ProductoPOS, cantidad = 1) {
    setCarrito((c) => {
      const existente = c.find((it) => it.producto.id === producto.id);
      if (existente) {
        return c.map((it) =>
          it.producto.id === producto.id
            ? { ...it, cantidad: it.cantidad + cantidad }
            : it,
        );
      }
      return [...c, { producto, cantidad, descuento: 0 }];
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

  function cerrarVentaCompletada() {
    setVentaExito(null);
    window.setTimeout(() => buscadorRef.current?.focus(), 0);
  }

  function imprimirVentaCompletada(copias: 1 | 2) {
    if (!ventaExito) return;
    window.open(`/ticket/${ventaExito.id}?print=1&copies=${copias}`, "_blank");
  }

  useEffect(() => {
    if (!ventaExito) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "F2") {
        event.preventDefault();
        cerrarVentaCompletada();
        return;
      }
      if (event.key === "F7") {
        event.preventDefault();
        imprimirVentaCompletada(1);
        return;
      }
      if (event.key === "F8") {
        event.preventDefault();
        imprimirVentaCompletada(2);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventaExito]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-neutral)] lg:h-[100dvh] lg:overflow-hidden">
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
            Abrir caja (F6)
          </button>
        </div>
      )}

      {/* Header POS */}
      <header className="flex items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="arca-btn arca-btn-ghost arca-btn-sm"
            title="Volver al dashboard (F10)"
          >
            <ArrowLeft size={14} /> Salir POS (F10)
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
            <span className="arca-badge arca-badge-success">
              <Store size={12} /> Caja abierta
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setModalCaja(true)}
              className="arca-badge arca-badge-warning"
              title="Abrir caja (F6)"
            >
              <Store size={12} /> Sin caja (F6)
            </button>
          )}
          <span className="arca-badge arca-badge-success">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            En línea
          </span>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-12 lg:overflow-hidden">
        {/* Productos */}
        <section className="lg:col-span-7 arca-card flex min-h-[55vh] flex-col overflow-hidden lg:min-h-0">
          <div className="border-b border-[color:var(--color-border)] p-3">
            <div className="space-y-2">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]"
              />
              <input
                ref={buscadorRef}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Escanear código o buscar por nombre/SKU (F2)"
                className="arca-input arca-input-con-icono text-base"
                autoFocus
              />
            </div>
            {cantidadEscaneo && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[color:var(--color-tertiary)]/40 bg-[color:var(--color-tertiary)]/10 px-3 py-2 text-small">
                <span className="flex min-w-0 items-center gap-2 text-[color:var(--color-text-primary)]">
                  <Barcode size={14} className="shrink-0 text-[color:var(--color-secondary)]" />
                  <span className="truncate">{cantidadEscaneo.nombre}</span>
                </span>
                <span className="font-semibold text-[color:var(--color-primary)]">
                  x{cantidadEscaneo.cantidadTexto || "1"}
                </span>
              </div>
            )}
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
        <section className="lg:col-span-5 arca-card flex min-h-[55vh] flex-col overflow-hidden lg:min-h-0">
          <div className="flex items-center justify-between border-b border-[color:var(--color-border)] p-3">
            <div>
              <div className="text-base font-semibold text-[color:var(--color-text-primary)]">
                Ticket · {carrito.length} {carrito.length === 1 ? "ítem" : "ítems"}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectorClienteSignal((signal) => signal + 1);
                }}
                className="mt-0.5 flex items-center gap-1 text-small text-[color:var(--color-secondary)] hover:underline"
              >
                <User size={12} />
                {cliente?.nombre ?? "Consumidor final"} (F4)
              </button>
            </div>
            <button
              type="button"
              onClick={vaciarCarrito}
              disabled={carrito.length === 0}
              className="arca-btn arca-btn-ghost arca-btn-sm disabled:opacity-30"
              title="Vaciar ticket (F8)"
            >
              <X size={14} /> <span className="hidden xl:inline">F8</span>
            </button>
          </div>

          <SelectorCliente
            clientes={clientes}
            clienteId={clienteId}
            onChange={setClienteId}
            abrirSignal={selectorClienteSignal}
            onAbiertoChange={setSelectorClienteAbierto}
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
              <Button variant="ghost" onClick={cerrarVentaCompletada}>
                Nueva venta (F2)
              </Button>
              <Button
                variant="secondary"
                onClick={() => imprimirVentaCompletada(1)}
              >
                <Receipt size={14} /> Imprimir 1 (F7)
              </Button>
              <Button onClick={() => imprimirVentaCompletada(2)}>
                <Receipt size={14} /> Imprimir 2 (F8)
              </Button>
            </>
          }
        >
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]">
              <Check size={28} />
            </div>
            <p className="text-small text-[color:var(--color-text-muted)]">
              La factura quedó guardada. Puedes imprimir una o dos copias.
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

function normalizarBusqueda(valor: string): string {
  return valor
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function SelectorCliente({
  clientes,
  clienteId,
  onChange,
  abrirSignal,
  onAbiertoChange,
}: {
  clientes: ClientePOS[];
  clienteId: string;
  onChange: (id: string) => void;
  abrirSignal: number;
  onAbiertoChange: (abierto: boolean) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const busquedaRef = useRef<HTMLInputElement>(null);
  const cliente = clientes.find((c) => c.id === clienteId);

  useEffect(() => {
    onAbiertoChange(abierto);
  }, [abierto, onAbiertoChange]);

  useEffect(() => {
    if (abrirSignal === 0) return;
    setAbierto(true);
    setBusqueda("");
    window.setTimeout(() => busquedaRef.current?.focus(), 0);
  }, [abrirSignal]);

  const clientesFiltrados = useMemo(() => {
    const candidatos = clientes.filter((c) => !c.esConsumidorFinal);
    const consulta = normalizarBusqueda(busqueda);
    if (!consulta) return candidatos.sort((a, b) => a.nombre.localeCompare(b.nombre)).slice(0, 60);
    const tokens = consulta.split(/\s+/).filter(Boolean);
    return candidatos
      .map((c) => {
        const nombre = normalizarBusqueda(c.nombre);
        const identificacion = normalizarBusqueda(c.identificacionFiscal ?? "");
        const telefono = normalizarBusqueda(c.telefono ?? "");
        const email = normalizarBusqueda(c.email ?? "");
        const conjunto = `${nombre} ${identificacion} ${telefono} ${email}`;
        if (!tokens.every((token) => conjunto.includes(token))) return null;
        let puntaje = 0;
        if (nombre === consulta || identificacion === consulta) puntaje += 100;
        if (nombre.startsWith(consulta)) puntaje += 50;
        if (identificacion.startsWith(consulta) || telefono.startsWith(consulta)) puntaje += 35;
        if (email.startsWith(consulta)) puntaje += 20;
        return { cliente: c, puntaje };
      })
      .filter((resultado): resultado is { cliente: ClientePOS; puntaje: number } => Boolean(resultado))
      .sort((a, b) => b.puntaje - a.puntaje || a.cliente.nombre.localeCompare(b.cliente.nombre))
      .slice(0, 60)
      .map((resultado) => resultado.cliente);
  }, [busqueda, clientes]);

  function seleccionar(id: string) {
    onChange(id);
    setAbierto(false);
    setBusqueda("");
  }

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
        <span className="text-[color:var(--color-text-muted)]">Cambiar (F4) →</span>
      </button>
      <Modal
        abierto={abierto}
        onCerrar={() => {
          setAbierto(false);
          setBusqueda("");
        }}
        titulo="Seleccionar cliente"
        descripcion="Busca por nombre, identificación fiscal, teléfono o correo."
        ancho="lg"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]"
            />
            <input
              ref={busquedaRef}
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, RUC, cédula, teléfono o correo..."
              className="arca-input arca-input-con-icono"
            />
          </div>
          <button
            type="button"
            onClick={() => seleccionar("")}
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
          <div className="max-h-[44vh] space-y-1 overflow-y-auto pr-1">
            {clientesFiltrados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => seleccionar(c.id)}
                className={cn(
                  "w-full rounded-md border p-3 text-left transition",
                  clienteId === c.id
                    ? "border-[color:var(--color-primary)] bg-[color:var(--color-surface-2)]"
                    : "border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{c.nombre}</span>
                  <span className="text-[12px] text-[color:var(--color-text-muted)]">
                    {c.tieneCredito ? `Crédito ${c.diasCredito} días` : "Solo contado"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[color:var(--color-text-muted)]">
                  {c.identificacionFiscal && <span>{c.identificacionFiscal}</span>}
                  {c.telefono && <span>{c.telefono}</span>}
                  {c.email && <span>{c.email}</span>}
                </div>
              </button>
            ))}
            {clientesFiltrados.length === 0 && (
              <div className="py-6 text-center text-small text-[color:var(--color-text-muted)]">
                No encontramos clientes con todos esos datos.
              </div>
            )}
          </div>
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
  const [montoEfectivoStr, setMontoEfectivoStr] = useState<string>("");
  const [montoMixto, setMontoMixto] = useState<Record<string, string>>({});
  const [referencias, setReferencias] = useState<Record<string, string>>({});
  const confirmarRef = useRef<() => void>(() => {});
  const totalCobro = dineroPos(total);
  const formaSeleccionada = formasPago.find((f) => f.id === formaUnica);
  const esTarjeta = modo === "contado" && formaSeleccionada?.codigo === "TAR";

  void carrito; // referenciado para tipo

  const montoEfectivoRaw =
    montoEfectivoStr.trim() === "" ? totalCobro : parseFloat(montoEfectivoStr);
  const montoEfectivo = dineroPos(Number.isFinite(montoEfectivoRaw) ? montoEfectivoRaw : 0);
  const cambio = Math.max(0, dineroPos(montoEfectivo - totalCobro));

  function confirmarTarjeta(info: ResultadoTarjeta) {
    if (procesando || !formaSeleccionada) return;
    onConfirmar({
      pagos: [
        {
          formaPagoId: formaSeleccionada.id,
          monto: totalCobro,
          referencia: referenciaTarjeta(info),
        },
      ],
      esCredito: false,
    });
  }

  function confirmar() {
    if (procesando) return;
    if (modo === "contado") {
      // El cobro con tarjeta se confirma con "Pago aprobado" en el datáfono, no aquí.
      if (esTarjeta) return;
      if (formaUnica === efectivo?.id && montoEfectivo + 0.001 < totalCobro) {
        return;
      }
      const forma = formasPago.find((f) => f.id === formaUnica);
      onConfirmar({
        pagos: [
          {
            formaPagoId: formaUnica,
            monto: totalCobro,
            referencia: referencias[formaUnica],
          },
        ],
        esCredito: false,
      });
    } else if (modo === "mixto") {
      const pagos = Object.entries(montoMixto)
        .map(([id, monto]) => ({
          formaPagoId: id,
          monto: dineroPos(parseFloat(monto) || 0),
          referencia: referencias[id],
        }))
        .filter((p) => p.monto > 0);
      const sumaTotal = pagos.reduce((a, p) => a + p.monto, 0);
      if (Math.abs(dineroPos(sumaTotal) - totalCobro) > 0.01) return;
      onConfirmar({ pagos, esCredito: false });
    } else {
      if (!cliente || !cliente.tieneCredito || !credito) return;
      onConfirmar({
        pagos: [{ formaPagoId: credito.id, monto: totalCobro }],
        esCredito: true,
      });
    }
  }
  confirmarRef.current = confirmar;

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key !== "F12") return;
      event.preventDefault();
      confirmarRef.current();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

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
          {!esTarjeta && (
            <Button onClick={confirmar} loading={procesando}>
              {procesando ? (
                <>
                  <Loader2 className="animate-spin" size={14} /> Procesando
                </>
              ) : (
                <>
                  <Check size={14} /> Confirmar venta (F12)
                </>
              )}
            </Button>
          )}
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
                  ? "bg-[color:var(--color-surface)] font-medium text-[color:var(--color-text-primary)] shadow-sm"
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
            {formaSeleccionada?.codigo === "EFE" ? (
              <>
                <Input
                  label="Monto recibido"
                  type="text"
                  inputMode="decimal"
                  placeholder={totalCobro.toFixed(2)}
                  value={montoEfectivoStr}
                  onChange={(e) =>
                    setMontoEfectivoStr(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  onFocus={(e) => e.target.select()}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setMontoEfectivoStr(totalCobro.toFixed(2))}
                  className="text-small font-medium text-[color:var(--color-primary)] hover:underline"
                >
                  Pago exacto ({formatearMoneda(totalCobro, pais)})
                </button>
                <div className="rounded-md bg-[color:var(--color-surface-2)] p-3 text-center">
                  <div className="text-label">Cambio</div>
                  <div className="text-2xl text-[color:var(--color-primary)]">
                    {formatearMoneda(cambio, pais)}
                  </div>
                </div>
              </>
            ) : esTarjeta ? (
              <PagoTarjetaPanel
                total={totalCobro}
                pais={pais}
                procesando={procesando}
                onAprobado={confirmarTarjeta}
                onRechazado={() => {}}
              />
            ) : formaSeleccionada?.requiereReferencia ? (
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
