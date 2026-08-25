import crypto from "node:crypto";

export const RESTAURANTE_GUEST_COOKIE = "arca_guest";
const TOKEN_BYTES = 32;

export type UnidadNormalizada = "g" | "kg" | "ml" | "l" | "unidad" | "caja" | "paquete";

const UNIDADES_EQUIVALENTES: Record<string, UnidadNormalizada> = {
  G: "g",
  GR: "g",
  GRAMO: "g",
  GRAMOS: "g",
  KG: "kg",
  KILO: "kg",
  KILOGRAMO: "kg",
  ML: "ml",
  MILILITRO: "ml",
  L: "l",
  LT: "l",
  LITRO: "l",
  UND: "unidad",
  UNIDAD: "unidad",
  UNIDADES: "unidad",
  CJA: "caja",
  CAJA: "caja",
  PQT: "paquete",
  PAQUETE: "paquete",
};

export function normalizarCodigoUnidad(codigo: string): UnidadNormalizada | null {
  return UNIDADES_EQUIVALENTES[codigo.trim().toUpperCase()] ?? null;
}

export function convertirCantidadBase({
  cantidad,
  unidadOrigen,
  factorProducto,
}: {
  cantidad: number;
  unidadOrigen: string;
  factorProducto?: number | null;
}): number {
  const unidad = normalizarCodigoUnidad(unidadOrigen);
  if (!unidad) throw new Error(`Unidad no soportada: ${unidadOrigen}`);
  const factor = factorProducto && factorProducto > 0 ? factorProducto : factorUnidadBase(unidad);
  return redondearCantidad(cantidad * factor);
}

export function factorUnidadBase(unidad: UnidadNormalizada): number {
  switch (unidad) {
    case "kg":
      return 1000;
    case "l":
      return 1000;
    case "g":
    case "ml":
    case "unidad":
      return 1;
    case "caja":
    case "paquete":
      throw new Error("Caja/paquete requiere factor de producto explicito");
  }
}

export function redondearCantidad(valor: number): number {
  return Math.round(valor * 10000) / 10000;
}

export function calcularFoodCostPct(costoPorPorcion: number, precioVenta: number): number {
  if (precioVenta <= 0) return 0;
  return Math.round((costoPorPorcion / precioVenta) * 10000) / 100;
}

export function calcularCostoPorPorcion(costoTotal: number, rendimiento: number): number {
  if (rendimiento <= 0) return 0;
  return Math.round((costoTotal / rendimiento) * 10000) / 10000;
}

export function crearTokenOpaco(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(token: string): string {
  const pepper = process.env.ARCA_TOKEN_PEPPER ?? process.env.NEXTAUTH_SECRET ?? "arca-dev";
  return crypto.createHmac("sha256", pepper).update(token).digest("hex");
}

export function ultimos4Token(token: string): string {
  return token.slice(-4);
}

export function normalizarTelefono(valor?: string | null): string | null {
  const limpio = valor?.replace(/[^\d+]/g, "").trim();
  return limpio ? limpio : null;
}

export function normalizarEmail(valor?: string | null): string | null {
  const limpio = valor?.trim().toLowerCase();
  return limpio || null;
}

export function sumarDias(fecha: Date, dias: number): Date {
  const siguiente = new Date(fecha);
  siguiente.setDate(siguiente.getDate() + dias);
  return siguiente;
}
