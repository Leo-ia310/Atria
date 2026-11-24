import {test} from "node:test";
import assert from "node:assert/strict";
import {posOfferDraft,stagePosOffer,posOfferKey} from "../../lib/pos-offer-draft";
const branch="11111111-1111-4111-8111-111111111111",product="22222222-2222-4222-8222-222222222222";
const lines=[{producto:{id:product,precio:52.992,impuestoTasa:0.15},cantidad:2,descuento:3}];
test("POS offer preserves quantities, prices, discounts, tax and currency without changing cart",()=>{
 const original=JSON.stringify(lines),draft=posOfferDraft(branch,null,lines,"USD");
 assert.equal(draft.moneda,"USD");assert.equal(draft.clienteId,null);assert.deepEqual(draft.items,[{productoId:product,cantidad:2,precioUnitario:52.992,descuento:3,tasa:0.15}]);assert.equal(JSON.stringify(lines),original);
 assert.throws(()=>posOfferDraft(branch,null,[],"NIO"));assert.throws(()=>posOfferDraft(branch,null,lines,"HNL"));
});
test("handoff is scoped by company/user and kind and never overwrites a pending transfer",()=>{
 const values=new Map<string,string>();const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 const draft=posOfferDraft(branch,null,lines);stagePosOffer(storage,"company:user","cotizacion",draft);
 const key=posOfferKey("company:user","cotizacion"),first=values.get(key);assert.ok(first);assert.throws(()=>stagePosOffer(storage,"company:user","cotizacion",draft));assert.equal(values.get(key),first);
 assert.notEqual(key,posOfferKey("other:user","cotizacion"));assert.notEqual(key,posOfferKey("company:other","cotizacion"));assert.notEqual(key,posOfferKey("company:user","proforma"));
 assert.ok(JSON.parse(first!).expiresAt<=Date.now()+86400000);
});
test("storage errors do not claim handoff success",()=>{assert.throws(()=>stagePosOffer({getItem:()=>null,setItem:()=>{throw Error("quota");}} as unknown as Storage,"company:user","proforma",posOfferDraft(branch,null,lines)),/quota/);});
