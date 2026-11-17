/** Bound decoded request memory before parsing; callers still validate the command schema. */
export async function boundedJson(request:Request,maxBytes:number):Promise<unknown>{
  if(!request.body)throw new Error('Solicitud vacía.');const reader=request.body.getReader(),decoder=new TextDecoder();let text='',bytes=0;
  try{for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>maxBytes){await reader.cancel();throw new Error('Solicitud demasiado grande.');}text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}
  finally{reader.releaseLock();}
}
export function requestSameOrigin(request:Request){try{const value=request.headers.get('origin');return !!value&&new URL(value).origin===new URL(request.url).origin;}catch{return false;}}
