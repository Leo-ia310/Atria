"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import type {PendingTransfer,ResolveTransferInput} from "@/lib/pending-transfer";

export function PendingTransfersPanel({rows,online,onResolve,canResolve=true}:{rows:PendingTransfer[];online:boolean;canResolve?:boolean;onResolve:(input:ResolveTransferInput)=>Promise<{ok:boolean;error?:string}>}){
 const router=useRouter(),[selected,setSelected]=useState<PendingTransfer|null>(null),[reference,setReference]=useState(""),[confirmed,setConfirmed]=useState(false),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[resolved,setResolved]=useState<string[]>([]);
 const pending=rows.filter((row)=>row.status==="pending_verification"&&!resolved.includes(row.id));
 const money=(value:number)=>new Intl.NumberFormat("es",{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
 async function resolve(decision:"verify"|"reject"){
  if(!selected||busy||!online||selected.synced===false||!canResolve)return;
  setBusy(true);setError("");
  try{const result=await onResolve({id:selected.id,expectedVersion:selected.version,decision,bankReference:reference,bankReceiptConfirmed:confirmed,reason});if(!result.ok){setError(result.error||"No se pudo resolver la transferencia.");return;}setResolved((value)=>[...value,selected.id]);setSelected(null);router.refresh();}
  catch(cause){setError(cause instanceof Error?cause.message:"No se pudo contactar el servidor.");}finally{setBusy(false);}
 }
 return <section className="arca-card my-5 p-4 space-y-3">
  <h2 className="text-lg font-semibold">Transferencias por verificar</h2>
  <p className="text-small text-[color:var(--color-text-muted)]">Estas solicitudes no son dinero recibido. El saldo permanece en cuentas por cobrar hasta verificar el abono real en el banco.</p>
  {!online&&<p role="status" className="text-small">Esta operación requiere conexión a internet.</p>}
  {error&&<p role="alert" className="text-small text-[color:var(--color-error)]">{error}</p>}
  {!pending.length?<p className="text-small text-[color:var(--color-text-muted)]">No hay transferencias pendientes en los datos descargados.</p>:<div className="overflow-auto"><table className="w-full text-small"><thead><tr><th className="text-left">Venta / Cliente</th><th className="text-left">Referencia declarada</th><th className="text-right">Importe</th><th>Revisión</th></tr></thead><tbody>{pending.map((row)=><tr key={row.id} className="border-t border-[color:var(--color-border)]"><td className="py-2">{row.numeroVenta||row.ventaId}<div className="text-[11px]">{row.clienteNombre||"Cliente"}</div></td><td>{row.referencia}</td><td className="text-right">{money(row.monto)}</td><td className="text-right"><button type="button" className="arca-btn arca-btn-secondary arca-btn-sm" disabled={!online||row.synced===false||busy||!canResolve} onClick={()=>{setSelected(row);setReference("");setConfirmed(false);setReason("");setError("");}}>{row.synced===false?"Pendiente de sincronizar":"Revisar transferencia"}</button></td></tr>)}</tbody></table></div>}
  {selected&&<div className="rounded-md border border-[color:var(--color-border)] p-4 space-y-3">
   <h3 className="font-semibold">Verificar abono bancario: {money(selected.monto)}</h3>
   <p className="text-small">Revisa el banco antes de confirmar. La referencia declarada por el cliente no es una aprobación del banco.</p>
   <label className="block text-small">Referencia comprobada en el banco<input className="arca-input mt-1" value={reference} onChange={(event)=>setReference(event.target.value)} maxLength={180} disabled={busy}/></label>
   <label className="flex gap-2 text-small"><input type="checkbox" checked={confirmed} onChange={(event)=>setConfirmed(event.target.checked)} disabled={busy}/>Confirmo que verifiqué el abono real y su importe en la cuenta bancaria.</label>
   <label className="block text-small">Motivo si se rechaza<textarea className="arca-input mt-1" value={reason} onChange={(event)=>setReason(event.target.value)} maxLength={500} disabled={busy}/></label>
   <div className="flex flex-wrap gap-2"><button type="button" className="arca-btn arca-btn-primary arca-btn-sm" disabled={busy||!online||!confirmed||!reference.trim()} onClick={()=>{void resolve("verify");}}>Confirmar abono bancario</button><button type="button" className="arca-btn arca-btn-secondary arca-btn-sm" disabled={busy||!online||!reason.trim()} onClick={()=>{void resolve("reject");}}>Rechazar transferencia</button><button type="button" className="arca-btn arca-btn-secondary arca-btn-sm" disabled={busy} onClick={()=>setSelected(null)}>Cancelar revisión</button></div>
  </div>}
 </section>;
}
