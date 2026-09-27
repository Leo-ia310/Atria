"use client";

import { useEffect, useMemo, useReducer, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Barcode, PackagePlus, Plus, TriangleAlert } from "lucide-react";
import { registrarCompraRapidaInventarioPorLector } from "@/lib/actions/productos";
import { useBarcodeScanner } from "@/components/dispositivos/useBarcodeScanner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

type CompraProductoEscaneable = {
  proveedorId: string;
  proveedorNombre: string;
  ultimoCosto: number;
  fecha: string;
};

type ProductoEscaneable = {
  id: string;
  sku: string;
  codigoBarras: string;
  nombre: string;
  precioBase: number;
  costoPromedio: number;
  compras: CompraProductoEscaneable[];
};

type AlmacenEntrada = {
  id: string;
  nombre: string;
};

type EntradaActiva = {
  codigo: string;
  producto: ProductoEscaneable;
};

type LectorState = {
  entrada: EntradaActiva | null;
  codigoNuevo: string | null;
  cantidad: string;
  proveedorId: string;
  costoUnitario: string;
};

const LECTOR_INICIAL: LectorState = {
  entrada: null,
  codigoNuevo: null,
  cantidad: "1",
  proveedorId: "",
  costoUnitario: "",
};

type LectorAction =
  | { type: "patch"; patch: Partial<LectorState> }
  | { type: "abrirEntrada"; entrada: EntradaActiva }
  | { type: "cerrarEntrada" };

function lectorReducer(state: LectorState, action: LectorAction): LectorState {
  if (action.type === "abrirEntrada") {
    return {
      ...state,
      entrada: action.entrada,
      cantidad: "1",
      proveedorId: action.entrada.producto.compras[0]?.proveedorId ?? "",
      costoUnitario: String(
        action.entrada.producto.compras[0]?.ultimoCosto ??
          action.entrada.producto.costoPromedio,
      ),
    };
  }
  if (action.type === "cerrarEntrada") {
    return { ...state, ...LECTOR_INICIAL };
  }
  return { ...state, ...action.patch };
}

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
  const [lector, dispatchLector] = useReducer(lectorReducer, LECTOR_INICIAL);
  const { entrada, codigoNuevo, cantidad, proveedorId, costoUnitario } = lector;
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
        dispatchLector({ type: "patch", patch: { codigoNuevo: codigo } });
        return;
      }
      if (encontrados.length > 1) {
        mostrar("error", "Ese codigo de barras o QR esta repetido en varios productos");
        return;
      }
      const producto = encontrados[0];
      if (producto.compras.length === 0) {
        mostrar("warning", "Este producto aun no tiene proveedor en compras");
        return;
      }
      dispatchLector({ type: "abrirEntrada", entrada: { codigo, producto } });
    },
    maxInterKeyDelayMs: 150,
  });

  function cerrarEntrada() {
    dispatchLector({ type: "cerrarEntrada" });
  }

  function submitEntrada() {
    if (!entrada || !almacen) return;
    startTransition(async () => {
      const res = await registrarCompraRapidaInventarioPorLector({
        productoId: entrada.producto.id,
        almacenId: almacen.id,
        proveedorId,
        codigoBarras: entrada.codigo,
        cantidad,
        costoUnitario,
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
        <Barcode size={14} /> Lector barras/QR activo
      </span>

      <Modal
        abierto={!!entrada}
        onCerrar={pendiente ? () => {} : cerrarEntrada}
        titulo="Compra rapida por codigo de barras o QR"
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
                  {formatearMoneda(parseFloat(costoUnitario) || 0, pais)}
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
                onChange={(event) =>
                  dispatchLector({ type: "patch", patch: { cantidad: event.target.value } })
                }
              />
              <Select
                label="Proveedor"
                value={proveedorId}
                onChange={(event) => {
                  const compra = entrada.producto.compras.find(
                    (item) => item.proveedorId === event.target.value,
                  );
                  dispatchLector({
                    type: "patch",
                    patch: {
                      proveedorId: event.target.value,
                      costoUnitario: String(compra?.ultimoCosto ?? costoUnitario),
                    },
                  });
                }}
                options={entrada.producto.compras.map((compra) => ({
                  value: compra.proveedorId,
                  label: compra.proveedorNombre,
                }))}
              />
              <Input
                label="Costo de compra"
                type="number"
                min="0"
                step="0.0001"
                value={costoUnitario}
                onChange={(event) =>
                  dispatchLector({ type: "patch", patch: { costoUnitario: event.target.value } })
                }
                hint={
                  entrada.producto.compras.find((compra) => compra.proveedorId === proveedorId)
                    ? `Ultima compra: ${
                        entrada.producto.compras.find(
                          (compra) => compra.proveedorId === proveedorId,
                        )?.fecha
                      }`
                    : undefined
                }
              />
            </div>
          </form>
        )}
      </Modal>

      <Modal
        abierto={!!codigoNuevo}
        onCerrar={() => dispatchLector({ type: "patch", patch: { codigoNuevo: null } })}
        titulo="Producto no registrado"
        descripcion={codigoNuevo ? `Codigo de barras o QR ${codigoNuevo}` : undefined}
        ancho="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => dispatchLector({ type: "patch", patch: { codigoNuevo: null } })}
            >
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
              No encontramos un producto con ese codigo de barras o QR.
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
