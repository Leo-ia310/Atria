"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Upload,
  XCircle,
  TriangleAlert,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { importarProductosInventario } from "@/lib/actions/productos";
import { supervisarImportacionIA } from "@/lib/actions/inventario-ia";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

type Campo =
  | "sku"
  | "codigoBarras"
  | "nombre"
  | "descripcion"
  | "precioBase"
  | "costoPromedio"
  | "stockMinimo"
  | "stockMaximo"
  | "existenciaInicial";

type AdvertenciaFila = {
  campo: string;
  mensaje: string;
  valorOriginal?: string;
};

type PreviewFila = {
  fila: number;
  estado: "ok" | "advertencia" | "error";
  sku: string;
  codigoBarras: string;
  nombre: string;
  descripcion: string;
  precioBase: number;
  costoPromedio: number;
  stockMinimo: number;
  stockMaximo?: number;
  existenciaInicial: number;
  advertencias: AdvertenciaFila[];
  errores: string[];
  celdas: string[];
  revisadaIA?: boolean;
};

type ResultadoServidor = Awaited<ReturnType<typeof importarProductosInventario>>;

const CAMPOS: Campo[] = [
  "sku",
  "codigoBarras",
  "nombre",
  "descripcion",
  "precioBase",
  "costoPromedio",
  "stockMinimo",
  "stockMaximo",
  "existenciaInicial",
];

const SINONIMOS: Record<Campo, string[]> = {
  codigoBarras: ["codigo barras", "codigobarras", "barra", "barras", "barcode", "ean", "upc"],
  sku: ["sku", "codigo", "cod", "codigo producto", "cod producto", "referencia", "clave", "item", "articulo"],
  nombre: ["nombre", "producto", "nombre producto", "descripcion", "descripcion producto", "articulo", "detalle", "concepto"],
  descripcion: ["descripcion larga", "observacion", "observaciones", "notas", "detalle largo"],
  precioBase: ["precio", "precio venta", "precio unitario", "pvp", "venta", "retail", "valor venta"],
  costoPromedio: ["costo", "coste", "precio compra", "costo unitario", "compra", "valor compra"],
  stockMinimo: ["stock minimo", "minimo", "min", "existencia minima", "cantidad minima"],
  stockMaximo: ["stock maximo", "maximo", "max", "existencia maxima", "cantidad maxima"],
  existenciaInicial: ["existencia", "stock", "cantidad", "inventario", "unidades", "disponible", "qty"],
};

export function InventarioImportador({ pais }: { pais: PaisCodigo }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [preview, setPreview] = useState<PreviewFila[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoServidor | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [revisandoIA, iniciarRevisionIA] = useTransition();
  const [notasIA, setNotasIA] = useState<{ fila: number; nota: string }[]>([]);
  const router = useRouter();
  const { mostrar } = useToast();

  const listas = {
    ok: preview.filter((f) => f.estado === "ok").length,
    advertencias: preview.filter((f) => f.estado === "advertencia").length,
    errores: preview.filter((f) => f.estado === "error").length,
  };
  const validas = preview.filter((f) => f.estado !== "error");
  const problematicas = preview.filter((f) => f.estado !== "ok" && !f.revisadaIA);

  function revisarConIA() {
    if (problematicas.length === 0) return;
    iniciarRevisionIA(async () => {
      const payload = {
        filas: problematicas.slice(0, 40).map((f) => ({
          fila: f.fila,
          celdas: f.celdas,
          interpretacion: {
            sku: f.sku,
            codigoBarras: f.codigoBarras,
            nombre: f.nombre,
            descripcion: f.descripcion,
            precioBase: f.precioBase,
            costoPromedio: f.costoPromedio,
            stockMinimo: f.stockMinimo,
            stockMaximo: f.stockMaximo,
            existenciaInicial: f.existenciaInicial,
          },
          problemas: [...f.errores, ...f.advertencias.map((a) => a.mensaje)],
        })),
      };
      const res = await supervisarImportacionIA(payload);
      if (!res.ok) {
        mostrar(res.tipo === "warning" ? "info" : "error", res.error);
        return;
      }
      const correcciones = new Map(res.filas.map((f) => [f.fila, f]));
      setPreview((prev) =>
        prev.map((fila) => {
          const c = correcciones.get(fila.fila);
          if (!c) return fila;
          let sku = c.sku.trim();
          const nombre = c.nombre.trim();
          if (!sku && nombre) sku = `IMP-${Date.now()}-${fila.fila}`;
          const nuevoEstado: PreviewFila["estado"] =
            !sku && !nombre ? "error" : "advertencia";
          return {
            ...fila,
            sku,
            nombre,
            codigoBarras: c.codigoBarras.trim(),
            descripcion: c.descripcion.trim(),
            precioBase: c.precioBase,
            costoPromedio: c.costoPromedio,
            stockMinimo: c.stockMinimo,
            stockMaximo: c.stockMaximo,
            existenciaInicial: c.existenciaInicial,
            estado: nuevoEstado,
            errores: nuevoEstado === "error" ? ["La IA no pudo identificar el producto."] : [],
            advertencias: c.nota
              ? [{ campo: "ia", mensaje: c.nota }]
              : fila.advertencias,
            revisadaIA: true,
          };
        }),
      );
      setNotasIA(res.filas.map((f) => ({ fila: f.fila, nota: f.nota })).filter((n) => n.nota));
      mostrar("success", `La IA reviso ${res.filas.length} fila(s).`);
    });
  }

  async function seleccionar(file: File | undefined) {
    if (!file) return;
    setResultado(null);
    setNotasIA([]);
    setCargando(true);
    setNombreArchivo(file.name);
    try {
      const matriz = await leerArchivo(file);
      const filas = construirPreview(matriz);
      setPreview(filas);
      setAbierto(true);
      if (filas.length === 0) {
        mostrar("error", "No encontramos filas con datos.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No pudimos leer el archivo.";
      mostrar("error", msg);
    } finally {
      setCargando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function confirmar() {
    if (validas.length === 0) {
      mostrar("error", "No hay filas validas para cargar.");
      return;
    }
    startTransition(async () => {
      const res = await importarProductosInventario({
        filas: validas.map(({ errores, estado, ...fila }) => fila),
      });
      setResultado(res);
      if (!res.ok) {
        mostrar("error", res.error);
        return;
      }
      mostrar("success", "Inventario importado");
      router.refresh();
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv,.tsv"
        className="hidden"
        onChange={(e) => seleccionar(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={cargando}
        className="arca-btn arca-btn-secondary arca-btn-sm"
      >
        <FileSpreadsheet size={14} /> {cargando ? "Leyendo..." : "Importar Excel"}
      </button>

      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Confirmar importacion"
        descripcion={nombreArchivo}
        ancho="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)} disabled={pendiente || revisandoIA}>
              Cerrar
            </Button>
            {problematicas.length > 0 && (
              <Button
                variant="secondary"
                onClick={revisarConIA}
                loading={revisandoIA}
                disabled={pendiente}
              >
                <Sparkles size={14} /> Revisar {problematicas.length} con IA
              </Button>
            )}
            <Button
              onClick={confirmar}
              loading={pendiente}
              disabled={validas.length === 0 || revisandoIA}
            >
              <Upload size={14} /> Cargar {validas.length}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Resumen icon={CheckCircle2} label="Listas" value={listas.ok} />
            <Resumen icon={TriangleAlert} label="Advertencias" value={listas.advertencias} />
            <Resumen icon={XCircle} label="Errores criticos" value={listas.errores} />
          </div>

          {resultado?.ok && (
            <div className="rounded-md border border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/10 p-3 text-small">
              <div className="font-medium">Carga completada</div>
              <div className="text-[color:var(--color-text-muted)]">
                {resultado.creados} creados, {resultado.actualizados} actualizados, {resultado.stockAjustado} existencias ajustadas, {resultado.advertencias} advertencias guardadas.
              </div>
              {resultado.mensajes.map((m) => (
                <div key={m} className="mt-1 text-[color:var(--color-warning)]">
                  {m}
                </div>
              ))}
            </div>
          )}

          {problematicas.length > 0 && notasIA.length === 0 && (
            <div className="flex items-start gap-2 rounded-md border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary)]/10 p-3 text-small">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-[color:var(--color-primary)]" />
              <span className="text-[color:var(--color-text-secondary)]">
                Hay {problematicas.length} fila(s) con dudas. Deja que la IA las revise e interprete antes de cargar.
              </span>
            </div>
          )}

          {notasIA.length > 0 && (
            <div className="rounded-md border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary)]/10 p-3 text-small">
              <div className="flex items-center gap-2 font-medium text-[color:var(--color-text-primary)]">
                <Sparkles size={15} className="text-[color:var(--color-primary)]" /> Lo que corrigio la IA
              </div>
              <ul className="mt-2 space-y-1 text-[color:var(--color-text-secondary)]">
                {notasIA.map((n) => (
                  <li key={n.fila}>
                    <span className="font-mono text-[12px] text-[color:var(--color-text-muted)]">Fila {n.fila}:</span>{" "}
                    {n.nota}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-[color:var(--color-text-muted)]">
                Revisa los valores en la tabla y ajusta lo que haga falta antes de cargar.
              </p>
            </div>
          )}

          <div className="max-h-[48vh] overflow-auto rounded-md border border-[color:var(--color-border)]">
            <table className="w-full text-small">
              <thead className="sticky top-0 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                <tr>
                  <th className="text-label px-3 py-2 text-left">Fila</th>
                  <th className="text-label px-3 py-2 text-left">Estado</th>
                  <th className="text-label px-3 py-2 text-left">SKU</th>
                  <th className="text-label px-3 py-2 text-left">Producto</th>
                  <th className="text-label px-3 py-2 text-right">Precio</th>
                  <th className="text-label px-3 py-2 text-right">Stock</th>
                  <th className="text-label px-3 py-2 text-left">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((f) => (
                  <tr key={f.fila} className="border-b border-[color:var(--color-border)] last:border-b-0">
                    <td className="px-3 py-2">{f.fila}</td>
                    <td className="px-3 py-2">
                      {f.estado === "error" ? (
                        <span className="arca-badge arca-badge-error">Error</span>
                      ) : f.estado === "advertencia" ? (
                        <span className="arca-badge arca-badge-warning">Advertencia</span>
                      ) : (
                        <span className="arca-badge arca-badge-success">Lista</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[12px]">{f.sku || "-"}</td>
                    <td className="px-3 py-2">{f.nombre || "-"}</td>
                    <td className="px-3 py-2 text-right">{formatearMoneda(f.precioBase, pais)}</td>
                    <td className="px-3 py-2 text-right">{f.existenciaInicial}</td>
                    <td className="px-3 py-2">
                      {[...f.errores, ...f.advertencias.map((a) => a.mensaje)].join(" | ") || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Resumen({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-[color:var(--color-border)] p-3">
      <div className="flex items-center gap-2 text-[color:var(--color-text-muted)]">
        <Icon size={15} />
        <span className="text-label">{label}</span>
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

async function leerArchivo(file: File): Promise<unknown[][]> {
  const nombre = file.name.toLowerCase();
  if (nombre.endsWith(".csv") || nombre.endsWith(".tsv")) {
    const texto = await file.text();
    return parseDelimitado(texto, nombre.endsWith(".tsv") ? "\t" : ",");
  }
  if (nombre.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as unknown[][];
  }
  throw new Error("Formato no soportado. Usa .xlsx, .csv o .tsv.");
}

function construirPreview(matriz: unknown[][]): PreviewFila[] {
  const limpias = matriz.filter((row) => row.some((cell) => texto(cell) !== ""));
  if (limpias.length === 0) return [];
  const cabecera = detectarCabecera(limpias);
  const mapping =
    cabecera.index >= 0
      ? mapearPorCabecera(limpias[cabecera.index])
      : inferirColumnas(limpias);
  const inicio = cabecera.index >= 0 ? cabecera.index + 1 : 0;
  const filas = limpias.slice(inicio);
  const vistos = new Set<string>();

  return filas.flatMap((row, i) => {
    const filaExcel = inicio + i + 1;
    const parsed = filaPreview(row, filaExcel, mapping);
    if (!parsed) return [];
    if (parsed.sku) {
      const key = parsed.sku.toLowerCase();
      if (vistos.has(key)) {
        parsed.estado = "error";
        parsed.errores.push("SKU duplicado dentro del archivo.");
      }
      vistos.add(key);
    }
    return [parsed];
  });
}

function detectarCabecera(rows: unknown[][]): { index: number; score: number } {
  let best = { index: -1, score: 0 };
  rows.slice(0, 10).forEach((row, index) => {
    const score = row.reduce<number>(
      (acc, cell) => acc + (campoPorHeader(texto(cell)) ? 1 : 0),
      0,
    );
    if (score > best.score) best = { index, score };
  });
  return best.score >= 2 ? best : { index: -1, score: 0 };
}

function mapearPorCabecera(row: unknown[]): Partial<Record<Campo, number>> {
  const mapping: Partial<Record<Campo, number>> = {};
  row.forEach((cell, index) => {
    const campo = campoPorHeader(texto(cell));
    if (campo && mapping[campo] === undefined) mapping[campo] = index;
  });
  return mapping;
}

function inferirColumnas(rows: unknown[][]): Partial<Record<Campo, number>> {
  const ancho = Math.max(...rows.map((r) => r.length));
  const stats = Array.from({ length: ancho }, (_, index) => {
    const valores = rows.map((r) => r[index]).filter((v) => texto(v) !== "");
    const textos = valores.filter((v) => parseNumero(v) === null).map((v) => texto(v));
    const numeros = valores.map(parseNumero).filter((n): n is number => n !== null);
    return {
      index,
      valores,
      textos,
      numeros,
      avgTexto: textos.reduce((a, t) => a + t.length, 0) / Math.max(textos.length, 1),
      avgNumero: numeros.reduce((a, n) => a + n, 0) / Math.max(numeros.length, 1),
      enteros: numeros.filter((n) => Number.isInteger(n)).length / Math.max(numeros.length, 1),
    };
  });
  const mapping: Partial<Record<Campo, number>> = {};
  const textCols = stats.filter((s) => s.textos.length > 0);
  const name = [...textCols].sort((a, b) => b.avgTexto - a.avgTexto)[0];
  if (name) mapping.nombre = name.index;
  const sku = textCols
    .filter((s) => s.index !== mapping.nombre)
    .sort((a, b) => a.avgTexto - b.avgTexto)[0];
  if (sku) mapping.sku = sku.index;

  const numeric = stats.filter((s) => s.numeros.length > 0);
  const stock = numeric
    .filter((s) => s.enteros > 0.75)
    .sort((a, b) => a.avgNumero - b.avgNumero)[0];
  if (stock) mapping.existenciaInicial = stock.index;
  const money = numeric
    .filter((s) => s.index !== mapping.existenciaInicial)
    .sort((a, b) => b.avgNumero - a.avgNumero);
  if (money[0]) mapping.precioBase = money[0].index;
  if (money[1]) mapping.costoPromedio = money[1].index;
  return mapping;
}

function filaPreview(
  row: unknown[],
  fila: number,
  mapping: Partial<Record<Campo, number>>,
): PreviewFila | null {
  const originalNoVacio = row.filter((cell) => texto(cell) !== "");
  if (originalNoVacio.length === 0) return null;
  const raw = Object.fromEntries(
    CAMPOS.map((campo) => [campo, mapping[campo] !== undefined ? row[mapping[campo]!] : ""]),
  ) as Record<Campo, unknown>;
  const advertencias: AdvertenciaFila[] = [];
  const errores: string[] = [];
  const precio = parseNumero(raw.precioBase);
  const costo = parseNumero(raw.costoPromedio);
  const stockMinimo = parseNumero(raw.stockMinimo);
  const stockMaximo = parseNumero(raw.stockMaximo);
  const existencia = parseNumero(raw.existenciaInicial);
  const soloPrecio = originalNoVacio.length === 1 && precio !== null;

  let sku = texto(raw.sku) || texto(raw.codigoBarras);
  let nombre = texto(raw.nombre);

  if (!sku && !nombre) {
    errores.push(
      soloPrecio
        ? "La fila solo tiene precio; falta producto o codigo."
        : "No se pudo identificar producto ni codigo.",
    );
  }
  if (!sku && nombre) {
    sku = `IMP-${Date.now()}-${fila}`;
    advertencias.push({
      campo: "sku",
      mensaje: "SKU generado porque la fila no tenia codigo.",
    });
  }
  if (!nombre && sku) {
    nombre = `Producto sin nombre - fila ${fila}`;
    advertencias.push({
      campo: "nombre",
      mensaje: "Nombre generado porque la fila no tenia nombre de producto.",
      valorOriginal: sku,
    });
  }
  if (precio === null) {
    advertencias.push({
      campo: "precio",
      mensaje: "Precio faltante o no numerico; se cargo en 0.",
      valorOriginal: texto(raw.precioBase) || undefined,
    });
  }

  return {
    fila,
    estado: errores.length > 0 ? "error" : advertencias.length > 0 ? "advertencia" : "ok",
    sku,
    codigoBarras: texto(raw.codigoBarras),
    nombre,
    descripcion: texto(raw.descripcion),
    precioBase: precio ?? 0,
    costoPromedio: costo ?? 0,
    stockMinimo: stockMinimo ?? 0,
    stockMaximo: stockMaximo ?? undefined,
    existenciaInicial: existencia ?? 0,
    advertencias,
    errores,
    celdas: row.map(texto),
  };
}

function campoPorHeader(value: string): Campo | null {
  const normal = normalizar(value);
  for (const campo of CAMPOS) {
    if (SINONIMOS[campo].some((s) => normal === normalizar(s) || normal.includes(normalizar(s)))) {
      return campo;
    }
  }
  return null;
}

function texto(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizar(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseNumero(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = texto(value);
  if (!raw) return null;
  let clean = raw.replace(/[^0-9,.-]/g, "");
  if (!clean || clean === "-" || clean === "." || clean === ",") return null;
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    const decimal = lastComma > lastDot ? "," : ".";
    clean = clean
      .replace(new RegExp(`\\${decimal === "," ? "." : ","}`, "g"), "")
      .replace(decimal, ".");
  } else if (lastComma > -1) {
    clean = clean.replace(",", ".");
  }
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function parseDelimitado(text: string, delimiter: "," | "\t"): unknown[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}
