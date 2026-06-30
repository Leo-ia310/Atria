/**
 * Catálogo de cuentas base + mapeo de cuentas clave.
 *
 * El catálogo se instala automáticamente cuando se crea una organización
 * (ver apps/api/prisma/seed.ts). El motor contable resuelve las cuentas
 * por su `KEY` canónica para no depender de los códigos exactos — si
 * una organización los reasigna, el mapeo vive en CompanySetting.
 *
 * Estructura jerárquica clásica latinoamericana:
 *   1xxx Activo · 2xxx Pasivo · 3xxx Patrimonio · 4xxx Ingresos
 *   5xxx Costos · 6xxx Gastos
 */

export type AccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "COST_OF_SALES"
  | "EXPENSE";

export type AccountNature = "DEBIT" | "CREDIT";

export type BaseAccount = {
  code: string;
  name: string;
  type: AccountType;
  nature: AccountNature;
  level: number;
  isDetail: boolean;
  parentCode?: string;
};

export const BASE_CHART_OF_ACCOUNTS: BaseAccount[] = [
  // ACTIVO
  { code: "1", name: "ACTIVO", type: "ASSET", nature: "DEBIT", level: 1, isDetail: false },
  { code: "11", name: "Activo Corriente", type: "ASSET", nature: "DEBIT", level: 2, isDetail: false, parentCode: "1" },
  { code: "1101", name: "Caja General", type: "ASSET", nature: "DEBIT", level: 3, isDetail: true, parentCode: "11" },
  { code: "1102", name: "Caja Chica", type: "ASSET", nature: "DEBIT", level: 3, isDetail: true, parentCode: "11" },
  { code: "1103", name: "Bancos", type: "ASSET", nature: "DEBIT", level: 3, isDetail: true, parentCode: "11" },
  { code: "1201", name: "Cuentas por Cobrar Clientes", type: "ASSET", nature: "DEBIT", level: 3, isDetail: true, parentCode: "11" },
  { code: "1301", name: "Inventario de Mercaderías", type: "ASSET", nature: "DEBIT", level: 3, isDetail: true, parentCode: "11" },
  { code: "1401", name: "IVA Acreditable / Crédito Fiscal", type: "ASSET", nature: "DEBIT", level: 3, isDetail: true, parentCode: "11" },
  { code: "12", name: "Activo No Corriente", type: "ASSET", nature: "DEBIT", level: 2, isDetail: false, parentCode: "1" },
  { code: "1501", name: "Mobiliario y Equipo", type: "ASSET", nature: "DEBIT", level: 3, isDetail: true, parentCode: "12" },
  { code: "1502", name: "Equipo de Cómputo", type: "ASSET", nature: "DEBIT", level: 3, isDetail: true, parentCode: "12" },

  // PASIVO
  { code: "2", name: "PASIVO", type: "LIABILITY", nature: "CREDIT", level: 1, isDetail: false },
  { code: "21", name: "Pasivo Corriente", type: "LIABILITY", nature: "CREDIT", level: 2, isDetail: false, parentCode: "2" },
  { code: "2101", name: "Cuentas por Pagar Proveedores", type: "LIABILITY", nature: "CREDIT", level: 3, isDetail: true, parentCode: "21" },
  { code: "2102", name: "IVA por Pagar / Débito Fiscal", type: "LIABILITY", nature: "CREDIT", level: 3, isDetail: true, parentCode: "21" },
  { code: "2103", name: "Retenciones por Pagar", type: "LIABILITY", nature: "CREDIT", level: 3, isDetail: true, parentCode: "21" },
  { code: "2104", name: "Sueldos por Pagar", type: "LIABILITY", nature: "CREDIT", level: 3, isDetail: true, parentCode: "21" },

  // PATRIMONIO
  { code: "3", name: "PATRIMONIO", type: "EQUITY", nature: "CREDIT", level: 1, isDetail: false },
  { code: "3101", name: "Capital Social", type: "EQUITY", nature: "CREDIT", level: 3, isDetail: true, parentCode: "3" },
  { code: "3102", name: "Utilidades Retenidas", type: "EQUITY", nature: "CREDIT", level: 3, isDetail: true, parentCode: "3" },
  { code: "3103", name: "Utilidad del Ejercicio", type: "EQUITY", nature: "CREDIT", level: 3, isDetail: true, parentCode: "3" },

  // INGRESOS
  { code: "4", name: "INGRESOS", type: "REVENUE", nature: "CREDIT", level: 1, isDetail: false },
  { code: "4101", name: "Ventas de Mercaderías", type: "REVENUE", nature: "CREDIT", level: 3, isDetail: true, parentCode: "4" },
  { code: "4102", name: "Devoluciones sobre Ventas", type: "REVENUE", nature: "DEBIT", level: 3, isDetail: true, parentCode: "4" },
  { code: "4201", name: "Otros Ingresos", type: "REVENUE", nature: "CREDIT", level: 3, isDetail: true, parentCode: "4" },

  // COSTOS
  { code: "5", name: "COSTOS", type: "COST_OF_SALES", nature: "DEBIT", level: 1, isDetail: false },
  { code: "5101", name: "Costo de Mercaderías Vendidas", type: "COST_OF_SALES", nature: "DEBIT", level: 3, isDetail: true, parentCode: "5" },

  // GASTOS
  { code: "6", name: "GASTOS", type: "EXPENSE", nature: "DEBIT", level: 1, isDetail: false },
  { code: "6101", name: "Sueldos y Salarios", type: "EXPENSE", nature: "DEBIT", level: 3, isDetail: true, parentCode: "6" },
  { code: "6102", name: "Alquileres", type: "EXPENSE", nature: "DEBIT", level: 3, isDetail: true, parentCode: "6" },
  { code: "6103", name: "Servicios Públicos", type: "EXPENSE", nature: "DEBIT", level: 3, isDetail: true, parentCode: "6" },
  { code: "6104", name: "Papelería y Útiles", type: "EXPENSE", nature: "DEBIT", level: 3, isDetail: true, parentCode: "6" },
  { code: "6105", name: "Comunicaciones e Internet", type: "EXPENSE", nature: "DEBIT", level: 3, isDetail: true, parentCode: "6" },
  { code: "6201", name: "Comisiones sobre Ventas", type: "EXPENSE", nature: "DEBIT", level: 3, isDetail: true, parentCode: "6" },
  { code: "6202", name: "Publicidad y Marketing", type: "EXPENSE", nature: "DEBIT", level: 3, isDetail: true, parentCode: "6" },
  { code: "6203", name: "Fletes y Transporte", type: "EXPENSE", nature: "DEBIT", level: 3, isDetail: true, parentCode: "6" },
  { code: "6301", name: "Intereses Bancarios", type: "EXPENSE", nature: "DEBIT", level: 3, isDetail: true, parentCode: "6" },
  { code: "6302", name: "Comisiones Bancarias", type: "EXPENSE", nature: "DEBIT", level: 3, isDetail: true, parentCode: "6" },
];

/**
 * Mapeo canónico de claves → código de cuenta. El motor contable
 * resuelve cuentas por estas claves, no por código directo.
 *
 * Si una organización renombra/recodifica una cuenta, el override
 * vive en `CompanySetting.accountingMap` (JSON). El servicio
 * `AccountingService.resolveAccount(key)` consulta primero el override.
 */
export const ACCOUNT_KEYS = {
  CASH: "1101",
  PETTY_CASH: "1102",
  BANK: "1103",
  AR_CUSTOMERS: "1201",
  INVENTORY: "1301",
  VAT_RECEIVABLE: "1401",
  AP_SUPPLIERS: "2101",
  VAT_PAYABLE: "2102",
  WITHHOLDINGS: "2103",
  PAYROLL_PAYABLE: "2104",
  CAPITAL: "3101",
  RETAINED_EARNINGS: "3102",
  CURRENT_EARNINGS: "3103",
  SALES: "4101",
  SALES_RETURNS: "4102",
  OTHER_INCOME: "4201",
  COST_OF_SALES: "5101",
  PAYROLL: "6101",
  RENT: "6102",
  UTILITIES: "6103",
  OFFICE_SUPPLIES: "6104",
  COMMUNICATIONS: "6105",
  SALES_COMMISSIONS: "6201",
  MARKETING: "6202",
  FREIGHT: "6203",
  BANK_INTEREST: "6301",
  BANK_FEES: "6302",
} as const;

export type AccountKey = keyof typeof ACCOUNT_KEYS;
