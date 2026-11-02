import assert from "node:assert/strict";
import test from "node:test";
import { posMoney,posLineAmounts,posSaleAmounts } from "../../lib/pos-money";
import { saleSettlement } from "../../lib/pos-payment";
import { procesarVentaSchema } from "../../lib/validations/ventas";

test("el cobro mostrado como 52,99 no exige 52,992 en contabilidad",()=>{
 const line=posLineAmounts({cantidad:1,precioUnitario:46.08,descuento:0,tasa:0.15});
 assert.deepEqual(line,{subtotal:46.08,descuento:0,impuesto:6.91,total:52.99});
 const totals=posSaleAmounts([{cantidad:1,precioUnitario:46.08,descuento:0,impuesto:6.912}]);
 assert.equal(totals.total,52.99);assert.equal(totals.impuesto,6.91);
 assert.equal(saleSettlement(totals.total,false,[{monto:52.99}]).confirmed,52.99);
});
test("redondea fracciones por línea como el POS offline, antes de sumar",()=>{
 const lines=Array.from({length:20},()=>({cantidad:1,precioUnitario:0.03,...posLineAmounts({cantidad:1,precioUnitario:0.03,descuento:0,tasa:0.15})}));
 assert.equal(posSaleAmounts(lines).total,0.6);assert.equal(posSaleAmounts(lines).impuesto,0);
 assert.equal(posMoney(1.005),1.01);assert.equal(posMoney(2.675),2.68);
});
test("mixto exige el importe exacto en centavos y rechaza un centavo faltante",()=>{
 assert.equal(saleSettlement(52.99,false,[{monto:50},{monto:2.99}]).confirmed,52.99);
 assert.throws(()=>saleSettlement(52.99,false,[{monto:52.98}]),/coincidir/);
 assert.throws(()=>saleSettlement(52.99,false,[{monto:53}]),/coincidir/);
});
test("el descuento global reduce el ingreso contable y conserva balance",()=>{
 const amounts=posSaleAmounts([{cantidad:1,precioUnitario:46.08,descuento:0,impuesto:6.912}],1);
 assert.equal(amounts.total,51.99);assert.equal(amounts.ingresoNeto,45.08);assert.equal(posMoney(amounts.ingresoNeto+amounts.impuesto),amounts.total);
});
test("la frontera servidor normaliza moneda sin perder precisión de precio, cantidad ni costo",()=>{
 const id="11111111-1111-4111-8111-111111111111";
 const input={sucursalId:id,almacenId:id,items:[{productoId:id,cantidad:0.3333,precioUnitario:3.1415,costoUnitario:1.1234,impuesto:0.15706}],pagos:[{formaPagoId:id,monto:1.21}]};
 const parsed=procesarVentaSchema.parse(input);assert.equal(parsed.items[0].impuesto,0.16);assert.equal(parsed.items[0].precioUnitario,3.1415);assert.equal(parsed.items[0].cantidad,0.3333);assert.equal(parsed.items[0].costoUnitario,1.1234);
 assert.equal(procesarVentaSchema.safeParse({...input,pagos:[{formaPagoId:id,monto:0.0001}]}).success,false);
});
