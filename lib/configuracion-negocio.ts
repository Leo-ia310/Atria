import { and, eq } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import { configuraciones } from "@/lib/db/schema";

export const CONFIGURACION_NEGOCIO_CLAVE = "configuracion_negocio";

export type FrecuenciaNomina = "semanal" | "quincenal" | "mensual";
export type InicioSemana = "lunes" | "domingo";

export type ConfiguracionNegocio = {
  frecuenciaNomina: FrecuenciaNomina;
  diaPagoNomina: number;
  horasJornada: number;
  diasLaboralesSemana: number;
  inicioSemana: InicioSemana;
};

export const CONFIGURACION_NEGOCIO_DEFAULTS: ConfiguracionNegocio = {
  frecuenciaNomina: "quincenal",
  diaPagoNomina: 30,
  horasJornada: 8,
  diasLaboralesSemana: 6,
  inicioSemana: "lunes",
};

export const FRECUENCIA_NOMINA_LABEL: Record<FrecuenciaNomina, string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
};

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function numeroEntero(valor: unknown, fallback: number, min: number, max: number): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function enumValor<T extends string>(valor: unknown, permitidos: readonly T[], fallback: T): T {
  return permitidos.includes(valor as T) ? (valor as T) : fallback;
}

export function normalizarConfiguracionNegocio(valor: unknown): ConfiguracionNegocio {
  const raw = esObjeto(valor) ? valor : {};
  return {
    frecuenciaNomina: enumValor(
      raw.frecuenciaNomina,
      ["semanal", "quincenal", "mensual"] as const,
      CONFIGURACION_NEGOCIO_DEFAULTS.frecuenciaNomina,
    ),
    diaPagoNomina: numeroEntero(
      raw.diaPagoNomina,
      CONFIGURACION_NEGOCIO_DEFAULTS.diaPagoNomina,
      1,
      31,
    ),
    horasJornada: numeroEntero(
      raw.horasJornada,
      CONFIGURACION_NEGOCIO_DEFAULTS.horasJornada,
      1,
      24,
    ),
    diasLaboralesSemana: numeroEntero(
      raw.diasLaboralesSemana,
      CONFIGURACION_NEGOCIO_DEFAULTS.diasLaboralesSemana,
      1,
      7,
    ),
    inicioSemana: enumValor(
      raw.inicioSemana,
      ["lunes", "domingo"] as const,
      CONFIGURACION_NEGOCIO_DEFAULTS.inicioSemana,
    ),
  };
}

export async function getConfiguracionNegocio(
  empresaId: string,
): Promise<ConfiguracionNegocio> {
  const [row] = await dbConEmpresa(empresaId, (tx) =>
    tx
      .select({ valor: configuraciones.valor })
      .from(configuraciones)
      .where(
        and(
          eq(configuraciones.empresaId, empresaId),
          eq(configuraciones.clave, CONFIGURACION_NEGOCIO_CLAVE),
        ),
      )
      .limit(1),
  );

  return normalizarConfiguracionNegocio(row?.valor);
}
