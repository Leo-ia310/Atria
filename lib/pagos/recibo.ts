import { randomBytes } from "crypto";

export type ReciboData = {
  numeroRecibo: string;
  fechaISO: string;
  empresaNombre: string;
  planNombre: string;
  ciclo: "mensual" | "semestral" | "anual";
  monto: number;
  moneda: string;
  metodoPago: string;
  pagadorNombre: string | null;
  pagadorEmail: string | null;
  ordenId: string;
  vigenteHastaISO: string;
};

const NumberFormatCtor = Intl.NumberFormat;
const MONTO_FORMATTERS = new Map<string, Intl.NumberFormat>();
const FECHA_LARGA_FORMATTER = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function generarNumeroRecibo(fecha: Date = new Date()): string {
  const y = fecha.getUTCFullYear();
  const m = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const d = String(fecha.getUTCDate()).padStart(2, "0");
  const sufijo = randomBytes(4).toString("hex").toUpperCase();
  return `ARCA-${y}${m}${d}-${sufijo}`;
}

export function formatearMontoUSD(monto: number, moneda = "USD"): string {
  let formatter = MONTO_FORMATTERS.get(moneda);
  if (!formatter) {
    formatter = new NumberFormatCtor("en-US", {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: 2,
    });
    MONTO_FORMATTERS.set(moneda, formatter);
  }
  return formatter.format(monto);
}

export function formatearFechaLarga(iso: string): string {
  const fecha = new Date(iso);
  return FECHA_LARGA_FORMATTER.format(fecha);
}
