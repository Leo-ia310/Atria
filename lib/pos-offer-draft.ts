import {commercialDraftSchema,type CommercialDraft,type CommercialKind} from "./commercial-core";
export const posOfferKey=(context:string,kind:CommercialKind)=>`arca:pos-offer:${context}:${kind}`;
export function posOfferDraft(sucursalId:string,clienteId:string|null,items:Array<{producto:{id:string;precio:number;impuestoTasa:number};cantidad:number;descuento:number}>,moneda:string="NIO"):CommercialDraft{
  if(!["NIO","USD"].includes(moneda))throw Error("La moneda del POS todavía no está disponible para cotizaciones/proformas.");
  return commercialDraftSchema.parse({sucursalId,clienteId,fecha:new Date().toLocaleDateString("sv-SE"),vigenteHasta:null,moneda,condicionesPago:"",condicionesComerciales:"",observaciones:"",items:items.map(i=>({productoId:i.producto.id,cantidad:i.cantidad,precioUnitario:i.producto.precio,descuento:i.descuento,tasa:i.producto.impuestoTasa}))});
}
export function stagePosOffer(storage:Pick<Storage,"getItem"|"setItem">,context:string,kind:CommercialKind,draft:CommercialDraft){
  const key=posOfferKey(context,kind),previous=storage.getItem(key);
  if(previous){try{if(JSON.parse(previous).expiresAt>Date.now())throw Error("Ya tienes productos del POS pendientes en este formulario. Ábrelo antes de enviar otro carrito.");}catch(e){if(e instanceof Error&&e.message.startsWith("Ya tienes"))throw e;}}
  storage.setItem(key,JSON.stringify({expiresAt:Date.now()+86400000,draft}));
}
