export const DIAS_SEMANA = [
  { valor: 0, corto: "Dom", nombre: "Domingo" },
  { valor: 1, corto: "Lun", nombre: "Lunes" },
  { valor: 2, corto: "Mar", nombre: "Martes" },
  { valor: 3, corto: "Mie", nombre: "Miercoles" },
  { valor: 4, corto: "Jue", nombre: "Jueves" },
  { valor: 5, corto: "Vie", nombre: "Viernes" },
  { valor: 6, corto: "Sab", nombre: "Sabado" },
] as const;

export function slugifyMenu(valor: string): string {
  const slug = valor
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || "menu";
}

export function getMenuPublicUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_MENU_BASE_URL || "https://arca.onl";
  return `${base.replace(/\/+$/, "")}/${slug}`;
}

export function getMenuMesaUrl(slug: string, mesaNumero: number): string {
  return `${getMenuPublicUrl(slug)}?mesa=${mesaNumero}`;
}

export function formatearDiasSemana(dias: number[]): string {
  if (dias.length === 7) return "Todos los dias";
  const mapa = new Map<number, string>(DIAS_SEMANA.map((dia) => [dia.valor, dia.corto]));
  return dias
    .slice()
    .sort((a, b) => a - b)
    .map((dia) => mapa.get(dia) ?? String(dia))
    .join(", ");
}

export function calcularPrecioPromo({
  precio,
  tipo,
  valor,
}: {
  precio: number;
  tipo: "porcentaje" | "monto" | "precio_fijo";
  valor: number;
}): number {
  if (tipo === "precio_fijo") return Math.max(0, valor);
  if (tipo === "monto") return Math.max(0, precio - valor);
  return Math.max(0, precio * (1 - valor / 100));
}
