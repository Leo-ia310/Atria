import { z } from "zod";
export const resolveTransferSchema=z.object({id:z.string().uuid(),expectedVersion:z.number().int().nonnegative(),decision:z.enum(["verify","reject"]),bankReference:z.string().trim().max(180).default(""),bankReceiptConfirmed:z.boolean().default(false),reason:z.string().trim().max(500).default("")}).superRefine((value,ctx)=>{
  if(value.decision==="verify"&&(!value.bankReceiptConfirmed||!value.bankReference))ctx.addIssue({code:z.ZodIssueCode.custom,message:"Confirma el abono real en el banco e ingresa su referencia."});
  if(value.decision==="reject"&&!value.reason)ctx.addIssue({code:z.ZodIssueCode.custom,message:"Indica el motivo del rechazo."});
});
export type ResolveTransferInput=z.infer<typeof resolveTransferSchema>;
export type PendingTransfer={id:string;empresaId:string;sucursalId:string;ventaId:string;clienteNombre?:string|null;numeroVenta?:string|null;formaPagoId:string;monto:number;referencia:string;status:"pending_verification"|"verified"|"rejected";version:number;bankReference?:string|null;resolutionReason?:string|null;abonoId?:string|null;createdAt:string;synced?:boolean};
