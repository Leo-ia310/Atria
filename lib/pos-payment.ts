import { z } from "zod";

/** Evidence for manual payments, shared by Desktop and its Cloud adapter. */
export const manualPaymentEvidenceSchema = z.object({
  terminalApproved: z.boolean().optional(),
  terminalIndependent: z.boolean().optional(),
  terminalAuthorization: z.string().trim().min(1).max(120).nullable().optional(),
  paymentSource: z.enum(["cash", "external_terminal_manual", "bank_transfer_pending"]).optional(),
});
export type ManualPaymentEvidence = z.infer<typeof manualPaymentEvidenceSchema>;
export type ConfirmedPaymentEvidence = {
  paymentSource: "cash" | "external_terminal_manual";
  paymentStatus: "confirmed";
  terminalApproved: boolean;
  terminalIndependent: boolean;
  terminalAuthorization: string | null;
};

export function manualPaymentKind(code: string): "cash" | "card" | "unsupported" {
  const normalized = code.trim().toUpperCase();
  if (["EFE", "EFECTIVO"].includes(normalized)) return "cash";
  if (["TAR", "TARJETA"].includes(normalized)) return "card";
  return "unsupported";
}

export function confirmManualPayment(code: string, raw: unknown): ConfirmedPaymentEvidence {
  const evidence = manualPaymentEvidenceSchema.parse(raw);
  const kind = manualPaymentKind(code);
  if (kind === "cash") {
    if (evidence.paymentSource && evidence.paymentSource !== "cash") throw new Error("La evidencia no corresponde a la forma de pago en efectivo.");
    if (evidence.terminalApproved || evidence.terminalIndependent || evidence.terminalAuthorization) throw new Error("La evidencia de datáfono requiere una forma de pago con tarjeta.");
    return {paymentSource:"cash",paymentStatus:"confirmed",terminalApproved:false,terminalIndependent:false,terminalAuthorization:null};
  }
  if (kind !== "card") throw new Error("Esta forma de pago requiere conexión a internet y verificación del proveedor. No puede registrarse como aprobada manualmente.");
  if (evidence.paymentSource && evidence.paymentSource !== "external_terminal_manual") throw new Error("La evidencia no corresponde a un datáfono externo.");
  if (!evidence.terminalApproved || !evidence.terminalIndependent || !evidence.terminalAuthorization?.trim()) throw new Error("Confirma que el datáfono independiente aprobó el cobro e ingresa su código de autorización.");
  return {paymentSource:"external_terminal_manual",paymentStatus:"confirmed",terminalApproved:true,terminalIndependent:true,terminalAuthorization:evidence.terminalAuthorization.trim()};
}

export type PendingTransferEvidence = {paymentSource:"bank_transfer_pending";paymentStatus:"pending_verification";terminalApproved:false;terminalIndependent:false;terminalAuthorization:null};
export function preparePosPayment(code:string,raw:unknown): ConfirmedPaymentEvidence | PendingTransferEvidence {
  const evidence=manualPaymentEvidenceSchema.parse(raw);
  if(evidence.paymentSource!=="bank_transfer_pending")return confirmManualPayment(code,raw);
  if(!["TRA","TRANSFERENCIA"].includes(code.trim().toUpperCase()) || evidence.terminalApproved || evidence.terminalIndependent || evidence.terminalAuthorization)throw new Error("La solicitud pendiente requiere una forma de transferencia bancaria sin aprobación de datáfono.");
  z.object({referencia:z.string().trim().min(1,"Ingresa la referencia de la transferencia.").max(180)}).parse(raw);
  return {paymentSource:"bank_transfer_pending",paymentStatus:"pending_verification",terminalApproved:false,terminalIndependent:false,terminalAuthorization:null};
}

/** Receivables are not money received; both runtimes use the same allocation. */
export function saleSettlement(total:number,esCredito:boolean,payments:Array<{monto:number;paymentStatus?:string}>){
  const money=(value:number)=>Math.round(value*100)/100;
  if(esCredito&&payments.length)throw new Error("Una venta al crédito no puede incluir pagos confirmados.");
  const pending=money(payments.filter((payment)=>payment.paymentStatus==="pending_verification").reduce((sum,payment)=>sum+payment.monto,0));
  const confirmed=money(payments.filter((payment)=>payment.paymentStatus!=="pending_verification").reduce((sum,payment)=>sum+payment.monto,0));
  if(!esCredito&&Math.abs(money(pending+confirmed)-money(total))>0.01)throw new Error("El total de pagos y transferencias pendientes debe coincidir con el total de la venta.");
  return {pending,confirmed,receivable:esCredito?money(total):pending};
}
