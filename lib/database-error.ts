/** Pure error classification: SQL and bound parameters never belong in public messages. */
export function databaseErrorCode(error:unknown):string|undefined{
 const seen=new Set<unknown>();let current=error;
 for(let depth=0;depth<10&&current&&typeof current==="object"&&!seen.has(current);depth++){
  seen.add(current);const value=current as {code?:unknown;cause?:unknown};
  if(typeof value.code==="string"&&/^(?=.*[0-9])[0-9A-Z]{5}$/.test(value.code))return value.code;
  current=value.cause;
 }
}
export function safeErrorMessage(error:unknown,fallback="No se pudo completar la operación."):string{
 const code=databaseErrorCode(error);
 if(code)return ["42P01","42703"].includes(code)?"ARCA Cloud necesita actualizar su esquema de datos. Contacta al administrador.":fallback;
 if(error instanceof Error){
  if(error.name==="DrizzleQueryError"||error.message.includes("Failed query:")||("query" in error&&"params" in error))return fallback;
  return error.message;
 }
 return fallback;
}
