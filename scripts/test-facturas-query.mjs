import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import Module from "node:module";
import EmbeddedPostgres from "embedded-postgres";

// Isolated schema projection: actual Drizzle queries and PostgreSQL enum, no .env.
const originalLoad=Module._load;
Module._load=function(name,...args){return name==='server-only'?{}:originalLoad.call(this,name,...args);};
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'arca-facturas-query-'));
const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const cluster=new EmbeddedPostgres({databaseDir:path.join(directory,'cluster'),user:'postgres',password:'isolated-test-only',port,persistent:true,createPostgresUser:false,initdbFlags:['--locale=C','--encoding=UTF8'],postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
let disconnect;
try{
 await cluster.initialise();await cluster.start();await cluster.createDatabase('facturas_tests');
 const url=`postgresql://postgres:isolated-test-only@127.0.0.1:${port}/facturas_tests`;
 Object.assign(process.env,{DATABASE_URL:url,DATABASE_POOL_URL:url,ARCA_TEST_DATABASE_URL:url,NODE_ENV:'test',UPSTASH_REDIS_REST_URL:'',UPSTASH_REDIS_REST_TOKEN:''});
 const [{db,disconnectIsolatedTestDatabase},{sql,and,eq,inArray},{facturas,ventas,cxcEstadoEnum},{consultarResumenFacturas},{facturaTieneSaldo},{RECURSOS}]=await Promise.all([
  import('../lib/db/index.ts'),import('drizzle-orm'),import('../lib/db/schema.ts'),import('../lib/factura-summary.ts'),import('../lib/factura-settlement.ts'),import('../lib/excel/recursos.ts')]);
 disconnect=disconnectIsolatedTestDatabase;
 const enumValues=cxcEstadoEnum.enumValues.map(value=>`'${value.replaceAll("'","''")}'`).join(',');
 await db.execute(sql.raw(`CREATE TYPE cxc_estado AS ENUM (${enumValues});
 CREATE TABLE ventas(id uuid PRIMARY KEY,empresa_id uuid,sucursal_id uuid);
 CREATE TABLE sucursales(id uuid PRIMARY KEY,nombre text);
 CREATE TABLE facturas(id uuid PRIMARY KEY,empresa_id uuid,venta_id uuid,es_credito boolean,total numeric(18,4),numero text,fecha timestamptz DEFAULT now(),cliente_nombre text,vendedor_nombre text,vendedor_id uuid,formas_pago text);
 CREATE TABLE cuentas_por_cobrar(id uuid PRIMARY KEY,empresa_id uuid,venta_id uuid,saldo numeric(18,4),estado cxc_estado,fecha_vencimiento date);`));
 // The former production predicate fails even with no matching rows.
 await assert.rejects(db.execute(sql`select 'pendiente'::cxc_estado not in ('anulada','cancelada')`),error=>error.code==='22P02');
 const empresa=randomUUID(),foreign=randomUUID(),branch=randomUUID(),otherBranch=randomUUID();
 await db.execute(sql`insert into sucursales values(${branch}::uuid,'Principal'),(${otherBranch}::uuid,'Otra')`);
 const ids=[];
 for(const [index,total,credit,state,balance,sucursal,tenant] of [
  [1,10,false,null,0,branch,empresa],[2,20,false,'pendiente',20,branch,empresa],
  [3,30,true,'parcial',15,branch,empresa],[4,40,true,'incobrable',40,branch,empresa],
  [5,50,false,'pagada',0,branch,empresa],[6,60,false,'vencida',60,branch,empresa],
  [7,70,false,null,0,otherBranch,empresa],[8,1000,false,null,0,branch,foreign]
 ]){
  const sale=randomUUID(),invoice=randomUUID();ids[index]=invoice;
  await db.execute(sql`insert into ventas values(${sale}::uuid,${tenant}::uuid,${sucursal}::uuid)`);
  await db.execute(sql`insert into facturas(id,empresa_id,venta_id,es_credito,total,numero) values(${invoice}::uuid,${tenant}::uuid,${sale}::uuid,${credit},${total},${`F-${index}`})`);
  if(state)await db.execute(sql`insert into cuentas_por_cobrar(id,empresa_id,venta_id,saldo,estado) values(${randomUUID()}::uuid,${tenant}::uuid,${sale}::uuid,${balance},${state}::cxc_estado)`);
  if(index===1)await db.execute(sql`insert into cuentas_por_cobrar(id,empresa_id,venta_id,saldo,estado) values(${randomUUID()}::uuid,${foreign}::uuid,${sale}::uuid,999,'pendiente')`);
 }
 const summary=await consultarResumenFacturas(db,empresa,[branch]);
 const balances=await db.select({id:facturas.id,hasBalance:facturaTieneSaldo()}).from(facturas).where(eq(facturas.empresaId,empresa));
 assert.equal(balances.find(row=>row.id===ids[4]).hasBalance,true,'La deuda incobrable no equivale a un pago recibido');
 assert.equal(balances.find(row=>row.id===ids[1]).hasBalance,false,'Una deuda de otra empresa no afecta la factura');
 assert.equal(summary.resumenRows.reduce((n,row)=>n+row.cantidad,0),6);
 assert.equal(summary.porCobrar.cantidad,2);assert.equal(Number(summary.porCobrar.total),80);
 const cash=summary.resumenRows.find(row=>!row.esCredito);assert.equal(cash.cantidad-summary.porCobrar.cantidad,2);assert.equal(Number(cash.total)-Number(summary.porCobrar.total),60);
 const list=await db.select({id:facturas.id}).from(facturas).leftJoin(ventas,eq(ventas.id,facturas.ventaId)).where(and(eq(facturas.empresaId,empresa),eq(facturas.esCredito,false),inArray(ventas.sucursalId,[branch]),sql`not (${facturaTieneSaldo()})`));
 assert.deepEqual(list.map(row=>row.id).sort(),[ids[1],ids[5]].sort());
 const context={user:{empresaId:empresa},empresa:null,pais:'NI',zonaHoraria:'America/Managua',sucursalIds:[branch],params:new URLSearchParams()};
 const exported=await RECURSOS['facturas-cobradas'].query(context);assert.deepEqual(exported.map(row=>row.numero).sort(),['F-1','F-5']);
 const credit=await RECURSOS['facturas-credito'].query(context);assert.deepEqual(credit.map(row=>row.numero).sort(),['F-3','F-4']);
 const empty=await consultarResumenFacturas(db,empresa,[]);assert.equal(empty.resumenRows.length,0);assert.equal(empty.porCobrar.cantidad,0);
 const all=await consultarResumenFacturas(db,empresa,null);assert.equal(all.resumenRows.reduce((n,row)=>n+row.cantidad,0),7);
 console.log(JSON.stringify({reproducedInvalidEnum:'22P02',invoiceDashboardQuery:'passed',paidInvoiceList:'passed',invoiceExcelQueries:'passed',uncollectibleNotPaid:'passed',tenantAndBranchScope:'passed',emptyBranchScope:'passed'}));
}finally{
 if(disconnect)await disconnect();
 if(process.platform==='win32')await new Promise(resolve=>{const stop=spawn(path.resolve('node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe'),['-D',path.join(directory,'cluster'),'-m','fast','-w','stop'],{windowsHide:true,stdio:'ignore'});stop.on('error',resolve);stop.on('close',resolve);});
 else await cluster.stop();
}
