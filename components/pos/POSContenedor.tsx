"use client";

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useReducer,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
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
  TriangleAlert,
  Store,
  Barcode,
} from "lucide-react";
import { cn, formatearMoneda } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useBarcodeScanner } from "@/components/dispositivos/useBarcodeScanner";
import { ModalAbrirCaja } from "@/components/pos/ModalAbrirCaja";
import { ModalPago } from "@/components/pos/ModalPago";
import { SelectorCliente } from "@/components/pos/SelectorCliente";
import { procesarVenta } from "@/lib/actions/ventas";
import type { PaisCodigo } from "@/lib/paises";

export type ProductoPOS = {
  id: string;
  sku: string;
  codigoBarras: string;
  nombre: string;
  precio: number;
  costo: number;
  impuestoTasa: number;
};

export type ClientePOS = {
  id: string;
  nombre: string;
  identificacionFiscal: string | null;
  telefono: string | null;
  email: string | null;
  tieneCredito: boolean;
  diasCredito: number;
  esConsumidorFinal: boolean;
};

export type FormaPagoPOS = {
  id: string;
  codigo: string;
  nombre: string;
  requiereReferencia: boolean;
};

export type ItemCarrito = {
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

type VentaExito = { id: string; numero: string };

type POSContenedorViewProps = {
  cajaAbierta: boolean;
  setModalCaja: (modalCaja: boolean) => void;
  sucursalNombre: string;
  nombreUsuario: string;
  pais: PaisCodigo;
  buscadorRef: RefObject<HTMLInputElement | null>;
  busqueda: string;
  setBusqueda: Dispatch<SetStateAction<string>>;
  cantidadEscaneo: CantidadEscaneoPendiente | null;
  productosFiltrados: ProductoPOS[];
  agregarAlCarrito: (producto: ProductoPOS, cantidad?: number) => void;
  carrito: ItemCarrito[];
  cliente: ClientePOS | undefined;
  clientes: ClientePOS[];
  clienteId: string;
  setClienteId: Dispatch<SetStateAction<string>>;
  selectorClienteAbierto: boolean;
  setSelectorClienteAbierto: (selectorClienteAbierto: boolean) => void;
  vaciarCarrito: () => void;
  cambiarCantidad: (productoId: string, delta: number) => void;
  eliminarItem: (productoId: string) => void;
  subtotal: number;
  impuesto: number;
  total: number;
  procesando: boolean;
  intentarCobrar: () => void;
  modalPago: boolean;
  formasPago: FormaPagoPOS[];
  sucursalId: string;
  almacenId: string;
  setModalPago: (modalPago: boolean) => void;
  setProcesando: (procesando: boolean) => void;
  setCarrito: Dispatch<SetStateAction<ItemCarrito[]>>;
  setVentaExito: (ventaExito: VentaExito | null) => void;
  mostrar: ReturnType<typeof useToast>["mostrar"];
  onRefresh: () => void;
  ventaExito: VentaExito | null;
  cerrarVentaCompletada: () => void;
  imprimirVentaCompletada: (copias: 1 | 2) => void;
  modalCaja: boolean;
  cajas: { value: string; label: string }[];
  setCajaAbiertaLocal: (cajaAbiertaLocal: boolean) => void;
};

type FlujoVentaState = {
  modalPago: boolean;
  procesando: boolean;
  ventaExito: VentaExito | null;
  cajaAbiertaLocal: boolean;
  modalCaja: boolean;
  selectorClienteAbierto: boolean;
  cantidadEscaneo: CantidadEscaneoPendiente | null;
};

type FlujoVentaAction = { type: "patch"; patch: Partial<FlujoVentaState> };

function flujoVentaReducer(state: FlujoVentaState, action: FlujoVentaAction): FlujoVentaState {
  return { ...state, ...action.patch };
}

function estadoInicialFlujoVenta(hayCajaAbierta: boolean): FlujoVentaState {
  return {
    modalPago: false,
    procesando: false,
    ventaExito: null,
    cajaAbiertaLocal: false,
    modalCaja: !hayCajaAbierta,
    selectorClienteAbierto: false,
    cantidadEscaneo: null,
  };
}

function useFlujoVentaState(hayCajaAbierta: boolean) {
  const [flujoVenta, dispatchFlujoVenta] = useReducer(
    flujoVentaReducer,
    hayCajaAbierta,
    estadoInicialFlujoVenta,
  );
  const setFlujoVenta = useCallback(
    (patch: Partial<FlujoVentaState>) => dispatchFlujoVenta({ type: "patch", patch }),
    [],
  );
  const setModalPago = useCallback(
    (modalPago: boolean) => setFlujoVenta({ modalPago }),
    [setFlujoVenta],
  );
  const setProcesando = useCallback(
    (procesando: boolean) => setFlujoVenta({ procesando }),
    [setFlujoVenta],
  );
  const setVentaExito = useCallback(
    (ventaExito: VentaExito | null) => setFlujoVenta({ ventaExito }),
    [setFlujoVenta],
  );
  const setCajaAbiertaLocal = useCallback(
    (cajaAbiertaLocal: boolean) => setFlujoVenta({ cajaAbiertaLocal }),
    [setFlujoVenta],
  );
  const setModalCaja = useCallback(
    (modalCaja: boolean) => setFlujoVenta({ modalCaja }),
    [setFlujoVenta],
  );
  const setSelectorClienteAbierto = useCallback(
    (selectorClienteAbierto: boolean) => setFlujoVenta({ selectorClienteAbierto }),
    [setFlujoVenta],
  );
  const setCantidadEscaneo = useCallback(
    (cantidadEscaneo: CantidadEscaneoPendiente | null) => setFlujoVenta({ cantidadEscaneo }),
    [setFlujoVenta],
  );

  return {
    ...flujoVenta,
    cajaAbierta: hayCajaAbierta || flujoVenta.cajaAbiertaLocal,
    setModalPago,
    setProcesando,
    setVentaExito,
    setCajaAbiertaLocal,
    setModalCaja,
    setSelectorClienteAbierto,
    setCantidadEscaneo,
  };
}

function useCarritoPOS({
  setBusqueda,
  buscadorRef,
  setClienteId,
}: {
  setBusqueda: Dispatch<SetStateAction<string>>;
  buscadorRef: RefObject<HTMLInputElement | null>;
  setClienteId: Dispatch<SetStateAction<string>>;
}) {
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);

  function sumarCantidadProducto(productoId: string, delta: number) {
    if (delta === 0) return;
    setCarrito((carritoActual) => actualizarCantidadCarrito(carritoActual, productoId, delta));
  }

  function agregarAlCarrito(producto: ProductoPOS, cantidad = 1) {
    setCarrito((carritoActual) => {
      const existente = carritoActual.find((item) => item.producto.id === producto.id);
      if (existente) {
        return carritoActual.map((item) =>
          item.producto.id === producto.id
            ? { ...item, cantidad: item.cantidad + cantidad }
            : item,
        );
      }
      return [...carritoActual, { producto, cantidad, descuento: 0 }];
    });
    setBusqueda("");
    buscadorRef.current?.focus();
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setCarrito((carritoActual) => actualizarCantidadCarrito(carritoActual, productoId, delta));
  }

  function eliminarItem(productoId: string) {
    setCarrito((carritoActual) =>
      carritoActual.filter((item) => item.producto.id !== productoId),
    );
  }

  function vaciarCarrito() {
    if (carrito.length === 0) return;
    if (confirm("¿Vaciar el ticket actual?")) {
      setCarrito([]);
      setClienteId("");
    }
  }

  const subtotal = carrito.reduce(
    (acc, item) => acc + item.cantidad * item.producto.precio - item.descuento,
    0,
  );
  const impuesto = carrito.reduce(
    (acc, item) =>
      acc + (item.cantidad * item.producto.precio - item.descuento) * item.producto.impuestoTasa,
    0,
  );

  return {
    carrito,
    setCarrito,
    sumarCantidadProducto,
    agregarAlCarrito,
    cambiarCantidad,
    eliminarItem,
    vaciarCarrito,
    subtotal,
    impuesto,
    total: subtotal + impuesto,
  };
}

function actualizarCantidadCarrito(
  carrito: ItemCarrito[],
  productoId: string,
  delta: number,
): ItemCarrito[] {
  const siguiente: ItemCarrito[] = [];
  for (const item of carrito) {
    const actualizado =
      item.producto.id === productoId
        ? { ...item, cantidad: Math.max(0, item.cantidad + delta) }
        : item;
    if (actualizado.cantidad > 0) siguiente.push(actualizado);
  }
  return siguiente;
}

function dineroPos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[color:var(--color-text-muted)]">{label}</span>
      <span className="font-medium text-[color:var(--color-text-primary)]">{valor}</span>
    </div>
  );
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
  const [clienteId, setClienteId] = useState<string>("");
  const buscadorRef = useRef<HTMLInputElement>(null);
  const {
    carrito,
    setCarrito,
    sumarCantidadProducto,
    agregarAlCarrito,
    cambiarCantidad,
    eliminarItem,
    vaciarCarrito,
    subtotal,
    impuesto,
    total,
  } = useCarritoPOS({ setBusqueda, buscadorRef, setClienteId });
  const {
    modalPago,
    procesando,
    ventaExito,
    cajaAbierta,
    modalCaja,
    selectorClienteAbierto,
    cantidadEscaneo,
    setModalPago,
    setProcesando,
    setVentaExito,
    setCajaAbiertaLocal,
    setModalCaja,
    setSelectorClienteAbierto,
    setCantidadEscaneo,
  } = useFlujoVentaState(hayCajaAbierta);
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
        setSelectorClienteAbierto(true);
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
  }, [modalPago, modalCaja, ventaExito, selectorClienteAbierto, setCantidadEscaneo]);

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
    const coincidencias: { producto: ProductoPOS; index: number }[] = [];
    for (let index = 0; index < productos.length; index += 1) {
      const producto = productos[index];
      if (
        !q ||
        producto.sku.toLowerCase().includes(q) ||
        producto.nombre.toLowerCase().includes(q) ||
        (producto.codigoBarras && producto.codigoBarras.toLowerCase().includes(q))
      ) {
        coincidencias.push({ producto, index });
      }
    }
    return coincidencias
      .sort(prioridadClickable)
      .slice(0, 50)
      .map(({ producto }) => producto);
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

  return posContenedorView({
    cajaAbierta,
    setModalCaja,
    sucursalNombre,
    nombreUsuario,
    pais,
    buscadorRef,
    busqueda,
    setBusqueda,
    cantidadEscaneo,
    productosFiltrados,
    agregarAlCarrito,
    carrito,
    cliente,
    clientes,
    clienteId,
    setClienteId,
    selectorClienteAbierto,
    setSelectorClienteAbierto,
    vaciarCarrito,
    cambiarCantidad,
    eliminarItem,
    subtotal,
    impuesto,
    total,
    procesando,
    intentarCobrar,
    modalPago,
    formasPago,
    sucursalId,
    almacenId,
    setModalPago,
    setProcesando,
    setCarrito,
    setVentaExito,
    mostrar,
    onRefresh: () => router.refresh(),
    ventaExito,
    cerrarVentaCompletada,
    imprimirVentaCompletada,
    modalCaja,
    cajas,
    setCajaAbiertaLocal,
  });
}

function posContenedorView({
  cajaAbierta,
  setModalCaja,
  sucursalNombre,
  nombreUsuario,
  pais,
  buscadorRef,
  busqueda,
  setBusqueda,
  cantidadEscaneo,
  productosFiltrados,
  agregarAlCarrito,
  carrito,
  cliente,
  clientes,
  clienteId,
  setClienteId,
  selectorClienteAbierto,
  setSelectorClienteAbierto,
  vaciarCarrito,
  cambiarCantidad,
  eliminarItem,
  subtotal,
  impuesto,
  total,
  procesando,
  intentarCobrar,
  modalPago,
  formasPago,
  sucursalId,
  almacenId,
  setModalPago,
  setProcesando,
  setCarrito,
  setVentaExito,
  mostrar,
  onRefresh,
  ventaExito,
  cerrarVentaCompletada,
  imprimirVentaCompletada,
  modalCaja,
  cajas,
  setCajaAbiertaLocal,
}: POSContenedorViewProps) {
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
              <label htmlFor="pos-busqueda-productos" className="sr-only">
                Buscar producto
              </label>
              <input
                id="pos-busqueda-productos"
                ref={buscadorRef}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Escanear código o buscar por nombre/SKU (F2)"
                className="arca-input arca-input-con-icono text-base"
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
                onClick={() => setSelectorClienteAbierto(true)}
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
            abierto={selectorClienteAbierto}
            onAbrir={() => setSelectorClienteAbierto(true)}
            onCerrar={() => setSelectorClienteAbierto(false)}
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
                        aria-label={`Disminuir ${it.producto.nombre}`}
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
                        aria-label={`Aumentar ${it.producto.nombre}`}
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
                      aria-label={`Quitar ${it.producto.nombre}`}
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
              {fila({ label: "Subtotal", valor: formatearMoneda(subtotal, pais) })}
              {impuesto > 0 &&
                fila({ label: "Impuestos", valor: formatearMoneda(impuesto, pais) })}
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
            onRefresh();
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
            setCajaAbiertaLocal(true);
            setModalCaja(false);
            mostrar("success", "Caja abierta. Ya puedes registrar ventas.");
            onRefresh();
          }}
          onError={(msg) => mostrar("error", msg)}
        />
      )}
    </div>
  );
}
