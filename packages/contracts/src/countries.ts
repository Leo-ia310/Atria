/**
 * Configuración por país para Atria. Determina moneda, impuesto,
 * formato de identificación fiscal y zona horaria.
 *
 * Usado tanto por el frontend (formularios, formato de moneda) como por
 * el backend (seed inicial de organizaciones).
 */

export type CountryCode = "HN" | "NI" | "GT" | "CR" | "SV";

export type CountryConfig = {
  code: CountryCode;
  name: string;
  currency: string;
  currencySymbol: string;
  taxName: string;
  taxCode: string;
  taxRate: number;
  fiscalIdName: string;
  fiscalIdPattern?: string;
  timezone: string;
  dateFormat: string;
};

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  HN: {
    code: "HN",
    name: "Honduras",
    currency: "HNL",
    currencySymbol: "L",
    taxName: "ISV",
    taxCode: "ISV15",
    taxRate: 0.15,
    fiscalIdName: "RTN",
    fiscalIdPattern: "^\\d{14}$",
    timezone: "America/Tegucigalpa",
    dateFormat: "DD/MM/YYYY",
  },
  NI: {
    code: "NI",
    name: "Nicaragua",
    currency: "NIO",
    currencySymbol: "C$",
    taxName: "IVA",
    taxCode: "IVA15",
    taxRate: 0.15,
    fiscalIdName: "RUC",
    timezone: "America/Managua",
    dateFormat: "DD/MM/YYYY",
  },
  GT: {
    code: "GT",
    name: "Guatemala",
    currency: "GTQ",
    currencySymbol: "Q",
    taxName: "IVA",
    taxCode: "IVA12",
    taxRate: 0.12,
    fiscalIdName: "NIT",
    timezone: "America/Guatemala",
    dateFormat: "DD/MM/YYYY",
  },
  CR: {
    code: "CR",
    name: "Costa Rica",
    currency: "CRC",
    currencySymbol: "₡",
    taxName: "IVA",
    taxCode: "IVA13",
    taxRate: 0.13,
    fiscalIdName: "Cédula Jurídica",
    timezone: "America/Costa_Rica",
    dateFormat: "DD/MM/YYYY",
  },
  SV: {
    code: "SV",
    name: "El Salvador",
    currency: "USD",
    currencySymbol: "$",
    taxName: "IVA",
    taxCode: "IVA13",
    taxRate: 0.13,
    fiscalIdName: "NIT",
    timezone: "America/El_Salvador",
    dateFormat: "DD/MM/YYYY",
  },
};

export const DEFAULT_COUNTRY: CountryCode = "NI";

export const COUNTRIES_LIST = Object.values(COUNTRIES);

export function getCountryConfig(code: string): CountryConfig {
  return COUNTRIES[code as CountryCode] ?? COUNTRIES[DEFAULT_COUNTRY];
}
