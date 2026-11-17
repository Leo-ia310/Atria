/** One supplier document identity across the documentary flow and legacy purchase entry. */
export function normalizeSupplierDocument(value: string) {
  return value.normalize("NFKC").toUpperCase().replace(/\s+/g, " ").trim();
}
