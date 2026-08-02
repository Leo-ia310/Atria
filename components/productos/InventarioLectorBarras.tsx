"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Barcode, PackagePlus, Plus, TriangleAlert } from "lucide-react";
import { registrarEntradaInventarioPorLector } from "@/lib/actions/productos";
import { useBarcodeScanner } from "@/components/dispositivos/useBarcodeScanner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

type ProductoEscaneable = {
  id: string;
  sku: string;
  codigoBarras: string;
  nombre: string;
  precioBase: number;
  costoPromedio: number;
};

type AlmacenEntrada = {
  id: string;
  nombre: string;
};

type EntradaActiva = {
  codigo: string;
  producto: ProductoEscaneable;
};

function normalizarCodigo(valor: string): string {
  return valor.replace(/[\s\r\n\t]/g, "").trim();
}

export function InventarioLectorBarras({
  productos,
  almacen,
  pais,
}: {
  productos: ProductoEscaneable[];
  almacen?: AlmacenEntrada;
  pais: PaisCodigo;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const cantidadRef = useRef<HTMLInputElement>(null);
  const [entrada, setEntrada] = useState<EntradaActiva | null>(null);
  const [codigoNuevo, setCodigoNuevo] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [precioBase, setPrecioBase] = useState("");
  const [costoPromedio, setCostoPromedio] = useState("");
  const [pendiente, startTransition] = useTransition();

  const productosPorCodigo = useMemo(() => {
    const mapa = new Map<string, ProductoEscaneable[]>();
    for (const producto of productos) {
      const codigo = normalizarCodigo(producto.codigoBarras);
      if (!codigo) continue;
      const lista = mapa.get(codigo) ?? [];
      lista.push(producto);
      mapa.set(codigo, lista);
    }
    return mapa;
  }, [productos]);

  useEffect(() => {
    if (!entrada) return;
    const handle = window.setTimeout(() => {
      cantidadRef.current?.focus();
      cantidadRef.current?.select();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [entrada]);

  useBarcodeScanner({
    enabled: !entrada && !codigoNuevo,
    onScan: (codigoEscaneado) => {
      const codigo = normalizarCodigo(codigoEscaneado);
      if (!codigo) return;
      if (!almacen) {
        mostrar("error", "No hay almacen activo para recibir inventario");
        return;
      }
      const encontrados = productosPorCodigo.get(codigo) ?? [];
      if (encontrados.length === 0) {
        setCodigoNuevo(codigo);
        return;
      }
      if (encontrados.length > 1) {
        mostrar("error", "Ese codigo esta repetido en varios productos");
        return;
      }
      const producto = encontrados[0];
      setEntrada({ codigo, producto });
      setCantidad("1");
      setFechaVencimiento("");
      setPrecioBase(String(producto.precioBase));
      setCostoPromedio(String(producto.costoPromedio));
    },
  });

  function cerrarEntrada() {
    setEntrada(null);
    setCantidad("1");
    setFechaVencimiento("");
    setPrecioBase("");
    setCostoPromedio("");
  }

  function submitEntrada() {
    if (!entrada || !almacen) return;
    startTransition(async () => {
      const res = await registrarEntradaInventarioPorLector({
        productoId: entrada.producto.id,
        almacenId: almacen.id,
        codigoBarras: entrada.codigo,
        cantidad,
        fechaVencimiento,
        precioBase,
        costoPromedio,
      });
      if (!res.ok) {
        mostrar("error", res.error);
        return;
      }
      mostrar(
        "success",
        `${entrada.producto.nombre}: existencia ${res.existencia.toFixed(2)}`,
      );
      cerrarEntrada();
      router.refresh();
    });
  }

  function crearProducto() {
    if (!codigoNuevo) return;
    router.push(`/inventario/nuevo?codigoBarras=${encodeURIComponent(codigoNuevo)}`);
  }

  return (
    <>
      <span
        className="arca-btn arca-btn-secondary arca-btn-sm cursor-default"
        title={almacen ? `Recibiendo en ${almacen.nombre}` : "Sin almacen activo"}
      >
        <Barcode size={14} /> Lector activo
      </span>

      <Modal
        abierto={!!entrada}
        onCerrar={pendiente ? () => {} : cerrarEntrada}
        titulo="Entrada por codigo de barras"
        descripcion={entrada ? `${entrada.producto.sku} - ${entrada.producto.nombre}` : undefined}
        ancho="md"
        footer={
          <>
            <Button variant="ghost" onClick={cerrarEntrada} disabled={pendiente}>
              Cancelar
            </Button>
            <Button onClick={submitEntrada} loading={pendiente}>
              <PackagePlus size={14} /> Agregar
            </Button>
          </>
        }
      >
        {entrada && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitEntrada();
            }}
          >
            <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3 text-small">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[12px] text-[color:var(--color-text-muted)]">
                  {entrada.codigo}
                </span>
                <span className="font-semibold text-[color:var(--color-primary)]">
                  {formatearMoneda(parseFloat(precioBase) || 0, pais)}
                </span>
              </div>
              <div className="mt-1 font-medium text-[color:var(--color-text-primary)]">
                {entrada.producto.nombre}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                ref={cantidadRef}
                label="Cantidad"
                type="number"
                min="0.0001"
                step="0.0001"
                value={cantidad}
                onChange={(event) => setCantidad(event.target.value)}
              />
              <Input
                label="Vence"
                type="date"
                value={fechaVencimiento}
                onChange={(event) => setFechaVencimiento(event.target.value)}
                hint="Opcional"
              />
              <Input
                label="Precio"
                type="number"
                min="0"
                step="0.0001"
                value={precioBase}
                onChange={(event) => setPrecioBase(event.target.value)}
              />
              <Input
                label="Costo"
                type="number"
                min="0"
                step="0.0001"
                value={costoPromedio}
                onChange={(event) => setCostoPromedio(event.target.value)}
              />
            </div>
          </form>
        )}
      </Modal>

      <Modal
        abierto={!!codigoNuevo}
        onCerrar={() => setCodigoNuevo(null)}
        titulo="Producto no registrado"
        descripcion={codigoNuevo ? `Codigo ${codigoNuevo}` : undefined}
        ancho="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCodigoNuevo(null)}>
              Cancelar
            </Button>
            <Button onClick={crearProducto}>
              <Plus size={14} /> Crear producto
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 rounded-md border border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/10 p-3 text-small">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[color:var(--color-warning)]" />
          <div>
            <div className="font-medium text-[color:var(--color-text-primary)]">
              No encontramos un producto con ese codigo.
            </div>
            <p className="mt-1 text-[color:var(--color-text-muted)]">
              Puedes crearlo ahora y el formulario saldra con el codigo ya cargado.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
