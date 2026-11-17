"use client";
import {ReceivableWorkspace,type ReceivableTransport} from './ReceivableWorkspace';
import {webDocumentCommand} from './WebDocuments';
export const webReceivableCommand:ReceivableTransport=async command=>{const r=await fetch('/api/receivables',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),cache:'no-store'});if(r.status>=500)throw new Error('Sin confirmación. Recupera el mismo intento.');return r.json();};
export function WebReceivables(p:{contextId:string;branches:Array<{id:string;nombre:string}>;saleId?:string}){return <ReceivableWorkspace {...p} send={webReceivableCommand} documentSend={webDocumentCommand}/>;}
