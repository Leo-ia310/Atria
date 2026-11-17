import { z } from "zod";
import { posMoney } from "./pos-money";
import { allocateCents, remainingPortion } from "./receivable-core";
export { remainingPortion };
const id = z.string().uuid(),
  qty = z
    .number()
    .positive()
    .max(1e7)
    .refine((v) => Number(v.toFixed(4)) === v, "Usa hasta cuatro decimales.");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v + "T12:00:00Z")) &&
      new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v,
    "Fecha inválida.",
  );
const money = z
  .number()
  .min(0)
  .max(1e9)
  .refine((v) => posMoney(v) === v, "Usa importes con dos decimales.");
export const receiptPolicy = z.enum([
  "sin_reconocimiento_hasta_factura",
  "mercancia_recibida_no_facturada",
]);
export const rfqDraftSchema = z
  .object({
    titulo: z.string().trim().min(1).max(200),
    vigenteHasta: date,
    condiciones: z.string().max(2000).default(""),
    proveedorIds: z
      .array(id)
      .min(1)
      .max(100)
      .refine((v) => new Set(v).size === v.length, "No repitas proveedores."),
    items: z
      .array(
        z.object({
          productoId: id,
          cantidad: qty,
          descripcion: z.string().max(500).default(""),
        }),
      )
      .min(1)
      .max(200),
  })
  .strict();
export const supplierOfferSchema = z
  .object({
    moneda: z.string().regex(/^[A-Z]{3}$/),
    tipoCambio: z
      .number()
      .positive()
      .max(1e6)
      .refine((v) => Number(v.toFixed(6)) === v, "Usa hasta seis decimales."),
    fechaCambio: date,
    fuenteCambio: z.string().trim().max(300).default(""),
    vigenteHasta: date,
    plazoDias: z.number().int().min(0).max(3650),
    garantia: z.string().trim().min(1).max(1000),
    condiciones: z.string().max(2000).default(""),
    referencia: z.string().trim().min(1).max(300),
    flete: money.default(0),
    tasaFlete: z.number().min(0).max(1).default(0),
    items: z
      .array(
        z.object({
          rfqLineId: id,
          cantidad: qty,
          precioUnitario: z
            .number()
            .min(0)
            .max(1e9)
            .refine((v) => Number(v.toFixed(4)) === v),
          descuento: money.default(0),
          tasa: z.number().min(0).max(1),
        }),
      )
      .min(1)
      .max(200),
  })
  .strict();
export const procurementSchema = z
  .object({
    action: z.enum([
      "list",
      "rfq",
      "order",
      "statement",
      "createRFQ",
      "sendRFQ",
      "offer",
      "select",
      "approveOffer",
      "rejectOffer",
      "createPO",
      "approvePO",
      "receive",
      "invoice",
      "return",
      "postReceipt",
      "postReturn",
      "pay",
      "configure",
      "recover",
    ]),
    requestId: id,
    sucursalId: id,
    id: id.optional(),
    proveedorId: id.optional(),
    rfqId: id.optional(),
    offerId: id.optional(),
    orderId: id.optional(),
    revision: z.number().int().positive().optional(),
    expectedVersion: z.number().int().positive().optional(),
    rfq: rfqDraftSchema.optional(),
    offer: supplierOfferSchema.optional(),
    motivo: z.string().trim().max(2000).default(""),
    evidencia: z.string().trim().max(2000).default(""),
    medio: z.enum(["correo", "whatsapp", "personal", "otro"]).optional(),
    proveedorIds: z.array(id).max(100).optional(),
    almacenId: id.optional(),
    fecha: date.optional(),
    fechaVencimiento: date.optional(),
    numero: z.string().trim().min(1).max(100).optional(),
    serie: z.string().trim().max(60).default(""),
    tipoDocumento: z.enum(["factura", "recibo", "otro"]).default("factura"),
    lines: z
      .array(
        z.object({
          lineId: id,
          cantidad: qty.optional(),
          aceptada: z
            .number()
            .min(0)
            .max(1e7)
            .refine((v) => Number(v.toFixed(4)) === v)
            .optional(),
          rechazada: z
            .number()
            .min(0)
            .max(1e7)
            .refine((v) => Number(v.toFixed(4)) === v)
            .optional(),
          motivo: z.string().max(1000).default(""),
        }),
      )
      .min(1)
      .max(200)
      .optional(),
    importeDeclarado: money.optional(),
    cuentaFinancieraId: id.optional(),
    sesionCajaId: id.optional(),
    cxpId: id.optional(),
    monto: money.optional(),
    confirmado: z.boolean().default(false),
    paymentSource: z
      .enum([
        "cash",
        "bank_transfer_confirmed_manual",
        "external_terminal_manual",
      ])
      .optional(),
    autorizacion: z.string().max(120).optional(),
    terminalIndependiente: z.boolean().default(false),
    config: z
      .object({
        policy: receiptPolicy,
        grniAccountId: id.nullable(),
        transitAccountId: id.nullable(),
        claimAccountId: id.nullable(),
        varianceAccountId: id.nullable(),
      })
      .strict()
      .optional(),
    attemptId: id.optional(),
  })
  .strict();
export type ProcurementCommand = z.infer<typeof procurementSchema>;
export type OfferInput = z.infer<typeof supplierOfferSchema>;
export type RFQInput = z.infer<typeof rfqDraftSchema>;
export type PurchaseConfig = NonNullable<ProcurementCommand["config"]>;
export function offerAmounts(input: OfferInput, functionalCurrency: string) {
  if (input.moneda === functionalCurrency && input.tipoCambio !== 1)
    throw new Error("La moneda funcional utiliza tipo de cambio 1.");
  if (input.moneda !== functionalCurrency && !input.fuenteCambio.trim())
    throw new Error("Registra fuente y fecha del tipo de cambio.");
  if (new Set(input.items.map((i) => i.rfqLineId)).size !== input.items.length)
    throw new Error("No repitas líneas de RFQ.");
  const raw = input.items.map((i) => {
    const gross = posMoney(i.cantidad * i.precioUnitario);
    if (!Number.isFinite(gross) || gross > 1e9)
      throw new Error("El importe de línea supera el límite permitido.");
    if (i.descuento > gross) throw new Error("El descuento supera el precio.");
    const base = posMoney(gross - i.descuento);
    return { ...i, base, tax: posMoney(base * i.tasa) };
  });
  const bases = raw.map((i) => i.base),
    base = posMoney(bases.reduce((a, b) => a + b, 0) + input.flete),
    tax = posMoney(
      raw.reduce((a, i) => a + i.tax, 0) +
        posMoney(input.flete * input.tasaFlete),
    );
  if (
    !Number.isFinite(base + tax) ||
    base + tax > 1e9 ||
    !Number.isFinite((base + tax) * input.tipoCambio) ||
    (base + tax) * input.tipoCambio > 1e9
  )
    throw new Error("El total o su conversión supera el límite permitido.");
  const freight = allocateCents(
    input.flete,
    bases.some((v) => v > 0) ? bases : raw.map((i) => i.cantidad),
  );
  const allBase = allocateCents(
    posMoney(base * input.tipoCambio),
    raw.map((i, n) => i.base + freight[n]),
  );
  const allTax = allocateCents(
    posMoney(tax * input.tipoCambio),
    raw.map(
      (i, n) =>
        i.tax +
        (input.flete
          ? (posMoney(input.flete * input.tasaFlete) * freight[n]) / input.flete
          : 0),
    ),
  );
  return {
    functionalCurrency,
    base: posMoney(base * input.tipoCambio),
    tax: posMoney(tax * input.tipoCambio),
    total: posMoney(
      posMoney(base * input.tipoCambio) + posMoney(tax * input.tipoCambio),
    ),
    originalBase: base,
    originalTax: tax,
    originalTotal: posMoney(base + tax),
    items: raw.map((i, n) => ({
      ...i,
      freight: freight[n],
      functionalBase: allBase[n],
      functionalTax: allTax[n],
    })),
  };
}
export type ProcurementRow = {
  id: string;
  numero: string;
  estado: string;
  version: number;
  nombre?: string;
  fecha?: string;
  total?: number;
  accountingStatus?: string;
  reason?: string | null;
};
export type ProcurementResult =
  | {
      ok: true;
      cached?: boolean;
      discarded?: boolean;
      id?: string;
      asientoId?: string;
      compraId?: string;
      cxpId?: string;
      accountingStatus?: string;
      reason?: string;
      effect?:
        | "commercial"
        | "receipt"
        | "invoice"
        | "payment"
        | "return"
        | "configuration";
      confirmation?: {
        version: 1;
        empresaId: string;
        userId: string;
        sucursalId: string;
        requestId: string;
        hash: string;
      };
      pendingAttempts?: Array<{ requestId: string; action: string }>;
      permissions?: string[];
      rfqs?: ProcurementRow[];
      orders?: ProcurementRow[];
      invoices?: ProcurementRow[];
      receipts?: ProcurementRow[];
      returns?: ProcurementRow[];
      options?: {
        products: Array<{ id: string; nombre: string }>;
        suppliers: Array<{ id: string; nombre: string; active?: boolean }>;
        warehouses: Array<{ id: string; nombre: string }>;
        accounts: Array<{ id: string; nombre: string; tipo: string }>;
        financial: Array<{
          id: string;
          nombre: string;
          tipo: string;
          moneda: string;
        }>;
        sessions: Array<{ id: string; nombre: string }>;
        currency: string;
        config: PurchaseConfig | null;
      };
      detail?: {
        header: ProcurementRow;
        snapshot: Record<string, unknown>;
        receipts?: Array<{
          id: string;
          numero: string;
          accountingStatus: string;
          items: Array<{
            id: string;
            nombre: string;
            accepted: number;
            returned: number;
          }>;
        }>;
        offers?: Array<{
          id: string;
          proveedorId: string;
          proveedor: string;
          revision: number;
          estado: string;
          snapshot: Record<string, unknown>;
        }>;
        history: Array<{
          accion: string;
          usuario: string;
          fecha: string;
          datos: unknown;
        }>;
        lines?: Array<{
          id: string;
          nombre: string;
          ordered: number;
          accepted: number;
          invoiced: number;
          available: number;
          returned: number;
        }>;
      };
      statement?: {
        proveedor: string;
        currency: string;
        saldo: number;
        aging: Array<{ bucket: string; total: number; count: number }>;
        documents: Array<{
          id: string;
          numero: string;
          fecha: string;
          vencimiento: string;
          monto: number;
          saldo: number;
        }>;
        payments: Array<{
          id: string;
          fecha: string;
          monto: number;
          referencia: string | null;
          asientoId: string | null;
        }>;
        pendingClaims: number;
      };
    }
  | {
      ok: false;
      error: string;
      requiresRecovery?: boolean;
      authorizationDenied?: boolean;
    };

/** Confirmation contract shared with the native boundary; recovery validates the saved effect. */
export function procurementEffect(action: ProcurementCommand["action"]) {
  if (action === "configure") return "configuration";
  if (action === "invoice") return "invoice";
  if (action === "pay") return "payment";
  if (action === "receive" || action === "postReceipt") return "receipt";
  if (action === "return" || action === "postReturn") return "return";
  return "commercial";
}
