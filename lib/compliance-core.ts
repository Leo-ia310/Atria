import { and, eq, inArray } from "drizzle-orm";
import {
  codigosProductoFiscal,
  empresas,
  jurisdiccionesFiscales,
  reglasImpuestoFiscal,
  snapshotsImpuestoFiscal,
} from "@/lib/db/schema";
import { getPaisConfig, type PaisCodigo } from "./paises";

type TxLike = {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
};

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

export type SnapshotImpuestoVentaLinea = {
  lineaReferencia: string;
  productoFiscalCodigo?: string;
  baseImponible: number;
  impuesto: number;
  total?: number;
  detalle?: Record<string, unknown>;
};

export type CrearSnapshotsImpuestoVentaInput = {
  empresaId: string;
  referenciaTabla: string;
  referenciaId: string;
  lineas: SnapshotImpuestoVentaLinea[];
};

type EmpresaFiscalRow = {
  pais: PaisCodigo;
  moneda: "HNL" | "NIO" | "GTQ" | "CRC" | "USD" | "MXN";
};

type JurisdiccionFiscalRow = {
  id: string;
  codigo: string;
};

type ProductoFiscalRow = {
  id: string;
  codigo: string;
};

type ReglaFiscalRow = {
  id: string;
  codigo: string;
  jurisdiccionId: string | null;
  productoFiscalCodigo: string;
  tasa: string;
  fuente: string | null;
};

type SnapshotImpuestoFiscalInsert = {
  empresaId: string;
  reglaId: string | null;
  jurisdiccionId: string | null;
  productoFiscalId: string | null;
  referenciaTabla: string;
  referenciaId: string;
  lineaReferencia: string;
  pais: PaisCodigo;
  moneda: EmpresaFiscalRow["moneda"];
  baseImponible: string;
  tasa: string;
  impuesto: string;
  total: string;
  detalle: Record<string, unknown>;
  fuente: string | null;
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

export async function crearSnapshotsImpuestoVenta(
  tx: TxLike,
  input: CrearSnapshotsImpuestoVentaInput,
): Promise<void> {
  const lineas = input.lineas.filter(
    (linea) => linea.baseImponible > 0 || linea.impuesto > 0 || (linea.total ?? 0) > 0,
  );
  if (lineas.length === 0) return;

  const [empresa] = (await tx
    .select({ pais: empresas.pais, moneda: empresas.moneda })
    .from(empresas)
    .where(eq(empresas.id, input.empresaId))
    .limit(1)) as EmpresaFiscalRow[];
  if (!empresa) return;

  const codigosProducto = [
    ...new Set([
      "GENERAL_TAXABLE",
      ...lineas.map((linea) => linea.productoFiscalCodigo ?? "GENERAL_TAXABLE"),
    ]),
  ];

  const [jurisdicciones, productosFiscales, reglas] = await Promise.all([
    tx
      .select({ id: jurisdiccionesFiscales.id, codigo: jurisdiccionesFiscales.codigo })
      .from(jurisdiccionesFiscales)
      .where(
        and(
          eq(jurisdiccionesFiscales.empresaId, input.empresaId),
          eq(jurisdiccionesFiscales.pais, empresa.pais),
          eq(jurisdiccionesFiscales.activo, true),
        ),
      ),
    tx
      .select({ id: codigosProductoFiscal.id, codigo: codigosProductoFiscal.codigo })
      .from(codigosProductoFiscal)
      .where(
        and(
          eq(codigosProductoFiscal.empresaId, input.empresaId),
          inArray(codigosProductoFiscal.codigo, codigosProducto),
          eq(codigosProductoFiscal.activo, true),
        ),
      ),
    tx
      .select({
        id: reglasImpuestoFiscal.id,
        codigo: reglasImpuestoFiscal.codigo,
        jurisdiccionId: reglasImpuestoFiscal.jurisdiccionId,
        productoFiscalId: reglasImpuestoFiscal.productoFiscalId,
        productoFiscalCodigo: codigosProductoFiscal.codigo,
        tasa: reglasImpuestoFiscal.tasa,
        fuente: reglasImpuestoFiscal.fuente,
      })
      .from(reglasImpuestoFiscal)
      .innerJoin(
        codigosProductoFiscal,
        eq(codigosProductoFiscal.id, reglasImpuestoFiscal.productoFiscalId),
      )
      .where(
        and(
          eq(reglasImpuestoFiscal.empresaId, input.empresaId),
          eq(reglasImpuestoFiscal.pais, empresa.pais),
          eq(reglasImpuestoFiscal.activo, true),
          inArray(codigosProductoFiscal.codigo, codigosProducto),
        ),
      ),
  ]) as [JurisdiccionFiscalRow[], ProductoFiscalRow[], ReglaFiscalRow[]];

  const jurisdiccionDefault = jurisdicciones.find(
    (jurisdiccion) => jurisdiccion.codigo === jurisdiccionFiscalDefault(empresa.pais).codigo,
  ) ?? jurisdicciones[0];
  const productoPorCodigo = new Map(productosFiscales.map((producto) => [producto.codigo, producto]));
  const reglaPorProducto = new Map(reglas.map((regla) => [regla.productoFiscalCodigo, regla]));
  const reglaGeneral = reglaPorProducto.get("GENERAL_TAXABLE");

  const snapshots = lineas.map((linea) => {
    const productoFiscalCodigo = linea.productoFiscalCodigo ?? "GENERAL_TAXABLE";
    const productoFiscal = productoPorCodigo.get(productoFiscalCodigo);
    const regla = reglaPorProducto.get(productoFiscalCodigo) ?? reglaGeneral;
    const baseImponible = redondearDinero(linea.baseImponible);
    const impuesto = redondearDinero(linea.impuesto);
    const total = redondearDinero(linea.total ?? baseImponible + impuesto);
    const tasaSnapshot = baseImponible > 0 ? impuesto / baseImponible : 0;

    return {
      empresaId: input.empresaId,
      reglaId: regla?.id ?? null,
      jurisdiccionId: regla?.jurisdiccionId ?? jurisdiccionDefault?.id ?? null,
      productoFiscalId: productoFiscal?.id ?? null,
      referenciaTabla: input.referenciaTabla,
      referenciaId: input.referenciaId,
      lineaReferencia: linea.lineaReferencia,
      pais: empresa.pais,
      moneda: empresa.moneda,
      baseImponible: decimal4(baseImponible),
      tasa: decimal6(tasaSnapshot),
      impuesto: decimal4(impuesto),
      total: decimal4(total),
      detalle: {
        productoFiscalCodigo,
        reglaCodigo: regla?.codigo ?? null,
        reglaFallback: Boolean(regla && regla.productoFiscalCodigo !== productoFiscalCodigo),
        fuenteCalculo: "venta_confirmada",
        impuestoPersistido: true,
        ...linea.detalle,
      },
      fuente: regla?.fuente ?? "VENTA_SNAPSHOT",
    };
  }) satisfies SnapshotImpuestoFiscalInsert[];

  await tx.insert(snapshotsImpuestoFiscal).values(snapshots);
}

function redondearDinero(valor: number): number {
  return Math.round((Number(valor) + Number.EPSILON) * 10000) / 10000;
}

function decimal4(valor: number): string {
  return redondearDinero(valor).toFixed(4);
}

function decimal6(valor: number): string {
  return (Math.round((Number(valor) + Number.EPSILON) * 1000000) / 1000000).toFixed(6);
}
