"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mic,
  MicOff,
  PackagePlus,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  interpretarProductoTexto,
  crearProductosDesdeAsistente,
} from "@/lib/actions/inventario-ia";
import type { PropuestaProducto } from "@/lib/validations/inventario-ia";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

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

type DictadoResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type DictadoEvent = {
  results: ArrayLike<DictadoResult>;
};

type DictadoRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: DictadoEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type DictadoWindow = Window & {
  SpeechRecognition?: new () => DictadoRecognition;
  webkitSpeechRecognition?: new () => DictadoRecognition;
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

function reconocimientoDictado(): (new () => DictadoRecognition) | null {
  if (typeof window === "undefined") return null;
  const win = window as DictadoWindow;
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

function etiquetaProductos(cantidad: number): string {
  return cantidad === 1 ? "producto" : "productos";
}

export function AsistenteProductoIA() {
  const router = useRouter();
  const { mostrar } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<"describir" | "confirmar">("describir");
  const [texto, setTexto] = useState("");
  const [nota, setNota] = useState("");
  const [preguntas, setPreguntas] = useState<string[]>([]);
  const [productos, setProductos] = useState<Campos[]>([]);
  const [grabando, setGrabando] = useState(false);
  const [dictadoSoportado, setDictadoSoportado] = useState(true);
  const [pensando, iniciarPensar] = useTransition();
  const [creando, iniciarCrear] = useTransition();
  const reconocimientoRef = useRef<DictadoRecognition | null>(null);
  const dictadoBaseRef = useRef("");

  useEffect(() => {
    setDictadoSoportado(Boolean(reconocimientoDictado()));
    return () => reconocimientoRef.current?.abort();
  }, []);

  function detenerDictado() {
    reconocimientoRef.current?.stop();
    reconocimientoRef.current = null;
    setGrabando(false);
  }

  function iniciarDictado() {
    const Recognition = reconocimientoDictado();
    if (!Recognition) {
      setDictadoSoportado(false);
      mostrar("warning", "Este navegador no permite dictado por micrófono.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "es-419";
    recognition.continuous = true;
    recognition.interimResults = true;
    dictadoBaseRef.current = texto.trim();

    recognition.onresult = (event) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const fragmento = result[0]?.transcript ?? "";
        if (result.isFinal) final += ` ${fragmento}`;
        else interim += ` ${fragmento}`;
      }
      const hablado = `${final} ${interim}`.replace(/\s+/g, " ").trim();
      setTexto([dictadoBaseRef.current, hablado].filter(Boolean).join("\n"));
    };

    recognition.onerror = () => {
      setGrabando(false);
      mostrar("error", "No pudimos tomar el audio. Revisa el permiso del micrófono.");
    };
    recognition.onend = () => setGrabando(false);

    try {
      recognition.start();
      reconocimientoRef.current = recognition;
      setGrabando(true);
    } catch {
      setGrabando(false);
      mostrar("error", "No pudimos iniciar la grabación.");
    }
  }

  function cerrar() {
    if (pensando || creando) return;
    detenerDictado();
    setAbierto(false);
    setPaso("describir");
    setTexto("");
    setNota("");
    setPreguntas([]);
    setProductos([]);
  }

  function interpretar() {
    if (texto.trim().length < 3) {
      mostrar("error", "Describe el producto o productos que quieres crear.");
      return;
    }

    detenerDictado();
    iniciarPensar(async () => {
      const res = await interpretarProductoTexto({ texto });
      if (!res.ok) {
        mostrar(res.tipo === "warning" ? "info" : "error", res.error);
        return;
      }

      const detectados = res.productos.map(desdePropuesta);
      setProductos(detectados);
      setPreguntas(res.preguntas);
      setNota(res.nota);

      if (detectados.length === 0) {
        mostrar("info", "La IA necesita más datos para identificar productos.");
        return;
      }

      if (res.preguntas.length > 0) {
        mostrar("info", "La IA necesita algunos datos antes de guardar.");
        return;
      }

      setPaso("confirmar");
    });
  }

  function crear() {
    const validos = productos.filter((producto) => producto.nombre.trim().length >= 2);
    if (validos.length === 0) {
      mostrar("error", "Agrega al menos un producto con nombre.");
      return;
    }

    iniciarCrear(async () => {
      const res = await crearProductosDesdeAsistente({
        productos: validos.map((producto) => ({
          nombre: producto.nombre,
          sku: producto.sku,
          codigoBarras: producto.codigoBarras,
          descripcion: producto.descripcion,
          precioBase: producto.precioBase || 0,
          costoPromedio: producto.costoPromedio || 0,
          stockMinimo: producto.stockMinimo || 0,
          existenciaInicial: producto.existenciaInicial || 0,
        })),
      });
      if (!res.ok) {
        mostrar("error", res.error);
        return;
      }

      mostrar(
        "success",
        res.creados === 1
          ? `${res.productos[0]?.nombre ?? "Producto"} creado`
          : `${res.creados} productos creados`,
      );
      cerrar();
      router.refresh();
    });
  }

  const setCampo = (index: number, campo: keyof Campos) => (valor: string) =>
    setProductos((prev) =>
      prev.map((producto, i) =>
        i === index ? { ...producto, [campo]: valor } : producto,
      ),
    );

  function eliminarProducto(index: number) {
    setProductos((prev) => prev.filter((_, i) => i !== index));
  }

  function agregarProducto() {
    setProductos((prev) => [...prev, { ...CAMPOS_VACIOS }]);
  }

  const puedeConfirmarConPreguntas = productos.length > 0 && preguntas.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Crear productos describiéndolos con IA"
        className="arca-btn arca-btn-secondary arca-btn-sm"
      >
        <Sparkles size={14} className="text-[color:var(--color-primary)]" /> IA
      </button>

      <Modal
        abierto={abierto}
        onCerrar={cerrar}
        titulo={paso === "describir" ? "Crear productos con IA" : "Confirmar productos"}
        descripcion={
          paso === "describir"
            ? "Describe o dicta uno o varios productos. La IA pregunta si falta información."
            : "Revisa y ajusta lo que preparó la IA antes de guardar."
        }
        ancho="xl"
        footer={
          paso === "describir" ? (
            <>
              <Button variant="ghost" onClick={cerrar} disabled={pensando}>
                Cancelar
              </Button>
              {puedeConfirmarConPreguntas && (
                <Button
                  variant="secondary"
                  onClick={() => setPaso("confirmar")}
                  disabled={pensando}
                >
                  Continuar con {productos.length} {etiquetaProductos(productos.length)}
                </Button>
              )}
              <Button onClick={interpretar} loading={pensando}>
                <Wand2 size={14} /> {preguntas.length > 0 ? "Enviar datos" : "Interpretar"}
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
              <Button variant="secondary" onClick={agregarProducto} disabled={creando}>
                <Plus size={14} /> Agregar producto
              </Button>
              <Button onClick={crear} loading={creando}>
                <PackagePlus size={14} /> Crear {productos.length}{" "}
                {etiquetaProductos(productos.length)}
              </Button>
            </>
          )
        }
      >
        {paso === "describir" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={grabando ? "danger" : "secondary"}
                size="sm"
                onClick={grabando ? detenerDictado : iniciarDictado}
                disabled={pensando || !dictadoSoportado}
              >
                {grabando ? <MicOff size={14} /> : <Mic size={14} />}
                {grabando ? "Detener audio" : "Grabar audio"}
              </Button>
              {grabando && (
                <span className="inline-flex items-center gap-2 text-small text-[color:var(--color-error)]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                  Grabando...
                </span>
              )}
              {!dictadoSoportado && (
                <span className="text-[12px] text-[color:var(--color-text-muted)]">
                  Puedes escribir la descripción manualmente.
                </span>
              )}
            </div>

            <label htmlFor="asistente-producto-descripcion" className="sr-only">
              Descripción de productos
            </label>
            <textarea
              id="asistente-producto-descripcion"
              className="arca-input min-h-[150px] resize-y"
              placeholder="Ej: Agrega 12 martillos de acero, precio 250, costo 160, mínimo 5. También 8 cintas métricas a 90, costo 55."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              autoFocus
            />

            {preguntas.length > 0 && (
              <div className="rounded-md border border-[color:var(--color-warning)]/35 bg-[color:var(--color-warning-bg)] p-3 text-small">
                <div className="font-medium text-[color:var(--color-text-primary)]">
                  La IA necesita completar estos datos
                </div>
                <ul className="mt-2 space-y-1 text-[color:var(--color-text-secondary)]">
                  {preguntas.map((pregunta) => (
                    <li key={pregunta}>- {pregunta}</li>
                  ))}
                </ul>
              </div>
            )}

            {productos.length > 0 && (
              <div className="rounded-md border border-[color:var(--color-border)] p-3 text-small">
                <div className="font-medium text-[color:var(--color-text-primary)]">
                  Detectados
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {productos.map((producto, index) => (
                    <span
                      key={`${producto.nombre}:${index}`}
                      className="arca-badge arca-badge-info"
                    >
                      {producto.nombre}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {nota && (
              <div className="flex items-start gap-2 rounded-md border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary)]/10 p-3 text-small">
                <Sparkles size={16} className="mt-0.5 shrink-0 text-[color:var(--color-primary)]" />
                <span className="text-[color:var(--color-text-secondary)]">{nota}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {nota && (
              <div className="flex items-start gap-2 rounded-md border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary)]/10 p-3 text-small">
                <Sparkles size={16} className="mt-0.5 shrink-0 text-[color:var(--color-primary)]" />
                <span className="text-[color:var(--color-text-secondary)]">{nota}</span>
              </div>
            )}

            {productos.map((producto, index) => (
              <section
                key={`${producto.nombre}:${index}`}
                className="rounded-md border border-[color:var(--color-border)]"
              >
                <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border)] px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-[color:var(--color-text-primary)]">
                      Producto {index + 1}
                    </h3>
                    <p className="text-[12px] text-[color:var(--color-text-muted)]">
                      {producto.nombre || "Sin nombre todavía"}
                    </p>
                  </div>
                  {productos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarProducto(index)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-error)]"
                      aria-label="Quitar producto"
                      title="Quitar producto"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <div className="space-y-4 p-4">
                  <Input
                    label="Nombre"
                    value={producto.nombre}
                    onChange={(e) => setCampo(index, "nombre")(e.target.value)}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      label="SKU"
                      value={producto.sku}
                      onChange={(e) => setCampo(index, "sku")(e.target.value)}
                      hint="Vacío = se genera solo"
                    />
                    <Input
                      label="Código de barras"
                      value={producto.codigoBarras}
                      onChange={(e) => setCampo(index, "codigoBarras")(e.target.value)}
                      hint="Opcional"
                    />
                    <Input
                      label="Precio de venta"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={producto.precioBase}
                      onChange={(e) => setCampo(index, "precioBase")(e.target.value)}
                    />
                    <Input
                      label="Costo"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={producto.costoPromedio}
                      onChange={(e) => setCampo(index, "costoPromedio")(e.target.value)}
                    />
                    <Input
                      label="Existencia inicial"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={producto.existenciaInicial}
                      onChange={(e) => setCampo(index, "existenciaInicial")(e.target.value)}
                    />
                    <Input
                      label="Stock mínimo"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={producto.stockMinimo}
                      onChange={(e) => setCampo(index, "stockMinimo")(e.target.value)}
                    />
                  </div>
                  <Input
                    label="Descripción"
                    value={producto.descripcion}
                    onChange={(e) => setCampo(index, "descripcion")(e.target.value)}
                    hint="Opcional"
                  />
                </div>
              </section>
            ))}

            {productos.length === 0 && (
              <button
                type="button"
                onClick={agregarProducto}
                className={cn(
                  "flex min-h-24 w-full items-center justify-center gap-2 rounded-md",
                  "border border-dashed border-[color:var(--color-border-strong)]",
                  "text-small text-[color:var(--color-text-muted)] transition",
                  "hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]",
                )}
              >
                <Plus size={15} /> Agregar producto
              </button>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
