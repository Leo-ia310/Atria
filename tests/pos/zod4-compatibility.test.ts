import {test} from "node:test";
import assert from "node:assert/strict";
import {z} from "zod";
import {z as previous} from "zod/v3";
import {procesarVentaSchema} from "../../lib/validations/ventas";
import {registroCompletoSchema} from "../../lib/validations/auth";

test("legacy UUID spelling and decimal quantities keep the previous contract",()=>{
 const legacy="11111111-1111-1111-1111-111111111111";
 assert.equal(previous.string().uuid().safeParse(legacy).success,true);
 const sale={sucursalId:legacy,almacenId:legacy,clienteId:legacy,items:[{productoId:legacy,cantidad:"2.5",precioUnitario:25,costoUnitario:18}],pagos:[],esCredito:true,diasCredito:15};
 const parsed=procesarVentaSchema.parse(sale);
 assert.equal(parsed.sucursalId,legacy);assert.equal(parsed.items[0].cantidad,2.5);
 assert.equal(parsed.items[0].descuento,0);assert.equal(parsed.items[0].impuesto,0);
 assert.equal(parsed.descuentoGlobal,0);assert.deepEqual(parsed.pagos,[]);
 assert.equal(procesarVentaSchema.safeParse({...sale,items:[{...sale.items[0],cantidad:-1}]}).success,false);
});
test("string dictionaries preserve dynamic keys, defaults and passthrough values",()=>{
 const input={clientes:[{id:"old-id",importe:"0.0000",extra:{enabled:false}}],unknown:[]};
 assert.deepEqual(z.record(z.string(),z.array(z.record(z.string(),z.unknown()))).parse(input),previous.record(previous.array(previous.record(previous.unknown()))).parse(input));
 for(const value of [undefined,0,"2.5",-1])assert.deepEqual(z.coerce.number().default(0).safeParse(value).success,previous.coerce.number().default(0).safeParse(value).success);
});
test("oversized collections reject and registration retains the terms message",()=>{
 assert.equal(z.array(z.number()).max(1000).safeParse(Array(1001).fill(1)).success,false);
 const terms=registroCompletoSchema.shape.aceptaTerminos.safeParse(false);
 assert.equal(terms.success,false);
 if(!terms.success)assert.match(terms.error.issues[0].message,/Debes aceptar/);
});
