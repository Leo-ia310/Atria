"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Wand2, PackagePlus, ArrowLeft } from "lucide-react";
import {
  interpretarProductoTexto,
  crearProductoDesdeAsistente,
} from "@/lib/actions/inventario-ia";
import type { PropuestaProducto } from "@/lib/validations/inventario-ia";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

type Campos = {
  nombre: string;
  sku: string;
  codigoBarras: string;
  descripcion: string;
  precioBase: string;
  costoPromedio: string;
  stockMinimo: string;
  existenciaInicial: string;
};

const CAMPOS_VACIOS: Campos = {
  nombre: "",
  sku: "",
  codigoBarras: "",
  descripcion: "",
  precioBase: "",
  costoPromedio: "",
  stockMinimo: "",
  existenciaInicial: "",
};

function desdePropuesta(p: PropuestaProducto): Campos {
  return {
    nombre: p.nombre,
    sku: p.sku ?? "",
    codigoBarras: p.codigoBarras ?? "",
    descripcion: p.descripcion ?? "",
    precioBase: String(p.precioBase ?? 0),
    costoPromedio: String(p.costoPromedio ?? 0),
    stockMinimo: String(p.stockMinimo ?? 0),
    existenciaInicial: String(p.existenciaInicial ?? 0),
  };
}

export function AsistenteProductoIA() {
  const router = useRouter();
  const { mostrar } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<"describir" | "confirmar">("describir");
  const [texto, setTexto] = useState("");
  const [nota, setNota] = useState("");
  const [campos, setCampos] = useState<Campos>(CAMPOS_VACIOS);
  const [pensando, iniciarPensar] = useTransition();
  const [creando, iniciarCrear] = useTransition();

  function cerrar() {
    if (pensando || creando) return;
    setAbierto(false);
    setPaso("describir");
    setTexto("");
    setNota("");
    setCampos(CAMPOS_VACIOS);
  }

  function interpretar() {
    if (texto.trim().length < 3) {
      mostrar("error", "Describe el producto que quieres crear.");
      return;
    }
    iniciarPensar(async () => {
      const res = await interpretarProductoTexto({ texto });
      if (!res.ok) {
        mostrar(res.tipo === "warning" ? "info" : "error", res.error);
        return;
      }
      setCampos(desdePropuesta(res.propuesta));
      setNota(res.nota);
      setPaso("confirmar");
    });
  }

  function crear() {
    if (campos.nombre.trim().length < 2) {
      mostrar("error", "El producto necesita un nombre.");
      return;
    }
    iniciarCrear(async () => {
      const res = await crearProductoDesdeAsistente({
        nombre: campos.nombre,
        sku: campos.sku,
        codigoBarras: campos.codigoBarras,
        descripcion: campos.descripcion,
        precioBase: campos.precioBase || 0,
        costoPromedio: campos.costoPromedio || 0,
        stockMinimo: campos.stockMinimo || 0,
        existenciaInicial: campos.existenciaInicial || 0,
      });
      if (!res.ok) {
        mostrar("error", res.error);
        return;
      }
      mostrar(
        "success",
        res.existencia > 0
          ? `${res.nombre} creado con ${res.existencia} en existencia`
          : `${res.nombre} creado`,
      );
      cerrar();
      router.refresh();
    });
  }

  const set = (campo: keyof Campos) => (valor: string) =>
    setCampos((prev) => ({ ...prev, [campo]: valor }));

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Crear producto describiendolo con IA"
        className="arca-btn arca-btn-secondary arca-btn-sm"
      >
        <Sparkles size={14} className="text-[color:var(--color-primary)]" /> IA
      </button>

      <Modal
        abierto={abierto}
        onCerrar={cerrar}
        titulo={paso === "describir" ? "Crear producto con IA" : "Confirmar producto"}
        descripcion={
          paso === "describir"
            ? "Describe el producto en tus palabras y la IA lo arma."
            : "Revisa y ajusta lo que preparo la IA antes de crearlo."
        }
        ancho="lg"
        footer={
          paso === "describir" ? (
            <>
              <Button variant="ghost" onClick={cerrar} disabled={pensando}>
                Cancelar
              </Button>
              <Button onClick={interpretar} loading={pensando}>
                <Wand2 size={14} /> Interpretar
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => setPaso("describir")}
                disabled={creando}
              >
                <ArrowLeft size={14} /> Volver
              </Button>
              <Button onClick={crear} loading={creando}>
                <PackagePlus size={14} /> Crear producto
              </Button>
            </>
          )
        }
      >
        {paso === "describir" ? (
          <div className="space-y-3">
            <textarea
              className="arca-input min-h-[120px] resize-y"
              placeholder="Ej: Agrega martillo de acero, precio 250, costo 160, tengo 20 unidades, avisar cuando queden 5"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              autoFocus
            />
            <p className="text-[12px] text-[color:var(--color-text-muted)]">
              La IA deduce precio, costo, existencia y minimo. Podras revisarlo antes de guardar.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {nota && (
              <div className="flex items-start gap-2 rounded-md border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary)]/10 p-3 text-small">
                <Sparkles size={16} className="mt-0.5 shrink-0 text-[color:var(--color-primary)]" />
                <span className="text-[color:var(--color-text-secondary)]">{nota}</span>
              </div>
            )}
            <Input
              label="Nombre"
              value={campos.nombre}
              onChange={(e) => set("nombre")(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="SKU"
                value={campos.sku}
                onChange={(e) => set("sku")(e.target.value)}
                hint="Vacio = se genera solo"
              />
              <Input
                label="Codigo de barras"
                value={campos.codigoBarras}
                onChange={(e) => set("codigoBarras")(e.target.value)}
                hint="Opcional"
              />
              <Input
                label="Precio de venta"
                type="number"
                min="0"
                step="0.0001"
                value={campos.precioBase}
                onChange={(e) => set("precioBase")(e.target.value)}
              />
              <Input
                label="Costo"
                type="number"
                min="0"
                step="0.0001"
                value={campos.costoPromedio}
                onChange={(e) => set("costoPromedio")(e.target.value)}
              />
              <Input
                label="Existencia inicial"
                type="number"
                min="0"
                step="0.0001"
                value={campos.existenciaInicial}
                onChange={(e) => set("existenciaInicial")(e.target.value)}
              />
              <Input
                label="Stock minimo"
                type="number"
                min="0"
                step="0.0001"
                value={campos.stockMinimo}
                onChange={(e) => set("stockMinimo")(e.target.value)}
              />
            </div>
            <Input
              label="Descripcion"
              value={campos.descripcion}
              onChange={(e) => set("descripcion")(e.target.value)}
              hint="Opcional"
            />
          </div>
        )}
      </Modal>
    </>
  );
}
