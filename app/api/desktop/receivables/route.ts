import {z} from 'zod';
import {authorizeDesktop,desktopGrantSchema,DesktopAuthError} from '@/lib/desktop-auth';
import {receivableCommandSchema} from '@/lib/receivable-core';
import {executeReceivables} from '@/lib/receivable-service';
import {boundedJson} from '@/lib/request-json';
import {rateLimit} from '@/lib/redis/rate-limit';
export const runtime='nodejs';export const dynamic='force-dynamic';
const bodySchema=z.object({deviceId:z.string().uuid(),auth:desktopGrantSchema,capability:z.literal('receivables-v1'),command:receivableCommandSchema}).strict();
export async function POST(request:Request){
  const headers={'Cache-Control':'private, no-store'};
  try{const b=bodySchema.parse(await boundedJson(request,420000));const {user,sucursalIds}=await authorizeDesktop(b.auth,b.deviceId);
    const limit=await rateLimit('receivables',`${user.empresaId}:${user.id}:${b.deviceId}`,120,60);if(!limit.permitido)return Response.json({ok:false,error:'Espera antes de reintentar.'},{status:429,headers});
    return Response.json(await executeReceivables(user,b.command,b.deviceId,sucursalIds),{headers});
  }catch(error){return Response.json({ok:false,error:error instanceof DesktopAuthError?error.message:'Solicitud documental inválida.'},{status:error instanceof DesktopAuthError?401:400,headers});}
}
