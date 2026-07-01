export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatearMoneda(
  monto: number | string,
  moneda = "USD",
): string {
  const num = typeof monto === "string" ? parseFloat(monto) : monto;
  if (Number.isNaN(num)) return `${simboloMoneda(moneda)}0.00`;
  return `${simboloMoneda(moneda)}${num.toLocaleString("es", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function simboloMoneda(codigo: string): string {
  switch (codigo) {
    case "HNL": return "L ";
    case "NIO": return "C$";
    case "GTQ": return "Q ";
    case "CRC": return "₡";
    case "USD": return "$";
    default: return `${codigo} `;
  }
}

export function formatearFecha(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatearFechaHora(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatearFecha(d)} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "??";
}
