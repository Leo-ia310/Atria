const PREFIJOS_ESPECIALES: Record<string, string> = {
  limpieza: "LIM",
  aseo: "LIM",
  consumible: "CSB",
  consumibles: "CSB",
  alimentos: "ALI",
  alimento: "ALI",
  bebidas: "BEB",
  bebida: "BEB",
  papeleria: "PAP",
  oficina: "OFC",
  cocina: "COC",
  tecnologia: "TEC",
  servicio: "SRV",
  servicios: "SRV",
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function prefijoSkuCategoria(nombreCategoria?: string | null, tipo?: string): string {
  const nombre = normalizar(nombreCategoria ?? "");
  if (!nombre) return tipo === "servicio" ? "SRV" : "GEN";

  for (const palabra of nombre.split(/[\s-]+/)) {
    const prefijo = PREFIJOS_ESPECIALES[palabra];
    if (prefijo) return prefijo;
  }

  const palabras = nombre.split(/[\s-]+/).filter(Boolean);
  if (palabras.length >= 2) {
    return palabras
      .slice(0, 3)
      .map((palabra) => palabra[0])
      .join("")
      .toUpperCase()
      .padEnd(3, "X")
      .slice(0, 3);
  }

  const compacta = palabras[0]?.replace(/[^a-z0-9]/g, "") ?? "";
  return (compacta.slice(0, 3) || "GEN").toUpperCase().padEnd(3, "X");
}

export function normalizarSku(sku: string): string {
  return sku
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatearSku(prefijo: string, numero: number): string {
  return `${prefijo}-${String(numero).padStart(4, "0")}`;
}
