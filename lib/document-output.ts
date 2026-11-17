import type {CommercialPdf} from './commercial-pdf';
/** Print trusted raster pages through DOM nodes, never user HTML or remote frames. */
export async function browserDocumentOutput(pdf:CommercialPdf,name:string,print:boolean){
  if(!print){const url=URL.createObjectURL(new Blob([new Uint8Array(pdf.bytes)],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);return;}
  const frame=document.createElement('iframe');frame.style.display='none';document.body.append(frame);const doc=frame.contentDocument;
  if(!doc){frame.remove();throw new Error('No se pudo abrir el área de impresión.');}
  const style=doc.createElement('style');style.textContent=`@page{size:${pdf.format==='carta'?'letter':pdf.format==='media-carta'?'8.5in 5.5in':'80mm 297mm'};margin:0}body{margin:0}img{width:100%;display:block;break-after:page}img:last-child{break-after:auto}`;doc.head.append(style);
  try{await Promise.all(pdf.pages.map(async page=>{const img=doc.createElement('img');img.src=page;doc.body.append(img);await img.decode();}));frame.contentWindow?.print();}
  finally{setTimeout(()=>frame.remove(),120000);}
}
