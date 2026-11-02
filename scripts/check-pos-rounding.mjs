import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";

export async function checkPosRounding({db,s,sql,user,branch,warehouse,method,cardMethod}) {
 const {executeBusinessAction}=await import('../lib/business-action.ts');
 const {procesarVenta}=await import('../lib/actions/ventas.ts');
 const {posSaleAmounts}=await import('../lib/pos-money.ts');
 const [tax]=await db.insert(s.impuestos).values({empresaId:user.empresaId,codigo:'IVA-ROUNDING-QA',nombre:'IVA redondeo QA',tasa:'0.15'}).returning({id:s.impuestos.id});
 const product=randomUUID();
 await db.insert(s.productos).values({id:product,empresaId:user.empresaId,sku:'POS-ROUNDING-QA',nombre:'Redondeo POS QA',precioBase:'46.08',costoPromedio:'12.3456',impuestoId:tax.id});
 await db.insert(s.existencias).values({empresaId:user.empresaId,productoId:product,almacenId:warehouse,cantidad:'100'});
 const input={sucursalId:branch,almacenId:warehouse,items:[{productoId:product,cantidad:1,precioUnitario:46.08,descuento:0,impuesto:6.912,costoUnitario:12.3456}],pagos:[{formaPagoId:method,monto:52.99}],esCredito:false,descuentoGlobal:0};
 // Direct web service, with the authenticated server context; no Desktop adapter.
 const web=(value)=>executeBusinessAction(user,()=>procesarVenta(value));
 const first=await web(input);assert.equal(first.ok,true,first.error);
 async function assertDocument(result,total,expectedTax){
  const [saved]=await db.execute(sql`select v.total,v.impuesto,v.asiento_id,f.snapshot,(select sum(monto) from pagos_venta where venta_id=v.id) as paid,(select sum(debe-haber) from asiento_partidas where asiento_id=v.asiento_id) as difference from ventas v join facturas f on f.venta_id=v.id where v.id=${result.ventaId}::uuid`);
  assert.equal(Number(saved.total),total);assert.equal(Number(saved.impuesto),expectedTax);assert.equal(Number(saved.paid),total);assert.equal(Number(saved.difference),0);assert.equal(saved.snapshot.total,total);assert.equal(saved.snapshot.impuesto,expectedTax);
  const [line]=await db.execute(sql`select costo_unitario,impuesto from venta_detalle where venta_id=${result.ventaId}::uuid`);assert.equal(Number(line.costo_unitario),12.3456);assert.equal(Number(line.impuesto),expectedTax);
 }
 await assertDocument(first,52.99,6.91);
 const mixed=await web({...input,pagos:[{formaPagoId:method,monto:50},{formaPagoId:cardMethod,monto:2.99,paymentSource:'external_terminal_manual',terminalApproved:true,terminalIndependent:true,terminalAuthorization:'ROUNDING-CARD-QA'}]});assert.equal(mixed.ok,true,mixed.error);await assertDocument(mixed,52.99,6.91);
 const discounted=await web({...input,descuentoGlobal:1,pagos:[{formaPagoId:method,monto:51.99}]});assert.equal(discounted.ok,true,discounted.error);await assertDocument(discounted,51.99,6.91);
 const before=[...await db.execute(sql`select (select count(*) from ventas where empresa_id=${user.empresaId}::uuid) as sales,(select count(*) from pagos_venta p join ventas v on v.id=p.venta_id where v.empresa_id=${user.empresaId}::uuid) as payments,(select cantidad from existencias where empresa_id=${user.empresaId}::uuid and producto_id=${product}::uuid and almacen_id=${warehouse}::uuid) as stock`)];
 const rejected=await web({...input,pagos:[{formaPagoId:method,monto:52.98}]});assert.equal(rejected.ok,false);assert.match(rejected.error,/coincidir/);
 assert.deepEqual([...await db.execute(sql`select (select count(*) from ventas where empresa_id=${user.empresaId}::uuid) as sales,(select count(*) from pagos_venta p join ventas v on v.id=p.venta_id where v.empresa_id=${user.empresaId}::uuid) as payments,(select cantidad from existencias where empresa_id=${user.empresaId}::uuid and producto_id=${product}::uuid and almacen_id=${warehouse}::uuid) as stock`)],before,'Un centavo faltante no altera ventas, pagos ni inventario');
 const fractionalItems=[{...input.items[0],cantidad:0.3333,precioUnitario:3.1415,impuesto:0.15706}];
 const fractionalTotal=posSaleAmounts(fractionalItems).total;
 const fractional=await web({...input,items:fractionalItems,pagos:[{formaPagoId:method,monto:fractionalTotal}]});assert.equal(fractional.ok,true,fractional.error);await assertDocument(fractional,1.21,0.16);
 console.log(JSON.stringify({webCash5299:'passed',webMixedRounding:'passed',globalDiscountBalanced:'passed',fractionalQuantityAndCosts:'passed',realUnderpaymentRollback:'passed',invoicePaymentLedgerAgree:'passed'}));
}
