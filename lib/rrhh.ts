/**
 * Configuración del módulo de Recursos Humanos.
 *
 * - Catálogo de feriados fijos por país (se siembran por año a la empresa).
 * - Tasas de seguridad social (aporte del trabajador) por país, usadas para
 *   calcular la deducción en la nómina.
 *
 * Nota: los feriados con fecha móvil (Semana Santa, etc.) no se incluyen aquí
 * porque dependen del calendario litúrgico; el usuario puede agregarlos a mano.
 */

import type { PaisCodigo } from "./paises";

export type FeriadoBase = {
  nombre: string;
  /** Mes 1-12 */
  mes: number;
  /** Día del mes */
  dia: number;
};

/** Feriados nacionales de fecha fija por país. */
export const FERIADOS_POR_PAIS: Record<PaisCodigo, FeriadoBase[]> = {
  HN: [
    { nombre: "Año Nuevo", mes: 1, dia: 1 },
    { nombre: "Día del Trabajador", mes: 5, dia: 1 },
    { nombre: "Día de la Independencia", mes: 9, dia: 15 },
    { nombre: "Día de Morazán", mes: 10, dia: 3 },
    { nombre: "Día de la Raza", mes: 10, dia: 12 },
    { nombre: "Día de las Fuerzas Armadas", mes: 10, dia: 21 },
    { nombre: "Navidad", mes: 12, dia: 25 },
  ],
  NI: [
    { nombre: "Año Nuevo", mes: 1, dia: 1 },
    { nombre: "Día del Trabajador", mes: 5, dia: 1 },
    { nombre: "Revolución Sandinista", mes: 7, dia: 19 },
    { nombre: "Batalla de San Jacinto", mes: 9, dia: 14 },
    { nombre: "Día de la Independencia", mes: 9, dia: 15 },
    { nombre: "Inmaculada Concepción", mes: 12, dia: 8 },
    { nombre: "Navidad", mes: 12, dia: 25 },
  ],
  GT: [
    { nombre: "Año Nuevo", mes: 1, dia: 1 },
    { nombre: "Día del Trabajador", mes: 5, dia: 1 },
    { nombre: "Día del Ejército", mes: 6, dia: 30 },
    { nombre: "Día de la Independencia", mes: 9, dia: 15 },
    { nombre: "Día de la Revolución", mes: 10, dia: 20 },
    { nombre: "Día de Todos los Santos", mes: 11, dia: 1 },
    { nombre: "Navidad", mes: 12, dia: 25 },
  ],
  CR: [
    { nombre: "Año Nuevo", mes: 1, dia: 1 },
    { nombre: "Día del Trabajador", mes: 5, dia: 1 },
    { nombre: "Anexión de Guanacaste", mes: 7, dia: 25 },
    { nombre: "Día de la Virgen de los Ángeles", mes: 8, dia: 2 },
    { nombre: "Día de la Madre", mes: 8, dia: 15 },
    { nombre: "Día de la Independencia", mes: 9, dia: 15 },
    { nombre: "Navidad", mes: 12, dia: 25 },
  ],
  SV: [
    { nombre: "Año Nuevo", mes: 1, dia: 1 },
    { nombre: "Día del Trabajador", mes: 5, dia: 1 },
    { nombre: "Día de la Madre", mes: 5, dia: 10 },
    { nombre: "Día del Padre", mes: 6, dia: 17 },
    { nombre: "Fiestas Agostinas", mes: 8, dia: 6 },
    { nombre: "Día de la Independencia", mes: 9, dia: 15 },
    { nombre: "Día de los Difuntos", mes: 11, dia: 2 },
    { nombre: "Navidad", mes: 12, dia: 25 },
  ],
};

/** Aporte laboral (trabajador) a la seguridad social por país. */
export const TASA_SEGURIDAD_SOCIAL: Record<PaisCodigo, number> = {
  HN: 0.035, // IHSS (EM + IVM aporte trabajador aprox.)
  NI: 0.07, // INSS régimen integral (aporte laboral)
  GT: 0.0483, // IGSS cuota laboral
  CR: 0.1067, // CCSS aporte del trabajador
  SV: 0.0725, // ISSS + AFP aporte laboral aprox.
};

export const SEGURIDAD_SOCIAL_NOMBRE: Record<PaisCodigo, string> = {
  HN: "IHSS",
  NI: "INSS",
  GT: "IGSS",
  CR: "CCSS",
  SV: "ISSS/AFP",
};

export const TIPO_CONTRATO_LABEL: Record<string, string> = {
  indefinido: "Indefinido",
  temporal: "Temporal",
  por_obra: "Por obra",
  medio_tiempo: "Medio tiempo",
  practicante: "Practicante",
  servicios: "Servicios profesionales",
};

export const FRECUENCIA_LABEL: Record<string, string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
};

export const ESTADO_EMPLEADO_LABEL: Record<string, string> = {
  activo: "Activo",
  vacaciones: "En vacaciones",
  licencia: "En licencia",
  suspendido: "Suspendido",
  baja: "Baja",
};

export const ASISTENCIA_ESTADO_LABEL: Record<string, string> = {
  presente: "Presente",
  tarde: "Tarde",
  ausente: "Ausente",
  justificado: "Justificado",
  permiso: "Permiso",
  vacaciones: "Vacaciones",
  incapacidad: "Incapacidad",
  feriado: "Feriado",
  descanso: "Descanso",
};

export const SOLICITUD_TIPO_LABEL: Record<string, string> = {
  vacaciones: "Vacaciones",
  permiso: "Permiso",
  incapacidad: "Incapacidad",
  adelanto: "Adelanto de salario",
  constancia: "Constancia laboral",
  otro: "Otro",
};

export const SOLICITUD_ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
};

export const CANDIDATO_ETAPA_LABEL: Record<string, string> = {
  aplicado: "Aplicado",
  preseleccion: "Preselección",
  entrevista: "Entrevista",
  oferta: "Oferta",
  contratado: "Contratado",
  descartado: "Descartado",
};

export const VACANTE_ESTADO_LABEL: Record<string, string> = {
  abierta: "Abierta",
  pausada: "Pausada",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

/** Divisor de días del período según frecuencia (para prorratear el salario mensual). */
export function factorPeriodo(frecuencia: string): number {
  if (frecuencia === "semanal") return 7 / 30;
  if (frecuencia === "quincenal") return 0.5;
  return 1;
}

/** Días nominales del período según frecuencia. */
export function diasDelPeriodo(frecuencia: string): number {
  if (frecuencia === "semanal") return 7;
  if (frecuencia === "quincenal") return 15;
  return 30;
}
