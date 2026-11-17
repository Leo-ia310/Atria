export const WEB_ATTEMPT_PREFIX='arca:web-attempt:v1:';
export type WebAttemptKind='venta'|'compra'|'compra_lector';
type Pending={key:string;hash:string;createdAt:string};
export type Recovery={ok:boolean;error?:string;state?:'confirmed'|'discarded'|'pending';result?:Record<string,unknown>};
function canonical(value:unknown):unknown{
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>[key,canonical(item)]));
  return value;
}
export const attemptSlot=(company:string,user:string,kind:WebAttemptKind)=>`${WEB_ATTEMPT_PREFIX}${company}:${user}:${kind}`;
export const readWebAttempt=(slot:string):Pending|null=>{
  const text=localStorage.getItem(slot);if(!text)return null;
  const row=JSON.parse(text) as Pending;
  if(!/^[0-9a-f-]{36}$/i.test(row.key)||!/^[0-9a-f]{64}$/.test(row.hash))throw new Error('El intento guardado requiere revisión.');
  return row;
};
export async function withAttemptLock<T>(slot:string,action:()=>Promise<T>):Promise<T>{
  if(!navigator.locks)throw new Error('Este navegador no permite proteger los intentos entre pestañas. Usa una versión actual de Chrome o Edge.');
  return navigator.locks.request(slot,{ifAvailable:true},async lock=>{
    if(!lock)throw new Error('Otra pestaña está procesando este intento. Espera su confirmación.');
    return action();
  });
}
export async function durableWebAttempt<T>(slot:string,kind:WebAttemptKind,input:unknown,send:(input:unknown,key:string)=>Promise<T>,recover:(value:{kind:WebAttemptKind;key:string})=>Promise<Recovery>):Promise<T>{
  return withAttemptLock(slot,async()=>{
    const complete=(result:unknown)=>{
      if(!result||typeof result!=='object'||typeof (result as {ok?:unknown}).ok!=='boolean')return false;
      const value=result as Record<string,unknown>;
      return value.ok===false||typeof value[kind==='venta'?'ventaId':'compraId']==='string';
    };
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(input))));
    const hash=Array.from(new Uint8Array(bytes)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
    let current=readWebAttempt(slot);
    if(current){
      const original=await recover({kind,key:current.key});
      if(!original.ok)throw new Error(original.error??'No se pudo recuperar el intento original.');
      if(original.state==='confirmed'){
        if(!complete(original.result))throw new Error('La confirmación anterior está incompleta. Conservamos el intento para recuperarlo.');
        localStorage.removeItem(slot);window.dispatchEvent(new Event('arca:web-attempt-change'));
        if(current.hash!==hash)throw new Error(`La operación anterior ya fue confirmada (${String(original.result?.numero??original.result?.ventaId??original.result?.compraId)}). Estos datos nuevos no se enviaron; revísalos y confirma otra vez.`);
        return original.result as T;
      }
      if(original.state==='discarded'){localStorage.removeItem(slot);throw new Error('El intento anterior fue descartado. Confirma nuevamente los datos antes de enviar.');}
      if(current.hash!==hash)throw new Error('Existe un envío pendiente. Recupera o descarta explícitamente el intento antes de cambiar sus datos.');
    }else{
      current={key:crypto.randomUUID(),hash,createdAt:new Date().toISOString()};
      localStorage.setItem(slot,JSON.stringify(current));
      window.dispatchEvent(new Event('arca:web-attempt-change'));
    }
    const result=await send(input,current.key);
    if(!complete(result))throw new Error('La respuesta está incompleta. Conservamos el intento para recuperarlo sin duplicar.');
    // A returned business rejection is a confirmed rollback; a transport exception preserves the nonce.
    localStorage.removeItem(slot);window.dispatchEvent(new Event('arca:web-attempt-change'));
    return result;
  });
}
