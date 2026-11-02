import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'arca-profit-test-'));
const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const cluster=new EmbeddedPostgres({databaseDir:directory,user:'postgres',password:'isolated-test',port,persistent:true,createPostgresUser:false,initdbFlags:['--locale=C','--encoding=UTF8'],postgresFlags:['-h','127.0.0.1']});
let db;
try {
 await cluster.initialise();await cluster.start();
 db=postgres({host:'127.0.0.1',port,user:'postgres',password:'isolated-test',database:'postgres',max:1});
 await db`create table ventas(fecha timestamptz,total numeric,costo_total numeric)`;
 await db`insert into ventas values ('2026-08-10T12:00:00Z',100,40),('2026-08-11T12:00:00Z',50,20)`;
 await assert.rejects(db`select to_char(fecha at time zone ${'America/Managua'},'YYYY-MM') as periodo,sum(total) from ventas group by to_char(fecha at time zone ${'America/Managua'},'YYYY-MM')`,e=>e.code==='42803');
 const rows=await db`select to_char(fecha at time zone ${'America/Managua'},'YYYY-MM') as periodo,sum(total) as ingresos,sum(costo_total) as costos from ventas group by 1 order by 1`;
 assert.equal(rows.length,1);assert.equal(rows[0].periodo,'2026-08');assert.equal(Number(rows[0].ingresos),150);assert.equal(Number(rows[0].costos),60);
 console.log('PostgreSQL: original grouping failure reproduced; positional grouping totals passed');
} finally {if(db)await db.end();await cluster.stop().catch(()=>{});}
