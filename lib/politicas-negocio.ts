import { and, eq } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import { configuraciones } from "@/lib/db/schema";

export const POLITICAS_NEGOCIO_CLAVE = "politicas_negocio";

export type PoliticasNegocio = {
  diasCreditoClienteDefault: number;
  limiteCreditoClienteDefault: number;
  diasGraciaCobroCliente: number;
  diasCreditoProveedorDefault: number;
  diasGraciaPagoProveedor: number;
};

export const POLITICAS_NEGOCIO_DEFAULTS: PoliticasNegocio = {
  diasCreditoClienteDefault: 30,
  limiteCreditoClienteDefault: 0,
  diasGraciaCobroCliente: 0,
  diasCreditoProveedorDefault: 30,
  diasGraciaPagoProveedor: 0,
};

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function numeroEntero(
  valor: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function numeroDecimal(
  valor: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizarPoliticasNegocio(valor: unknown): PoliticasNegocio {
  const raw = esObjeto(valor) ? valor : {};
  return {
    diasCreditoClienteDefault: numeroEntero(
      raw.diasCreditoClienteDefault,
      POLITICAS_NEGOCIO_DEFAULTS.diasCreditoClienteDefault,
      0,
      365,
    ),
    limiteCreditoClienteDefault: numeroDecimal(
      raw.limiteCreditoClienteDefault,
      POLITICAS_NEGOCIO_DEFAULTS.limiteCreditoClienteDefault,
      0,
      999999999,
    ),
    diasGraciaCobroCliente: numeroEntero(
      raw.diasGraciaCobroCliente,
      POLITICAS_NEGOCIO_DEFAULTS.diasGraciaCobroCliente,
      0,
      90,
    ),
    diasCreditoProveedorDefault: numeroEntero(
      raw.diasCreditoProveedorDefault,
      POLITICAS_NEGOCIO_DEFAULTS.diasCreditoProveedorDefault,
      0,
      365,
    ),
    diasGraciaPagoProveedor: numeroEntero(
      raw.diasGraciaPagoProveedor,
      POLITICAS_NEGOCIO_DEFAULTS.diasGraciaPagoProveedor,
      0,
      90,
    ),
  };
}

export async function getPoliticasNegocio(
  empresaId: string,
): Promise<PoliticasNegocio> {
  const [row] = await dbConEmpresa(empresaId, (tx) =>
    tx
      .select({ valor: configuraciones.valor })
      .from(configuraciones)
      .where(
        and(
          eq(configuraciones.empresaId, empresaId),
          eq(configuraciones.clave, POLITICAS_NEGOCIO_CLAVE),
        ),
      )
      .limit(1),
  );

  return normalizarPoliticasNegocio(row?.valor);
}

export function sumarDiasIso(fecha: string, dias: number): string {
  const date = new Date(`${fecha}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
}

export function fechaEstaVencida(
  fechaVencimiento: string | null,
  diasGracia: number,
  hoy = new Date().toISOString().slice(0, 10),
): boolean {
  if (!fechaVencimiento) return false;
  return sumarDiasIso(fechaVencimiento, diasGracia) < hoy;
}
