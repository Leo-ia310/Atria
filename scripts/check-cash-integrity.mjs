import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {inAuthenticatedUserContext}=require("../lib/authenticated-user-context.ts");
const {abrirSesion,cerrarSesion}=require("../lib/actions/caja.ts");
const {revisarIncidenciaCaja}=require("../lib/actions/caja-integrity.ts");

export async function checkCashIntegrity({db,s,sql,user,branch,warehouse,product,method,cardMethod,account,day,op,applyDesktopOperation,device1,device2,customerId,supplierId}) {
  const box=randomUUID();
  await db.insert(s.cajas).values({id:box,empresaId:user.empresaId,sucursalId:branch,codigo:"CASH-INTEGRITY",nombre:"Caja integridad"});
  const web=fn=>inAuthenticatedUserContext(user,fn);
  const [a,b]=await Promise.all([web(()=>abrirSesion({cajaId:box,montoInicial:20})),web(()=>abrirSesion({cajaId:box,montoInicial:20}))]);
  assert.equal(a.ok,true);assert.deepEqual(b,a);
  const sessionId=a.sesionId;
  const [openCount]=await db.execute(sql`select count(*)::int as n from sesiones_caja where caja_id=${box}::uuid and estado='abierta'`);
  assert.equal(openCount.n,1);
  const sale=(payments,extra={})=>op("venta",{sesionCajaId:sessionId,sucursalId:branch,almacenId:warehouse,fecha:new Date().toISOString(),
    esCredito:false,lines:[{productoId:product,cantidad:1,precioUnitario:10,costoUnitario:4,impuesto:0,descuento:0}],payments,...extra});
  const cash=sale([{formaPagoId:method,monto:10}]);
  const card=sale([{formaPagoId:cardMethod,monto:10,paymentSource:"external_terminal_manual",terminalApproved:true,terminalIndependent:true,terminalAuthorization:"QA-CASH-CARD"}]);
  const mixed=sale([{formaPagoId:method,monto:4},{formaPagoId:cardMethod,monto:6,paymentSource:"external_terminal_manual",terminalApproved:true,terminalIndependent:true,terminalAuthorization:"QA-CASH-MIXED"}]);
  await Promise.all([applyDesktopOperation(user,device1,[branch],cash),applyDesktopOperation(user,device2,[branch],card),applyDesktopOperation(user,device1,[branch],mixed)]);
  const credit=sale([],{esCredito:true,clienteId:customerId,diasCredito:30});
  await applyDesktopOperation(user,device1,[branch],credit);
  const [cxc]=await db.execute(sql`select id from cuentas_por_cobrar where venta_id=${credit.entityId}::uuid`);
  const abono=op("abono_cliente",{cxcId:cxc.id,formaPagoId:method,monto:3,fecha:day+"T12:00:00.000Z",sesionCajaId:sessionId});
  await applyDesktopOperation(user,device1,[branch],abono);
  const purchase=op("compra",{proveedorId:supplierId,almacenId:warehouse,fecha:day+"T12:00:00.000Z",esCredito:true,impuesto:0,lines:[{productoId:product,cantidad:1,costoUnitario:4}]});
  await applyDesktopOperation(user,device1,[branch],purchase);
  const [cxp]=await db.execute(sql`select id from cuentas_por_pagar where compra_id=${purchase.entityId}::uuid`);
  const payment=op("pago_proveedor",{cxpId:cxp.id,cuentaFinancieraId:account,monto:2,fecha:day+"T12:00:00.000Z",sesionCajaId:sessionId});
  await applyDesktopOperation(user,device1,[branch],payment);
  const [category]=await db.execute(sql`select nombre from categorias_gasto where empresa_id=${user.empresaId}::uuid and activa=true limit 1`);
  const expense=op("gasto",{sesionCajaId:sessionId,categoria:category.nombre,cuentaId:account,fecha:new Date().toISOString(),descripcion:"Gasto turno QA",monto:4});
  await applyDesktopOperation(user,device1,[branch],expense);
  async function move(tipo,monto,ventaId) {
    const entry=op("caja_movimiento",{sesionId:sessionId,tipo,monto,motivo:"Soporte QA",ventaId,fecha:new Date().toISOString()});
    await applyDesktopOperation(user,device1,[branch],entry);await applyDesktopOperation(user,device1,[branch],entry);
    return entry;
  }
  await move("entrada",5);await move("retiro",2);await move("salida",1);await move("devolucion",2,cash.entityId);
  const tooMuch=op("caja_movimiento",{sesionId:sessionId,tipo:"devolucion",monto:9,motivo:"Exceso QA",ventaId:cash.entityId,fecha:new Date().toISOString()});
  await assert.rejects(applyDesktopOperation(user,device1,[branch],tooMuch),/efectivo|reintegro/);
  const delayed=sale([{formaPagoId:method,monto:10}]);
  const close1=op("sesion_caja",{totalDeclarado:31,cierreEn:new Date().toISOString()},"update",sessionId);
  const close2=op("sesion_caja",{totalDeclarado:32,cierreEn:new Date().toISOString()},"update",sessionId);
  await Promise.all([applyDesktopOperation(user,device1,[branch],close1),applyDesktopOperation(user,device2,[branch],close2)]);
  const [closed]=await db.execute(sql`select * from sesiones_caja where id=${sessionId}::uuid`);
  assert.equal(Number(closed.monto_final_esperado),31,"Solo efectivo y movimientos vinculados");
  assert.ok([31,32].includes(Number(closed.monto_final_real)));
  const next=await web(()=>abrirSesion({cajaId:box,montoInicial:0}));
  assert.equal(next.ok,true);
  await applyDesktopOperation(user,device2,[branch],delayed);
  await applyDesktopOperation(user,device2,[branch],delayed);
  const [saved]=await db.execute(sql`select sesion_caja_id,usuario_id from ventas where id=${delayed.entityId}::uuid`);
  assert.equal(saved.sesion_caja_id,sessionId);
  assert.equal(saved.usuario_id,user.id);
  const [after]=await db.execute(sql`select * from sesiones_caja where id=${sessionId}::uuid`);
  assert.deepEqual(after,closed,"El cierre histórico se conserva");
  const [audit]=await db.execute(sql`select device_id from caja_movimientos where origen_tipo='venta' and origen_id=${delayed.entityId}::uuid`);
  assert.equal(audit.device_id,device2);
  const reviews=await db.execute(sql`select id from caja_revisiones where sesion_id=${sessionId}::uuid and resuelta_en is null`);
  assert.equal(reviews.length,2,"Conteo alternativo y venta tardía registrados");
  const reviewed=await web(()=>revisarIncidenciaCaja({id:reviews[0].id,resolucion:"Soporte revisado por administrador QA."}));
  assert.equal(reviewed.ok,true);
  await web(()=>revisarIncidenciaCaja({id:reviews[0].id,resolucion:"No debe sobrescribir la resolución."}));
  const [finalReview]=await db.execute(sql`select resolucion from caja_revisiones where id=${reviews[0].id}::uuid`);
  assert.equal(finalReview.resolucion,"Soporte revisado por administrador QA.");
  const wrong=sale([{formaPagoId:method,monto:10}],{sesionCajaId:randomUUID()});
  await assert.rejects(applyDesktopOperation(user,device1,[branch],wrong),/Turno/);
  const legacy=sale([{formaPagoId:method,monto:10}]);delete legacy.payload.sesionCajaId;
  await assert.rejects(applyDesktopOperation(user,device1,[branch],legacy),/turno original/,"Varios turnos coincidentes no se adivinan");
  const mismatchedClose=op("sesion_caja",{totalDeclarado:0,esperadoEfectivo:7,cierreEn:new Date().toISOString()},"update",next.sesionId);
  await applyDesktopOperation(user,device1,[branch],mismatchedClose);
  await applyDesktopOperation(user,device1,[branch],mismatchedClose);
  const [offlineReview]=await db.execute(sql`select count(*)::int as n from caja_revisiones where sesion_id=${next.sesionId}::uuid`);
  assert.equal(offlineReview.n,1,"La discrepancia del cierre offline requiere revisión sin duplicarse");
  const [closeAudit]=await db.execute(sql`select detalle from caja_movimientos where sesion_id=${next.sesionId}::uuid and origen_tipo='cierre'`);
  assert.equal(closeAudit.detalle.esperadoLocal,7);assert.equal(closeAudit.detalle.declarado,0);
  const otherBox=randomUUID();
  await db.insert(s.cajas).values({id:otherBox,empresaId:user.empresaId,sucursalId:branch,codigo:"CASH-REFUND",nombre:"Caja reintegros QA"});
  const refundTurns=await Promise.all([web(()=>abrirSesion({cajaId:box,montoInicial:10})),web(()=>abrirSesion({cajaId:otherBox,montoInicial:10}))]);
  const refunds=refundTurns.map(turn=>op("caja_movimiento",{sesionId:turn.sesionId,tipo:"devolucion",monto:5,motivo:"Reintegro concurrente QA",ventaId:cash.entityId,fecha:new Date().toISOString()}));
  const refundResults=await Promise.allSettled(refunds.map((entry,i)=>applyDesktopOperation(user,i?device2:device1,[branch],entry)));
  assert.equal(refundResults.filter(result=>result.status==='fulfilled').length,1,"Dos cajas no pueden reintegrar más efectivo que el cobrado");
  for(const turn of refundTurns)await web(()=>cerrarSesion({sesionId:turn.sesionId,montoFinalReal:0}));
  await db.execute(sql`create role qa_cash_reader nologin`);
  await db.execute(sql`grant usage on schema public to qa_cash_reader`);
  await db.execute(sql`grant select on caja_movimientos,caja_revisiones to qa_cash_reader`);
  await db.transaction(async tx=>{
    await tx.execute(sql`set local role qa_cash_reader`);
    await tx.execute(sql`select set_config('app.empresa_id',${user.empresaId},true)`);
    const [own]=await tx.execute(sql`select count(*)::int as n from caja_movimientos`);assert.ok(own.n>0);
    await tx.execute(sql`select set_config('app.empresa_id',${randomUUID()},true)`);
    for(const table of ['caja_movimientos','caja_revisiones']){
      const [foreign]=await tx.execute(sql.raw(`select count(*)::int as n from ${table}`));assert.equal(foreign.n,0);
    }
  });
  console.log(JSON.stringify({cashCardAndMixedCorrect:true,cashCollectionExpenseAndSupplierPayment:true,
    cashWithdrawalAndRefundIdempotent:true,singlePhysicalSessionConcurrentOpen:true,
    concurrentClosePreservesOriginal:true,lateSaleKeepsOriginalSession:true,lateSaleReview:true,
    supervisorReviewAudit:true,legacyAmbiguousSessionRejected:true,cashTenantRls:true,offlineCloseOriginalComparison:true,concurrentRefundBound:true}));
}
