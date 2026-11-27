import { z } from "zod";
import { posMoney } from "./pos-money";
const amount = z
  .number()
  .positive()
  .max(1e9)
  .refine((v) => posMoney(v) === v, "Usa importes con dos decimales.");
export const receivableCommandSchema = z
  .object({
    action: z.enum([
      "list",
      "customer",
      "sale",
      "configure",
      "advance",
      "apply",
      "refund",
      "collect",
      "creditNote",
      "recover",
    ]),
    requestId: z.guid(),
    sucursalId: z.guid(),
    id: z.guid().optional(),
    clienteId: z.guid().optional(),
    ventaId: z.guid().optional(),
    cuentaPasivoId: z.guid().optional(),
    formaPagoId: z.guid().optional(),
    sesionCajaId: z.guid().optional(),
    cxcId: z.guid().optional(),
    monto: amount.optional(),
    referencia: z.string().trim().max(300).default(""),
    motivo: z.string().trim().max(2000).default(""),
    confirmed: z.boolean().default(false),
    terminalIndependent: z.boolean().default(false),
    terminalAuthorization: z.string().max(300).optional(),
    lines: z
      .array(
        z.object({
          lineId: z.guid(),
          cantidad: z.number().positive().max(1e7).refine(q=>Number(q.toFixed(4))===q,'Usa cantidades con hasta cuatro decimales.'),
          reingresar: z.boolean(),
        }),
      )
      .min(1)
      .max(500)
      .optional(),
    cancel: z.boolean().default(false),
    attemptId: z.guid().optional(),
  })
  .strict();
export type ReceivableCommand = z.infer<typeof receivableCommandSchema>;
export type CreditBalance = {
  id: string;
  clienteId: string;
  cliente: string;
  numero: string;
  moneda: string;
  monto: number;
  saldo: number;
  tipo: string;
  fecha: string;
};
export type ReceivableEvent = {
  id: string;
  tipo: string;
  numero: string;
  fecha: string;
  monto: number;
  referencia: string | null;
  asientoId: string | null;
};
export type ReceivableSale = {
  id: string;
  numero: string;
  clienteId: string | null;
  cliente: string;
  moneda: string | null;
  total: number;
  credited: number;
  cancelled: boolean;
  notes: Array<{
    id: string;
    numero: string;
    fecha: string;
    tipo: string;
    total: number;
  }>;
  lines: Array<{
    id: string;
    nombre: string;
    cantidad: number;
    available: number;
    precio: number;
    reingresable: boolean;
  }>;
};
export type ReceivableResult =
  | {
      ok: true;
      cached?: boolean;
      pendingAttempts?: Array<{ requestId: string; action: string }>;
      discarded?: boolean;
      id?: string;
      asientoId?: string;
      documentId?: string;
      confirmation?: {
        version: 1;
        empresaId: string;
        userId: string;
        sucursalId: string;
        requestId: string;
        hash: string;
      };
      permissions?: string[];
      credits?: CreditBalance[];
      receipts?: Array<{
        id: string;
        numero: string;
        tipo: string;
        fecha: string;
        clienteId: string | null;
      }>;
      sale?: ReceivableSale;
      customer?: {
        id: string;
        nombre: string;
        opening: number;
        closing: number;
        events: ReceivableEvent[];
        aging: Array<{ bucket: string; amount: number; count: number }>;
        unreconciled: number;
      };
      options?: {
        clients: Array<{ id: string; nombre: string }>;
        methods: Array<{ id: string; nombre: string; codigo: string }>;
        sessions: Array<{ id: string; nombre: string }>;
        liabilities: Array<{ id: string; nombre: string }>;
        configured: string | null;
        cxc: Array<{
          id: string;
          clienteId: string;
          numero: string;
          saldo: number;
        }>;
      };
    }
  | { ok: false; error: string };
/** Deterministic allocation in cents; the final returned unit receives remaining cents. */
export function allocateCents(total: number, weights: number[]): number[] {
  const cents = Math.round(posMoney(total) * 100),
    sum = weights.reduce((a, b) => a + b, 0);
  if (
    cents < 0 ||
    !Number.isSafeInteger(cents) ||
    weights.some((w) => !Number.isFinite(w) || w < 0) ||
    (!sum && cents)
  )
    throw new Error("No se puede distribuir el importe original.");
  if (!sum) return weights.map(() => 0);
  const exact = weights.map((w) => (cents * w) / sum),
    result = exact.map(Math.floor);
  let remainder = cents - result.reduce((a, b) => a + b, 0);
  for (const { i } of exact
    .map((v, i) => ({ i, r: v - result[i] }))
    .sort((a, b) => b.r - a.r || a.i - b.i)) {
    if (remainder-- <= 0) break;
    result[i]++;
  }
  return result.map((v) => v / 100);
}
export function remainingPortion(
  total: number,
  originalQty: number,
  returnedQty: number,
  qty: number,
) {
  if (
    originalQty <= 0 ||
    qty <= 0 ||
    returnedQty < 0 ||
    returnedQty + qty > originalQty + 0.0000001
  )
    throw new Error("La devolución supera la cantidad original.");
  return posMoney(
    posMoney((total * Math.min(originalQty, returnedQty + qty)) / originalQty) -
      posMoney((total * returnedQty) / originalQty),
  );
}
