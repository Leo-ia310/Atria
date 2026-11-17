'use client';
import {DocumentDesigner} from './DocumentDesigner';
import type {DocumentCommand,DocumentResult} from '../../lib/document-design';
export async function webDocumentCommand(c:DocumentCommand):Promise<DocumentResult>{
  const response=await fetch('/api/documents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c),cache:'no-store'});
  if(response.status>=500)throw new Error('Sin confirmación. Recupera el mismo intento.');return response.json();
}
export function WebDocuments({contextId,branches}:{contextId:string;branches:Array<{id:string;nombre:string}>}){return <DocumentDesigner key={contextId} contextId={contextId} branches={branches} send={webDocumentCommand}/>;}
