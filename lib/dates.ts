export const DEFAULT_TIME_ZONE = "America/Managua";

function timeZoneSeguro(timeZone?: string | null): string {
  const zona = timeZone || DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zona }).format(new Date());
    return zona;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function partesEnZona(fecha: Date, timeZone?: string | null): Map<string, string> {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZoneSeguro(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return new Map(formatter.formatToParts(fecha).map((part) => [part.type, part.value]));
}

export function fechaISOEnZona(fecha: Date = new Date(), timeZone?: string | null): string {
  const partes = partesEnZona(fecha, timeZone);
  return `${partes.get("year")}-${partes.get("month")}-${partes.get("day")}`;
}

export function horaMinutoEnZona(fecha: Date = new Date(), timeZone?: string | null): string {
  const partes = partesEnZona(fecha, timeZone);
  return `${partes.get("hour")}:${partes.get("minute")}`;
}

export function fechaMediodiaUTC(fechaIso: string): Date {
  return new Date(`${fechaIso}T12:00:00.000Z`);
}

export function sumarDiasISO(fechaIso: string, dias: number): string {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia + dias, 12, 0, 0));
  return fecha.toISOString().slice(0, 10);
}

export function anioDesdeISO(fechaIso: string): number {
  const anio = Number(fechaIso.slice(0, 4));
  return Number.isFinite(anio) ? anio : new Date().getUTCFullYear();
}

export function mesDesdeISO(fechaIso: string): number {
  const mes = Number(fechaIso.slice(5, 7));
  return Number.isFinite(mes) && mes >= 1 && mes <= 12 ? mes : new Date().getUTCMonth() + 1;
}

export function inicioMesISO(fechaIso: string): string {
  return `${fechaIso.slice(0, 7)}-01`;
}
