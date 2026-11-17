"use client";
import {useEffect,useState,useRef} from 'react';
import {useSession} from 'next-auth/react';
import {attemptSlot,readWebAttempt,withAttemptLock,type WebAttemptKind} from '@/lib/web-attempt-client';
import {recoverWebAttempt} from '@/lib/actions/web-attempt-recovery';
const kinds:WebAttemptKind[]=['venta','compra','compra_lector'];
export function WebAttemptRecovery(){
  const {data:session,status}=useSession();
  const [pending,setPending]=useState<WebAttemptKind[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const company=session?.user.empresaId,user=session?.user.id;
  const owner=useRef('');owner.current=company&&user?`${company}:${user}`:'';
  useEffect(()=>{
    const scan=()=>{if(!company||!user){setPending([]);setMessage('');return;}try{setPending(kinds.filter(kind=>readWebAttempt(attemptSlot(company,user,kind))));}catch{setMessage('Un envío guardado requiere revisión antes de continuar.');}};
    scan();window.addEventListener('storage',scan);window.addEventListener('arca:web-attempt-change',scan);
    return()=>{window.removeEventListener('storage',scan);window.removeEventListener('arca:web-attempt-change',scan);};
  },[company,user]);
  if(status!=='authenticated'||!company||!user)return null;
  async function settle(kind:WebAttemptKind,discard=false){
    if(discard&&!window.confirm('¿Descartar este envío si todavía no fue procesado? Si ya se guardó, recuperaremos su resultado.'))return;
    setBusy(true);
    const identity=owner.current;
    try{await withAttemptLock(attemptSlot(company!,user!,kind),async()=>{
      const slot=attemptSlot(company!,user!,kind),attempt=readWebAttempt(slot);if(!attempt)return;
      const response=await recoverWebAttempt({kind,key:attempt.key,discard});
      if(identity!==owner.current)return;
      if(!response.ok)throw new Error(response.error);
      if(response.state==='pending'){setMessage('Todavía no hay confirmación. Reintenta con los datos originales o descarta el envío de forma segura.');return;}
      localStorage.removeItem(slot);window.dispatchEvent(new Event('arca:web-attempt-change'));
      setMessage(response.state==='confirmed'?`Operación anterior confirmada. Referencia: ${String(response.result.numero??response.result.ventaId??response.result.compraId)}`:'Envío descartado. Puedes iniciar una operación nueva.');
    });}catch(error){setMessage(error instanceof Error?error.message:'No se pudo recuperar el envío.');}finally{setBusy(false);}
  }
  return pending.length||message?<aside role="status" className="border-b p-3 text-sm" style={{background:'var(--color-surface)',color:'var(--color-text)'}}>
    {pending.map(kind=><div key={kind}>Hay una {kind==='venta'?'venta':'compra'} pendiente de confirmación. <button disabled={busy} onClick={()=>void settle(kind)}>Recuperar resultado</button> · <button disabled={busy} onClick={()=>void settle(kind,true)}>Descartar envío</button></div>)}
    {message&&<p>{message}</p>}
  </aside>:null;
}
