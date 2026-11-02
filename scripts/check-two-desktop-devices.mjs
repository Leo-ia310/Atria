import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

export async function checkTwoDesktopDevices({db,s,sql,user,branch,warehouse,method,directory}) {
  assert.equal(new URL(process.env.ARCA_TEST_DATABASE_URL).hostname,"127.0.0.1");
  const desktop=path.resolve(process.env.ARCA_DESKTOP_REPO||"../Atria-Desktop");
  assert.equal(JSON.parse(await fs.readFile(path.join(desktop,"package.json"),"utf8")).name,"arca-desktop");
  const password="isolated-two-device-test-password";
  const [existingDevices]=await db.execute(sql`select count(*)::int as n from desktop_devices where empresa_id=${user.empresaId}::uuid`);
  await db.update(s.usuarios).set({passwordHash:await bcrypt.hash(password,10)}).where(sql`id=${user.id}::uuid`);
  const product=randomUUID(),otherProduct=randomUUID();
  await db.insert(s.productos).values([{id:product,empresaId:user.empresaId,sku:"E2E-COCA",nombre:"Coca-Cola E2E",precioBase:"10",costoPromedio:"4"},{id:otherProduct,empresaId:user.empresaId,sku:"E2E-OTHER",nombre:"Otro producto E2E",precioBase:"12",costoPromedio:"5"}]);
  await db.insert(s.existencias).values([{empresaId:user.empresaId,productoId:product,almacenId:warehouse,cantidad:"100"},{empresaId:user.empresaId,productoId:otherProduct,almacenId:warehouse,cantidad:"10"}]);
  const [login,push,pull]=await Promise.all([import("../app/api/desktop/login/route.ts"),import("../app/api/sync/route.ts"),import("../app/api/sync/pull/route.ts")]);
  const server=createServer(async(req,res)=>{
    try {
      const pathname=new URL(req.url,"http://127.0.0.1").pathname;
      if(pathname==="/qa/accounting"&&req.method==="GET") {
        const {saldosPorCuenta,calcularBalanceGeneral,calcularEstadoResultados}=await import("../lib/contabilidad/queries.ts");
        const saldos=await saldosPorCuenta(user.empresaId,undefined,[branch]);
        res.setHeader("content-type","application/json");res.end(JSON.stringify({saldos,balanceGeneral:calcularBalanceGeneral(saldos),resultados:calcularEstadoResultados(saldos)}));return;
      }
      if(pathname==="/qa/reports" && req.method==="GET") {
        const [{rangoReporte,inicioDoceMeses,procesarRentabilidadReporte},{fechaISOEnZona}]=await Promise.all([import("../lib/reportes/core.ts"),import("../lib/dates.ts")]);
        const zone="America/Managua",range=rangoReporte(30,zone);
        const [totals]=await db.execute(sql`select coalesce(sum(total),0)::text as total,coalesce(sum(costo_total),0)::text as costo,count(*)::int as n from ventas where empresa_id=${user.empresaId}::uuid and sucursal_id=${branch}::uuid and estado='completada' and (fecha at time zone ${zone})::date between ${range.desde}::date and ${range.hasta}::date`);
        const daily=await db.execute(sql`select to_char(fecha at time zone ${zone},'YYYY-MM-DD') as fecha,sum(total)::text as total,count(*)::int as count from ventas where empresa_id=${user.empresaId}::uuid and sucursal_id=${branch}::uuid and estado='completada' and (fecha at time zone ${zone})::date between ${range.desde}::date and ${range.hasta}::date group by 1 order by 1`);
        const monthly=await db.execute(sql`select to_char(fecha at time zone ${zone},'YYYY-MM') as periodo,sum(total)::text as ingresos,sum(costo_total)::text as costos,count(*)::int as "cantVentas" from ventas where empresa_id=${user.empresaId}::uuid and sucursal_id=${branch}::uuid and estado='completada' and (fecha at time zone ${zone})::date between ${inicioDoceMeses(fechaISOEnZona(new Date(),zone))}::date and ${range.hasta}::date group by 1 order by 1`);
        const [stockValue]=await db.execute(sql`select coalesce(sum(e.cantidad*p.costo_promedio),0)::text as value from existencias e join almacenes a on a.id=e.almacen_id and a.empresa_id=e.empresa_id join productos p on p.id=e.producto_id and p.empresa_id=e.empresa_id where e.empresa_id=${user.empresaId}::uuid and a.sucursal_id=${branch}::uuid and a.activo=true and p.activo=true and p.eliminado_en is null`);
        res.setHeader("content-type","application/json");res.end(JSON.stringify({total:Number(totals.total),costo:Number(totals.costo),n:totals.n,daily:daily.map((row)=>({...row,total:Number(row.total)})),monthly:procesarRentabilidadReporte([...monthly]),inventory:Number(stockValue.value)}));return;
      }
      if(pathname==="/qa/state" && req.method==="GET") {
        const [state]=await db.execute(sql`with own_sales as (select distinct v.id from ventas v join venta_detalle d on d.venta_id=v.id where v.empresa_id=${user.empresaId}::uuid and d.producto_id in (${product}::uuid,${otherProduct}::uuid))
          select (select count(*)::int from own_sales) as sales,
          (select count(*)::int from pagos_venta where venta_id in(select id from own_sales)) as payments,
          (select coalesce(sum(monto),0)::float from pagos_venta where venta_id in(select id from own_sales)) as paid,
          (select sum(cantidad)::float from existencias where empresa_id=${user.empresaId}::uuid and producto_id=${product}::uuid) as stock,
          (select sum(cantidad)::float from existencias where empresa_id=${user.empresaId}::uuid and producto_id=${otherProduct}::uuid) as "otherStock",
          (select count(*)::int from movimientos_inventario where empresa_id=${user.empresaId}::uuid and producto_id=${product}::uuid) as movements,
          (select coalesce(sum(cantidad),0)::float from movimientos_inventario where empresa_id=${user.empresaId}::uuid and producto_id=${product}::uuid) as "inventoryDelta",
          (select count(*)::int from asientos_contables where empresa_id=${user.empresaId}::uuid and referencia_tabla='ventas' and referencia_id in(select id from own_sales)) as journals,
          (select count(*)::int from ventas where id in(select id from own_sales) and sesion_caja_id is not null) as "cashLinkedSales",
          (select coalesce(sum(p.debe-p.haber),0)::float from asiento_partidas p join asientos_contables a on a.id=p.asiento_id where a.empresa_id=${user.empresaId}::uuid and a.referencia_tabla='ventas' and a.referencia_id in(select id from own_sales) and p.cuenta_id=(select cuenta_contable_id from cuentas_financieras where id=(select cuenta_financiera_id from formas_pago where id=${method}::uuid))) as "cashLedgerTotal",
          (select count(*)::int from clientes where empresa_id=${user.empresaId}::uuid and nombre='Cliente dos dispositivos QA') as "customerCount",
          (select count(*)::int from desktop_devices where empresa_id=${user.empresaId}::uuid) as enrolled`);
        res.setHeader("content-type","application/json");res.end(JSON.stringify(state));return;
      }
      const handler={"/api/desktop/login":login.POST,"/api/sync":push.POST,"/api/sync/pull":pull.POST}[pathname];
      if(req.method!=="POST"||!handler){res.statusCode=404;res.end();return;}
      let body="";for await(const chunk of req)body+=chunk;
      const response=await handler(new Request(`http://127.0.0.1${pathname}`,{method:"POST",headers:{"content-type":"application/json","x-real-ip":"127.0.0.1"},body}));
      res.statusCode=response.status;for(const [key,value] of response.headers)res.setHeader(key,value);res.end(Buffer.from(await response.arrayBuffer()));
    }catch(error){console.error("[isolated-desktop-api]",error);res.statusCode=500;res.end("Isolated test adapter error");}
  });
  await new Promise((resolve)=>server.listen(0,"127.0.0.1",resolve));
  try {
    const address=server.address();assert.ok(address&&typeof address!=="string");
    const config={url:`http://127.0.0.1:${address.port}`,directory:path.join(directory,"desktop-devices"),email:user.email,password,empresaId:user.empresaId,branch,warehouse,product,otherProduct,method,initialDeviceCount:Number(existingDevices.n)};
    const run=(executable,args,env=process.env)=>new Promise((resolve,reject)=>{
      const child=spawn(executable,args,{cwd:desktop,env,windowsHide:true,stdio:["ignore","pipe","pipe"]});let output="";
      child.stdout.on("data",(chunk)=>{output+=chunk});child.stderr.on("data",(chunk)=>{output+=chunk});child.on("error",reject);
      child.on("close",(code)=>code===0?resolve(output):reject(new Error(`Two-device integration failed (${code}): ${output.slice(-6000)}`)));
    });
    await run(process.execPath,[path.join(desktop,"node_modules/vite/bin/vite.js"),"build","--config","vite.integration.config.ts"]);
    const electron=createRequire(import.meta.url)(path.join(desktop,"node_modules/electron"));
    const output=await run(electron,["dist/integration/smoke-two-devices.cjs"],{...process.env,ARCA_TWO_DEVICE_FIXTURE:JSON.stringify(config)});
    console.log(output.trim());
  }finally{await new Promise((resolve)=>server.close(resolve));}
}
