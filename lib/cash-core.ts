/** Shared classification for Web and SQLite. Amounts are net cash applied, excluding change. */
export function isCashPayment(source: string | null | undefined, code: string): boolean {
  if (source === "cash") return true;
  return (!source || source === "legacy") && ["EFE", "EFECTIVO"].includes(code.toUpperCase());
}
export const CASH_CLOSE_NOTICE = "El cierre incluye los movimientos recibidos. Otros equipos pueden tener operaciones offline pendientes; se conservará este conteo y cualquier llegada posterior requerirá revisión.";
