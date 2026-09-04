import { getPaisConfig, type PaisCodigo } from "./paises";

export type ProductoFiscalBase = {
  codigo: string;
  nombre: string;
  categoria: string;
  descripcion: string;
};

export type JurisdiccionFiscalSeed = {
  codigo: string;
  nombre: string;
  tipo: string;
  pais: PaisCodigo;
  padreCodigo: string | null;
  metadata: Record<string, unknown>;
};

export type ReglaImpuestoFiscalSeed = {
  codigo: string;
  nombre: string;
  productoFiscalCodigo: string;
  pais: PaisCodigo;
  autoridad: string;
  tasa: number;
  baseImponible: string;
  aplicaDesde: string;
  fuente: string;
  condicion: Record<string, unknown>;
};

export const PRODUCTOS_FISCALES_BASE: ProductoFiscalBase[] = [
  {
    codigo: "GENERAL_TAXABLE",
    nombre: "Operacion gravada general",
    categoria: "general",
    descripcion: "Linea gravada con el impuesto principal configurado para la empresa.",
  },
  {
    codigo: "GENERAL_EXEMPT",
    nombre: "Operacion exenta general",
    categoria: "general",
    descripcion: "Linea no gravada que requiere evidencia o configuracion fiscal.",
  },
  {
    codigo: "ARCA_SAAS_STANDARD",
    nombre: "ARCA SaaS estandar",
    categoria: "saas",
    descripcion: "Suscripcion SaaS estandar vendida por ARCA.",
  },
  {
    codigo: "ARCA_SAAS_CUSTOM",
    nombre: "ARCA software personalizado",
    categoria: "saas",
    descripcion: "Software o implementacion personalizada sujeta a soporte documental.",
  },
  {
    codigo: "ARCA_IMPLEMENTATION",
    nombre: "Implementacion y consultoria",
    categoria: "servicio",
    descripcion: "Servicios profesionales separados de la suscripcion SaaS.",
  },
  {
    codigo: "RESTAURANTE_PREPARED_FOOD",
    nombre: "Alimentos preparados",
    categoria: "restaurante",
    descripcion: "Venta de alimentos o bebidas preparados por un restaurante.",
  },
  {
    codigo: "RESTAURANTE_TIP_VOLUNTARY",
    nombre: "Propina voluntaria",
    categoria: "restaurante",
    descripcion: "Propina voluntaria separada de cargos obligatorios.",
  },
  {
    codigo: "RESTAURANTE_SERVICE_CHARGE",
    nombre: "Cargo de servicio obligatorio",
    categoria: "restaurante",
    descripcion: "Cargo obligatorio que debe analizarse separado de la propina voluntaria.",
  },
  {
    codigo: "RESTAURANTE_DELIVERY",
    nombre: "Entrega o delivery",
    categoria: "restaurante",
    descripcion: "Cargo de entrega o delivery sujeto a reglas por jurisdiccion.",
  },
];

export function jurisdiccionFiscalDefault(pais: PaisCodigo): JurisdiccionFiscalSeed {
  if (pais === "US") {
    return {
      codigo: "US-CO",
      nombre: "Colorado",
      tipo: "state",
      pais,
      padreCodigo: "US",
      metadata: {
        piloto: true,
        requiereDireccionExacta: true,
        requiereNexus: true,
        homeRuleCities: true,
        nota: "Piloto Colorado; no representa una tasa nacional de Estados Unidos.",
      },
    };
  }

  if (pais === "MX") {
    return {
      codigo: "MX-FED",
      nombre: "Mexico federal",
      tipo: "federal",
      pais,
      padreCodigo: "MX",
      metadata: {
        requiereCfdi: true,
        requiereRfc: true,
        requiereRegimenFiscal: true,
        requiereCodigoPostalFiscal: true,
      },
    };
  }

  return {
    codigo: `${pais}-NACIONAL`,
    nombre: `${getPaisConfig(pais).nombre} nacional`,
    tipo: "national",
    pais,
    padreCodigo: null,
    metadata: {},
  };
}

export function reglasImpuestoDefault(pais: PaisCodigo): ReglaImpuestoFiscalSeed[] {
  const cfg = getPaisConfig(pais);
  const jurisdiccion = jurisdiccionFiscalDefault(pais);
  const fuente =
    pais === "US"
      ? "Colorado piloto desde reporte fiscal ARCA"
      : pais === "MX"
        ? "SAT/LIVA default IVA general"
        : "CONFIG_PAIS";

  return [
    {
      codigo: `${jurisdiccion.codigo}:GENERAL_TAXABLE:${cfg.impuestoCodigo}:v1`,
      nombre: `${cfg.impuestoNombre} general`,
      productoFiscalCodigo: "GENERAL_TAXABLE",
      pais,
      autoridad: jurisdiccion.nombre,
      tasa: cfg.tasaDefault,
      baseImponible: "subtotal",
      aplicaDesde: "2026-01-01",
      fuente,
      condicion: {},
    },
    {
      codigo: `${jurisdiccion.codigo}:ARCA_SAAS_STANDARD:${cfg.impuestoCodigo}:v1`,
      nombre: `${cfg.impuestoNombre} SaaS estandar`,
      productoFiscalCodigo: "ARCA_SAAS_STANDARD",
      pais,
      autoridad: jurisdiccion.nombre,
      tasa: cfg.tasaDefault,
      baseImponible: "subtotal",
      aplicaDesde: "2026-01-01",
      fuente,
      condicion:
        pais === "US"
          ? {
              pilotoColorado: true,
              requiereDireccionExacta: true,
              requiereNexus: true,
              noUsarComoTasaNacional: true,
            }
          : {},
    },
  ];
}
