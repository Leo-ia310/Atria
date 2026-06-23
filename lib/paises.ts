/**
 * Configuración por país. Determina moneda, impuesto, formato de identificación
 * fiscal y catálogo de cuentas base que se instala al onboarding.
 */

export type PaisCodigo = "HN" | "NI" | "GT" | "CR" | "SV";

export type PaisConfig = {
  codigo: PaisCodigo;
  nombre: string;
  moneda: string;
  simbolo: string;
  impuestoNombre: string;
  impuestoCodigo: string;
  tasaDefault: number;
  idFiscalNombre: string;
  idFiscalFormato?: RegExp;
  zonaHoraria: string;
  formatoFecha: string;
};

export const CONFIG_PAIS: Record<PaisCodigo, PaisConfig> = {
  HN: {
    codigo: "HN",
    nombre: "Honduras",
    moneda: "HNL",
    simbolo: "L",
    impuestoNombre: "ISV",
    impuestoCodigo: "ISV15",
    tasaDefault: 0.15,
    idFiscalNombre: "RTN",
    idFiscalFormato: /^\d{14}$/,
    zonaHoraria: "America/Tegucigalpa",
    formatoFecha: "DD/MM/YYYY",
  },
  NI: {
    codigo: "NI",
    nombre: "Nicaragua",
    moneda: "NIO",
    simbolo: "C$",
    impuestoNombre: "IVA",
    impuestoCodigo: "IVA15",
    tasaDefault: 0.15,
    idFiscalNombre: "RUC",
    idFiscalFormato: /^[\dA-Z-]+$/,
    zonaHoraria: "America/Managua",
    formatoFecha: "DD/MM/YYYY",
  },
  GT: {
    codigo: "GT",
    nombre: "Guatemala",
    moneda: "GTQ",
    simbolo: "Q",
    impuestoNombre: "IVA",
    impuestoCodigo: "IVA12",
    tasaDefault: 0.12,
    idFiscalNombre: "NIT",
    zonaHoraria: "America/Guatemala",
    formatoFecha: "DD/MM/YYYY",
  },
  CR: {
    codigo: "CR",
    nombre: "Costa Rica",
    moneda: "CRC",
    simbolo: "₡",
    impuestoNombre: "IVA",
    impuestoCodigo: "IVA13",
    tasaDefault: 0.13,
    idFiscalNombre: "Cédula Jurídica",
    zonaHoraria: "America/Costa_Rica",
    formatoFecha: "DD/MM/YYYY",
  },
  SV: {
    codigo: "SV",
    nombre: "El Salvador",
    moneda: "USD",
    simbolo: "$",
    impuestoNombre: "IVA",
    impuestoCodigo: "IVA13",
    tasaDefault: 0.13,
    idFiscalNombre: "NIT",
    zonaHoraria: "America/El_Salvador",
    formatoFecha: "DD/MM/YYYY",
  },
};

export const PAIS_DEFAULT: PaisCodigo = "NI";

export const PAISES_ARRAY = Object.values(CONFIG_PAIS);

export function getPaisConfig(codigo: string): PaisConfig {
  return CONFIG_PAIS[codigo as PaisCodigo] ?? CONFIG_PAIS[PAIS_DEFAULT];
}

/**
 * Catálogo de cuentas base. Se replica para cada empresa al completar onboarding.
 * Códigos siguen estructura jerárquica clásica latinoamericana.
 */
export type CuentaBase = {
  codigo: string;
  nombre: string;
  tipo: "activo" | "pasivo" | "patrimonio" | "ingreso" | "costo" | "gasto";
  naturaleza: "deudora" | "acreedora";
  nivel: number;
  esDetalle: boolean;
  padreCodigo?: string;
};

export const CATALOGO_CUENTAS_BASE: CuentaBase[] = [
  // ACTIVO
  { codigo: "1", nombre: "ACTIVO", tipo: "activo", naturaleza: "deudora", nivel: 1, esDetalle: false },
  { codigo: "11", nombre: "Activo Corriente", tipo: "activo", naturaleza: "deudora", nivel: 2, esDetalle: false, padreCodigo: "1" },
  { codigo: "1101", nombre: "Caja General", tipo: "activo", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "11" },
  { codigo: "1102", nombre: "Caja Chica", tipo: "activo", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "11" },
  { codigo: "1103", nombre: "Bancos", tipo: "activo", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "11" },
  { codigo: "1104", nombre: "Cuentas por Cobrar Clientes", tipo: "activo", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "11" },
  { codigo: "1105", nombre: "Inventario de Mercaderías", tipo: "activo", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "11" },
  { codigo: "1106", nombre: "IVA Acreditable / Crédito Fiscal", tipo: "activo", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "11" },
  { codigo: "12", nombre: "Activo No Corriente", tipo: "activo", naturaleza: "deudora", nivel: 2, esDetalle: false, padreCodigo: "1" },
  { codigo: "1201", nombre: "Mobiliario y Equipo", tipo: "activo", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "12" },
  { codigo: "1202", nombre: "Equipo de Cómputo", tipo: "activo", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "12" },
  { codigo: "1203", nombre: "Depreciación Acumulada", tipo: "activo", naturaleza: "acreedora", nivel: 3, esDetalle: true, padreCodigo: "12" },

  // PASIVO
  { codigo: "2", nombre: "PASIVO", tipo: "pasivo", naturaleza: "acreedora", nivel: 1, esDetalle: false },
  { codigo: "21", nombre: "Pasivo Corriente", tipo: "pasivo", naturaleza: "acreedora", nivel: 2, esDetalle: false, padreCodigo: "2" },
  { codigo: "2101", nombre: "Cuentas por Pagar Proveedores", tipo: "pasivo", naturaleza: "acreedora", nivel: 3, esDetalle: true, padreCodigo: "21" },
  { codigo: "2102", nombre: "IVA por Pagar / Débito Fiscal", tipo: "pasivo", naturaleza: "acreedora", nivel: 3, esDetalle: true, padreCodigo: "21" },
  { codigo: "2103", nombre: "Retenciones por Pagar", tipo: "pasivo", naturaleza: "acreedora", nivel: 3, esDetalle: true, padreCodigo: "21" },
  { codigo: "2104", nombre: "Sueldos por Pagar", tipo: "pasivo", naturaleza: "acreedora", nivel: 3, esDetalle: true, padreCodigo: "21" },
  { codigo: "22", nombre: "Pasivo No Corriente", tipo: "pasivo", naturaleza: "acreedora", nivel: 2, esDetalle: false, padreCodigo: "2" },
  { codigo: "2201", nombre: "Préstamos Bancarios Largo Plazo", tipo: "pasivo", naturaleza: "acreedora", nivel: 3, esDetalle: true, padreCodigo: "22" },

  // PATRIMONIO
  { codigo: "3", nombre: "PATRIMONIO", tipo: "patrimonio", naturaleza: "acreedora", nivel: 1, esDetalle: false },
  { codigo: "31", nombre: "Capital", tipo: "patrimonio", naturaleza: "acreedora", nivel: 2, esDetalle: false, padreCodigo: "3" },
  { codigo: "3101", nombre: "Capital Social", tipo: "patrimonio", naturaleza: "acreedora", nivel: 3, esDetalle: true, padreCodigo: "31" },
  { codigo: "3102", nombre: "Utilidades Retenidas", tipo: "patrimonio", naturaleza: "acreedora", nivel: 3, esDetalle: true, padreCodigo: "31" },
  { codigo: "3103", nombre: "Utilidad del Ejercicio", tipo: "patrimonio", naturaleza: "acreedora", nivel: 3, esDetalle: true, padreCodigo: "31" },

  // INGRESOS
  { codigo: "4", nombre: "INGRESOS", tipo: "ingreso", naturaleza: "acreedora", nivel: 1, esDetalle: false },
  { codigo: "41", nombre: "Ingresos Operativos", tipo: "ingreso", naturaleza: "acreedora", nivel: 2, esDetalle: false, padreCodigo: "4" },
  { codigo: "4101", nombre: "Ventas de Mercaderías", tipo: "ingreso", naturaleza: "acreedora", nivel: 3, esDetalle: true, padreCodigo: "41" },
  { codigo: "4102", nombre: "Devoluciones sobre Ventas", tipo: "ingreso", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "41" },
  { codigo: "4103", nombre: "Descuentos sobre Ventas", tipo: "ingreso", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "41" },
  { codigo: "42", nombre: "Otros Ingresos", tipo: "ingreso", naturaleza: "acreedora", nivel: 2, esDetalle: false, padreCodigo: "4" },
  { codigo: "4201", nombre: "Ingresos Financieros", tipo: "ingreso", naturaleza: "acreedora", nivel: 3, esDetalle: true, padreCodigo: "42" },

  // COSTOS
  { codigo: "5", nombre: "COSTOS", tipo: "costo", naturaleza: "deudora", nivel: 1, esDetalle: false },
  { codigo: "51", nombre: "Costo de Ventas", tipo: "costo", naturaleza: "deudora", nivel: 2, esDetalle: false, padreCodigo: "5" },
  { codigo: "5101", nombre: "Costo de Mercaderías Vendidas", tipo: "costo", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "51" },

  // GASTOS
  { codigo: "6", nombre: "GASTOS", tipo: "gasto", naturaleza: "deudora", nivel: 1, esDetalle: false },
  { codigo: "61", nombre: "Gastos de Administración", tipo: "gasto", naturaleza: "deudora", nivel: 2, esDetalle: false, padreCodigo: "6" },
  { codigo: "6101", nombre: "Sueldos y Salarios", tipo: "gasto", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "61" },
  { codigo: "6102", nombre: "Alquileres", tipo: "gasto", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "61" },
  { codigo: "6103", nombre: "Servicios Públicos", tipo: "gasto", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "61" },
  { codigo: "6104", nombre: "Papelería y Útiles", tipo: "gasto", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "61" },
  { codigo: "6105", nombre: "Comunicaciones e Internet", tipo: "gasto", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "61" },
  { codigo: "62", nombre: "Gastos de Venta", tipo: "gasto", naturaleza: "deudora", nivel: 2, esDetalle: false, padreCodigo: "6" },
  { codigo: "6201", nombre: "Comisiones sobre Ventas", tipo: "gasto", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "62" },
  { codigo: "6202", nombre: "Publicidad y Marketing", tipo: "gasto", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "62" },
  { codigo: "6203", nombre: "Fletes y Transporte", tipo: "gasto", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "62" },
  { codigo: "63", nombre: "Gastos Financieros", tipo: "gasto", naturaleza: "deudora", nivel: 2, esDetalle: false, padreCodigo: "6" },
  { codigo: "6301", nombre: "Intereses Bancarios", tipo: "gasto", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "63" },
  { codigo: "6302", nombre: "Comisiones Bancarias", tipo: "gasto", naturaleza: "deudora", nivel: 3, esDetalle: true, padreCodigo: "63" },
];

/**
 * Códigos clave que el motor contable referencia por nombre fijo.
 * Si cambian estos códigos en una empresa, el motor seguirá funcionando
 * porque busca por estas constantes mapeadas en configuraciones.
 */
export const CUENTAS_CLAVE = {
  CAJA: "1101",
  BANCO: "1103",
  CXC_CLIENTES: "1104",
  INVENTARIO: "1105",
  IVA_CREDITO: "1106",
  CXP_PROVEEDORES: "2101",
  IVA_DEBITO: "2102",
  RETENCIONES: "2103",
  VENTAS: "4101",
  DEVOLUCIONES_VENTAS: "4102",
  COSTO_VENTAS: "5101",
} as const;
