import "server-only";
import ExcelJS from "exceljs";
import { getPaisConfig, type PaisCodigo } from "@/lib/paises";
import { desdeDecimal } from "@/lib/utils";

/**
 * Motor de exportación a Excel de ARCA. Un solo punto de estilo para que todos
 * los reportes salgan con el mismo formato formal: encabezado con datos de la
 * empresa, tabla con estilos, formatos numéricos nativos (Excel puede sumar y
 * filtrar) y fila de totales. Todo se genera en el servidor.
 */

export type TipoColumna =
  | "texto"
  | "numero"
  | "entero"
  | "moneda"
  | "fecha"
  | "fechaHora"
  | "porcentaje";

export type ColumnaExcel = {
  header: string;
  key: string;
  tipo?: TipoColumna;
  width?: number;
  /** Suma esta columna en la fila de totales. */
  total?: boolean;
  align?: "left" | "center" | "right";
};

export type EmpresaExcel = {
  razonSocial?: string | null;
  nombreComercial?: string | null;
  identificacionFiscal?: string | null;
  pais: PaisCodigo;
};

export type OpcionesLibro = {
  empresa: EmpresaExcel;
  titulo: string;
  subtitulo?: string;
  columnas: ColumnaExcel[];
  filas: Record<string, unknown>[];
  zonaHoraria?: string | null;
};

// Paleta de marca (globals.css) en formato ARGB para exceljs.
const MARCA = "FF2B1F3A";
const MARCA_TEXTO = "FFFFFFFF";
const CEBRA = "FFF6F5FA";
const TOTALES_BG = "FFEDEAF5";
const BORDE = "FFE2DFF0";
const TEXTO_TENUE = "FF8B7FA8";

const ANCHO_DEFAULT: Record<TipoColumna, number> = {
  texto: 24,
  numero: 16,
  entero: 12,
  moneda: 18,
  fecha: 14,
  fechaHora: 20,
  porcentaje: 12,
};

function anchoColumna(col: ColumnaExcel): number {
  if (col.width) return col.width;
  return ANCHO_DEFAULT[col.tipo ?? "texto"];
}

function alineacion(col: ColumnaExcel): "left" | "center" | "right" {
  if (col.align) return col.align;
  const tipo = col.tipo ?? "texto";
  if (tipo === "moneda" || tipo === "numero" || tipo === "entero" || tipo === "porcentaje") {
    return "right";
  }
  if (tipo === "fecha" || tipo === "fechaHora") return "center";
  return "left";
}

/** Escapa el símbolo de moneda para un formato numérico de Excel. */
function formatoMoneda(pais: PaisCodigo): string {
  const simbolo = getPaisConfig(pais).simbolo;
  return `"${simbolo}"#,##0.00;[Red]-"${simbolo}"#,##0.00`;
}

const FORMATO: Partial<Record<TipoColumna, string>> = {
  numero: "#,##0.00",
  entero: "#,##0",
  fecha: "dd/mm/yyyy",
  fechaHora: "dd/mm/yyyy hh:mm",
  porcentaje: "0.0%",
};

/**
 * Convierte una fecha/hora al "reloj de pared" de la zona horaria de la empresa,
 * devolviendo un Date cuyos campos UTC coinciden con la hora local. exceljs
 * escribe el serial en UTC, así que esto hace que Excel muestre la hora correcta.
 */
function aFechaExcel(
  valor: unknown,
  zona: string | null | undefined,
  soloFecha: boolean,
): Date | null {
  if (valor == null || valor === "") return null;

  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [y, m, d] = valor.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  const d = valor instanceof Date ? valor : new Date(String(valor));
  if (Number.isNaN(d.getTime())) return null;

  if (!zona) {
    return soloFecha
      ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
      : d;
  }

  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const p: Record<string, number> = {};
    for (const part of fmt.formatToParts(d)) {
      if (part.type !== "literal") p[part.type] = Number(part.value);
    }
    if (soloFecha) return new Date(Date.UTC(p.year, p.month - 1, p.day));
    return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second));
  } catch {
    return d;
  }
}

function nombreHoja(titulo: string): string {
  return titulo.replace(/[[\]*?/\\:]/g, " ").slice(0, 31) || "Reporte";
}

export async function construirLibro(opts: OpcionesLibro): Promise<Buffer> {
  const { empresa, titulo, subtitulo, columnas, filas, zonaHoraria } = opts;
  const pais = empresa.pais;
  const ncol = columnas.length;

  const wb = new ExcelJS.Workbook();
  wb.creator = "ARCA";
  wb.created = new Date();
  const ws = wb.addWorksheet(nombreHoja(titulo), {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });

  const borde = {
    top: { style: "thin" as const, color: { argb: BORDE } },
    left: { style: "thin" as const, color: { argb: BORDE } },
    bottom: { style: "thin" as const, color: { argb: BORDE } },
    right: { style: "thin" as const, color: { argb: BORDE } },
  };

  columnas.forEach((col, i) => {
    ws.getColumn(i + 1).width = anchoColumna(col);
  });

  let r = 1;

  // Nombre de la empresa
  const nombre = empresa.razonSocial || empresa.nombreComercial || "ARCA";
  ws.mergeCells(r, 1, r, ncol);
  const celdaNombre = ws.getCell(r, 1);
  celdaNombre.value = nombre;
  celdaNombre.font = { name: "Calibri", size: 16, bold: true, color: { argb: MARCA } };
  celdaNombre.alignment = { vertical: "middle" };
  ws.getRow(r).height = 24;
  r++;

  // Identificación fiscal + país
  const cfg = getPaisConfig(pais);
  const idParts: string[] = [];
  if (empresa.identificacionFiscal) {
    idParts.push(`${cfg.idFiscalNombre}: ${empresa.identificacionFiscal}`);
  }
  idParts.push(cfg.nombre);
  ws.mergeCells(r, 1, r, ncol);
  const celdaId = ws.getCell(r, 1);
  celdaId.value = idParts.join("  ·  ");
  celdaId.font = { size: 10, color: { argb: TEXTO_TENUE } };
  r++;

  r++; // espaciador

  // Título del reporte
  ws.mergeCells(r, 1, r, ncol);
  const celdaTitulo = ws.getCell(r, 1);
  celdaTitulo.value = titulo;
  celdaTitulo.font = { size: 13, bold: true, color: { argb: MARCA } };
  ws.getRow(r).height = 20;
  r++;

  // Subtítulo / filtros
  if (subtitulo) {
    ws.mergeCells(r, 1, r, ncol);
    const celdaSub = ws.getCell(r, 1);
    celdaSub.value = subtitulo;
    celdaSub.font = { size: 10, italic: true, color: { argb: TEXTO_TENUE } };
    r++;
  }

  // Marca de generación
  ws.mergeCells(r, 1, r, ncol);
  const celdaGen = ws.getCell(r, 1);
  const ahora = aFechaExcel(new Date(), zonaHoraria, false) ?? new Date();
  const gg = String(ahora.getUTCDate()).padStart(2, "0");
  const mmm = String(ahora.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = ahora.getUTCFullYear();
  const hh = String(ahora.getUTCHours()).padStart(2, "0");
  const mi = String(ahora.getUTCMinutes()).padStart(2, "0");
  celdaGen.value = `Generado el ${gg}/${mmm}/${yyyy} a las ${hh}:${mi}`;
  celdaGen.font = { size: 9, color: { argb: TEXTO_TENUE } };
  r++;

  r++; // espaciador antes de la tabla

  // Encabezado de la tabla
  const filaHeader = r;
  const header = ws.getRow(filaHeader);
  header.height = 22;
  columnas.forEach((col, i) => {
    const celda = header.getCell(i + 1);
    celda.value = col.header;
    celda.font = { bold: true, color: { argb: MARCA_TEXTO }, size: 11 };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MARCA } };
    celda.alignment = { vertical: "middle", horizontal: alineacion(col), wrapText: true };
    celda.border = borde;
  });
  r++;

  // Filas de datos
  const monedaFmt = formatoMoneda(pais);
  const primeraFila = r;
  filas.forEach((fila, idx) => {
    const filaExcel = ws.getRow(r);
    const cebra = idx % 2 === 1;
    columnas.forEach((col, i) => {
      const celda = filaExcel.getCell(i + 1);
      const tipo = col.tipo ?? "texto";
      const bruto = fila[col.key];

      if (tipo === "moneda" || tipo === "numero" || tipo === "porcentaje") {
        celda.value = bruto == null || bruto === "" ? null : desdeDecimal(bruto as string | number);
        celda.numFmt = tipo === "moneda" ? monedaFmt : FORMATO[tipo]!;
      } else if (tipo === "entero") {
        celda.value = bruto == null || bruto === "" ? null : Math.round(desdeDecimal(bruto as string | number));
        celda.numFmt = FORMATO.entero!;
      } else if (tipo === "fecha" || tipo === "fechaHora") {
        const d = aFechaExcel(bruto, zonaHoraria, tipo === "fecha");
        celda.value = d;
        if (d) celda.numFmt = FORMATO[tipo]!;
      } else {
        celda.value = bruto == null ? "" : String(bruto);
      }

      celda.alignment = { vertical: "middle", horizontal: alineacion(col) };
      celda.border = borde;
      if (cebra) {
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CEBRA } };
      }
    });
    r++;
  });

  // Fila de totales
  const hayTotales = columnas.some((c) => c.total);
  if (hayTotales && filas.length > 0) {
    const filaTot = ws.getRow(r);
    filaTot.height = 20;
    columnas.forEach((col, i) => {
      const celda = filaTot.getCell(i + 1);
      celda.font = { bold: true, color: { argb: MARCA } };
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTALES_BG } };
      celda.border = { ...borde, top: { style: "medium", color: { argb: MARCA } } };
      celda.alignment = { vertical: "middle", horizontal: alineacion(col) };

      if (i === 0) {
        celda.value = "TOTALES";
        return;
      }
      if (col.total) {
        const suma = filas.reduce(
          (acc, f) => acc + desdeDecimal(f[col.key] as string | number),
          0,
        );
        celda.value = suma;
        celda.numFmt = (col.tipo ?? "numero") === "moneda" ? monedaFmt : FORMATO.numero!;
      }
    });
    r++;
  }

  // Congelar encabezado + autofiltro
  ws.views = [{ state: "frozen", ySplit: filaHeader, showGridLines: false }];
  ws.autoFilter = {
    from: { row: filaHeader, column: 1 },
    to: { row: filaHeader, column: ncol },
  };

  if (filas.length === 0) {
    ws.mergeCells(primeraFila, 1, primeraFila, ncol);
    const vacio = ws.getCell(primeraFila, 1);
    vacio.value = "Sin datos para exportar en este rango.";
    vacio.font = { italic: true, color: { argb: TEXTO_TENUE } };
    vacio.alignment = { horizontal: "center", vertical: "middle" };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
