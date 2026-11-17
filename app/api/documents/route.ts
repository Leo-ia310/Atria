import {requireSession} from '@/lib/actions/session-helpers';
import {executeDocuments} from '@/lib/document-service';
import {boundedJson,requestSameOrigin} from '@/lib/request-json';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){
  if(!requestSameOrigin(request))return Response.json({ok:false,error:'Origen no autorizado.'},{status:403});
  try{return Response.json(await executeDocuments(await requireSession(),await boundedJson(request,420000)),{headers:{'Cache-Control':'private, no-store'}});}
  catch{return Response.json({ok:false,error:'Solicitud documental inválida.'},{status:400});}
}
