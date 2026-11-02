export type ListSearchParams = Record<string, string | string[] | undefined>;
export type ListFilters = {
  q: string;
  tipo: string;
  credito: string;
  estado: string;
  desde: string;
  hasta: string;
  minimo: string;
  maximo: string;
  pagina: number;
};
export type ListKind = "clientes" | "proveedores" | "compras";
export const LIST_PAGE_SIZE = 50;

function civilDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) > 0 &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
    ? value
    : "";
}

export function parseListFilters(
  sp: ListSearchParams,
  kind: ListKind,
): ListFilters {
  const text = (key: string) =>
    typeof sp[key] === "string" ? sp[key].trim().slice(0, 160) : "";
  const option = (key: string, options: string[]) =>
    options.includes(text(key)) ? text(key) : "";
  const amount = (key: string) =>
    /^\d{1,12}(?:\.\d{1,4})?$/.test(text(key)) ? text(key) : "";
  const rawPage = Number(text("pagina"));
  return {
    q: text("q"),
    tipo:
      kind === "clientes" ? option("tipo", ["registrado", "consumidor"]) : "",
    credito: option("credito", ["contado", "credito"]),
    estado: option(
      "estado",
      kind === "compras"
        ? ["borrador", "recibida", "parcial", "anulada"]
        : ["activo", "inactivo"],
    ),
    desde: kind === "compras" ? civilDate(text("desde")) : "",
    hasta: kind === "compras" ? civilDate(text("hasta")) : "",
    minimo: kind === "compras" ? amount("minimo") : "",
    maximo: kind === "compras" ? amount("maximo") : "",
    pagina:
      Number.isSafeInteger(rawPage) && rawPage > 0
        ? Math.min(rawPage, 1000000)
        : 1,
  };
}

/** Treat %, _ and backslash as literal search characters, never SQL wildcards. */
export const listSearchPattern = (value: string) =>
  `%${value.replace(/[\\%_]/g, "\\$&")}%`;
export const hasListFilters = (filters: ListFilters) =>
  Object.entries(filters).some(
    ([key, value]) => key !== "pagina" && value !== "",
  );
export function listPageHref(
  path: string,
  filters: ListFilters,
  pagina: number,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (key !== "pagina" && value !== "") params.set(key, String(value));
  if (pagina > 1) params.set("pagina", String(pagina));
  return `${path}${params.size ? `?${params}` : ""}`;
}
