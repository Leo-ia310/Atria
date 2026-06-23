/**
 * Helpers genéricos compartidos.
 */

import { getPaisConfig, type PaisCodigo } from "./paises";

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatearMoneda(
  monto: number | string,
  pais: PaisCodigo = "NI",
): string {
  const cfg = getPaisConfig(pais);
  const num = typeof monto === "string" ? parseFloat(monto) : monto;
  if (Number.isNaN(num)) return `${cfg.simbolo}0.00`;
  return `${cfg.simbolo}${num.toLocaleString("es", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatearFecha(fecha: Date | string, _pais: PaisCodigo = "NI"): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatearFechaHora(fecha: Date | string, _pais: PaisCodigo = "NI"): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return "—";
  const fechaStr = formatearFecha(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${fechaStr} ${hh}:${mi}`;
}

export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generarNumero(prefijo: string, secuencia: number, ancho = 6): string {
  return `${prefijo}-${String(secuencia).padStart(ancho, "0")}`;
}

export function aDecimal(valor: number | string): string {
  const num = typeof valor === "string" ? parseFloat(valor) : valor;
  if (Number.isNaN(num)) return "0";
  return num.toFixed(4);
}

export function desdeDecimal(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined) return 0;
  const num = typeof valor === "string" ? parseFloat(valor) : valor;
  return Number.isNaN(num) ? 0 : num;
}
