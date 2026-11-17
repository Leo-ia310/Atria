'use client';
import {useEffect,useState} from 'react';
type Result={ok:true;discarded?:boolean}|{ok:false;error:string};
/** A nonce only in storage; payloads and payment/customer data stay in memory. */
export function useDurableCommand<C extends {requestId:string;action:string},R extends Result>(key:string,send:(c:C)=>Promise<R>){
  const [pending,setPending]=useState<string|null>(null),[retry,setRetry]=useState<C|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{setPending(localStorage.getItem(key));setRetry(null);setError('');},[key]);
  const run=async(c:C):Promise<Extract<R,{ok:true}>|null>=>{
    if(!navigator.locks){setError('Abre ARCA en un contexto seguro.');return null;}
    return navigator.locks.request(key+':lock',{ifAvailable:true},async lock=>{
      if(!lock){setError('Hay un intento activo en otra ventana.');return null;}
      const current=localStorage.getItem(key);if(current&&current!==c.requestId&&c.action!=='recover'){setPending(current);setError('Recupera el intento pendiente antes de iniciar otro.');return null;}
      setBusy(true);setError('');
      try{
        if(c.action!=='recover'){localStorage.setItem(key,c.requestId);setPending(c.requestId);}
        const r=await send(c);if(!r.ok){setError(r.error);if(c.action!=='recover'){localStorage.removeItem(key);setPending(null);}setRetry(null);return null;}
        localStorage.removeItem(key);setPending(null);setRetry(null);if(r.discarded)setError('El intento no estaba confirmado y quedó descartado sin efectos.');return r as Extract<R,{ok:true}>;
      }catch(e){setRetry(c);setError(e instanceof Error?e.message:'Sin confirmación. Recupera el mismo intento.');return null;}
      finally{setBusy(false);}
    });
  };
  return {pending,retry,busy,error,setError,run};
}
