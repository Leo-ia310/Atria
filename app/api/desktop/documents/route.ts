import {z} from 'zod';
import {authorizeDesktop,desktopGrantSchema,DesktopAuthError} from '@/lib/desktop-auth';
import {documentCommandSchema} from '@/lib/document-design';
import {executeDocuments} from '@/lib/document-service';
import {boundedJson} from '@/lib/request-json';
import {rateLimit} from '@/lib/redis/rate-limit';
export const runtime='nodejs';export const dynamic='force-dynamic';
const bodySchema=z.object({deviceId:z.string().uuid(),auth:desktopGrantSchema,capability:z.literal('documents-v1'),command:documentCommandSchema}).strict();
export async function POST(request:Request){
  const headers={'Cache-Control':'private, no-store'};
  try{const b=bodySchema.parse(await boundedJson(request,420000));const {user,sucursalIds}=await authorizeDesktop(b.auth,b.deviceId);
    const limit=await rateLimit('documents',`${user.empresaId}:${user.id}:${b.deviceId}`,120,60);if(!limit.permitido)return Response.json({ok:false,error:'Espera antes de reintentar.'},{status:429,headers});
    return Response.json(await executeDocuments(user,b.command,b.deviceId,sucursalIds),{headers});
  }catch(error){return Response.json({ok:false,error:error instanceof DesktopAuthError?error.message:'Solicitud documental inválida.'},{status:error instanceof DesktopAuthError?401:400,headers});}
}
