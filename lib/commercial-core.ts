import { z } from "zod";
import { posLineAmounts, posSaleAmounts } from "./pos-money";

export const documentKinds = ["cotizacion", "proforma"] as const;
export const commercialStates = [
  "borrador",
  "enviada",
  "aceptada",
  "rechazada",
  "vencida",
  "convertida",
] as const;
const text = (max: number) => z.string().trim().max(max).default("");
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Fecha inválida",
  );
export const commercialDraftSchema = z
  .object({
    sucursalId: z.guid(),
    clienteId: z.guid().nullable().default(null),
    fecha: day,
    vigenteHasta: day.nullable().default(null),
    moneda: z.enum(["NIO", "USD"]).default("NIO"),
    condicionesPago: text(2000),
    condicionesComerciales: text(4000),
    observaciones: text(4000),
    items: z
      .array(
        z
          .object({
            productoId: z.guid(),
            cantidad: z.coerce.number().finite().positive().max(1e6),
            precioUnitario: z.coerce.number().finite().min(0).max(1e9),
            descuento: z.coerce.number().finite().min(0).max(1e9).default(0),
            tasa: z.coerce.number().finite().min(0).max(1).default(0),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict()
  .refine(
    (d) => !d.vigenteHasta || d.vigenteHasta >= d.fecha,
    "La vigencia precede la fecha",
  );
export type CommercialDraft = z.infer<typeof commercialDraftSchema>;
export type CommercialKind = (typeof documentKinds)[number];
export type CommercialState = (typeof commercialStates)[number];
export type CommercialSnapshot = Omit<CommercialDraft, "items"> & {
  issuer: {
    nombre: string;
    nombreComercial: string | null;
    direccion: string | null;
    telefono: string | null;
    email: string | null;
    logoUrl: string | null;
    ruc: string | null;
    perfilFiscal: string;
  };
  cliente: { nombre: string; identificacion: string | null } | null;
  vendedor: string;
  documental: {
    schemaVersion: 1;
    clase: "oferta_comercial";
    fiscal: false;
    serie: null;
    autorizacion: null;
    ejemplar: "original";
    pie: string;
  };
  items: Array<
    CommercialDraft["items"][number] & {
      nombre: string;
      impuesto: number;
      subtotal: number;
      total: number;
    }
  >;
  amounts: ReturnType<typeof posSaleAmounts>;
};
export function commercialAmounts(draft: CommercialDraft) {
  const items = draft.items.map((line) => {
    if (line.descuento > line.cantidad * line.precioUnitario)
      throw new Error("El descuento supera el importe de la línea.");
    return { ...line, ...posLineAmounts(line) };
  });
  return { items, amounts: posSaleAmounts(items) };
}
const base = {
  requestId: z.guid(),
  kind: z.enum(documentKinds),
  id: z.guid().optional(),
  expectedVersion: z.number().int().positive().optional(),
};
export const commercialCommandSchema = z
  .object({
    ...base,
    action: z.enum([
      "list",
      "detail",
      "options",
      "recover",
      "create",
      "edit",
      "revise",
      "duplicate",
      "derive",
      "state",
      "convert",
      "pdf",
      "print",
      "profile",
    ]),
    attemptId: z.guid().optional(),
    documentVersion: z.number().int().positive().optional(),
    draft: commercialDraftSchema.optional(),
    state: z.enum(commercialStates).optional(),
    reason: text(1000),
    evidence: text(1000),
    query: text(100),
    filter: z.enum(commercialStates).optional(),
    sucursalId: z.guid(),
    offset: z.number().int().min(0).max(100000).default(0),
    settlement: z
      .object({
        sesionCajaId: z.guid().optional(),
        almacenId: z.guid(),
        esCredito: z.boolean(),
        diasCredito: z.number().int().min(0).max(365),
        pagos: z
          .array(
            z.object({
              formaPagoId: z.guid(),
              monto: z.number().finite().positive(),
              referencia: z.string().max(300).optional(),
              paymentSource: z
                .enum([
                  "cash",
                  "external_terminal_manual",
                  "bank_transfer_pending",
                ])
                .optional(),
              terminalApproved: z.boolean().optional(),
              terminalIndependent: z.boolean().optional(),
              terminalAuthorization: z.string().max(300).optional(),
            }),
          )
          .max(10),
      })
      .optional(),
    profile: z
      .object({
        perfil: z.enum([
          "no_registrado",
          "configuracion_pendiente",
          "registrado",
        ]),
        ruc: z.string().trim().max(100).nullable(),
      })
      .optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.documentVersion !== undefined && !["pdf", "print"].includes(c.action))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La revisión documental solo aplica a PDF/impresión.",
      });
  });
export type CommercialCommand = z.infer<typeof commercialCommandSchema>;
export type CommercialDocument = {
  id: string;
  kind: CommercialKind;
  origenId: string;
  numero: string;
  version: number;
  estado: CommercialState;
  snapshot: CommercialSnapshot;
  ventaId: string | null;
  events: Array<{
    accion: string;
    usuario: string;
    fecha: string;
    version: number;
    motivo: string | null;
    deviceId: string | null;
    changed?: string[];
  }>;
  revisions: Array<{ version: number; snapshot: CommercialSnapshot }>;
};
export type CommercialResult =
  | {
      ok: true;
      documents?: CommercialDocument[];
      document?: CommercialDocument;
      ventaId?: string;
      discarded?: boolean;
      options?: {
        products: Array<{
          id: string;
          nombre: string;
          precio: string;
          tasa: number;
        }>;
        customers: Array<{ id: string; nombre: string }>;
        sessions?:Array<{id:string;nombre:string}>;
        warehouses: Array<{ id: string; nombre: string }>;
        methods: Array<{ id: string; nombre: string; codigo: string }>;
        permissions: string[];
        profile: { perfil: string; ruc: string | null };
      };
      cached?: boolean;
    }
  | { ok: false; error: string };
export const commercialLegend =
  "Este documento no constituye una factura fiscal ni genera una venta.";
export function assertCommercialTransition(
  from: CommercialState,
  to: CommercialState,
  reason: string,
  evidence: string,
) {
  const allowed: Record<CommercialState, CommercialState[]> = {
    borrador: ["enviada", "aceptada", "rechazada", "vencida"],
    enviada: ["aceptada", "rechazada", "vencida"],
    aceptada: [],
    rechazada: [],
    vencida: [],
    convertida: [],
  };
  if (!allowed[from].includes(to))
    throw new Error("Transición no permitida; crea una nueva revisión.");
  if (to === "enviada" && !evidence.trim())
    throw new Error(
      "Registra evidencia de la entrega; abrir o imprimir no constituye envío.",
    );
  if (["rechazada", "vencida"].includes(to) && !reason.trim())
    throw new Error("Indica el motivo.");
}
