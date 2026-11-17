import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {applyDesktopOperation}=require('../lib/desktop-operations.ts');
const {desktopBootstrap}=require('../lib/desktop-bootstrap.ts');
export async function checkStep6Integrity({db,s,sql,user,branch,device,operation}){
  const before=await db.execute(sql`select (select count(*)::int from ventas) as sales,(select count(*)::int from pagos_venta) as payments,(select sum(cantidad)::text from existencias) as stock`);
  // Legacy receipt replay is enriched from the original document; business effects stay untouched.
  await db.execute(sql`update desktop_operations set result=result-'receipt'-'asientoId' where empresa_id=${user.empresaId}::uuid and idempotency_key=${operation.idempotencyKey}`);
  const recovered=await applyDesktopOperation(user,device,[branch],operation);
  assert.equal(recovered.ventaId,operation.entityId);assert.ok(recovered.asientoId);assert.equal(recovered.receipt.empresaId,user.empresaId);
  assert.deepEqual(await db.execute(sql`select (select count(*)::int from ventas) as sales,(select count(*)::int from pagos_venta) as payments,(select sum(cantidad)::text from existencias) as stock`),before);
  await assert.rejects(applyDesktopOperation(user,randomUUID(),[branch],operation),/idempotencia/);
  await assert.rejects(applyDesktopOperation({...user,id:randomUUID()},device,[branch],operation),/contexto|Contexto|idempotencia/);
  await assert.rejects(applyDesktopOperation(user,device,[],operation),/Sucursal/);
  await assert.rejects(applyDesktopOperation(user,device,[branch],{...operation,empresaId:randomUUID()}),/Contexto/);
  const deniedRole=randomUUID();await db.insert(s.roles).values({id:deniedRole,empresaId:user.empresaId,nombre:'Sin permiso de ventas QA'});
  await db.execute(sql`update usuarios set rol_id=${deniedRole}::uuid where id=${user.id}::uuid`);
  try{
    await assert.rejects(applyDesktopOperation(user,device,[branch],operation));
    const pull=await desktopBootstrap(user,[branch],{deviceId:device,pendingKeys:[operation.idempotencyKey]});
    assert.equal(pull.confirmedOperations.length,0);
  }finally{await db.execute(sql`update usuarios set rol_id=${user.rolId}::uuid where id=${user.id}::uuid`);}
  // Re-run structural provisioning with a legacy snapshot in this isolated database.
  const [invoice]=await db.execute(sql`update facturas set snapshot=snapshot-'fiscal_status' where venta_id=${operation.entityId}::uuid returning id,snapshot`);
  await db.execute(sql`delete from desktop_schema_versions where version=11`);
  delete require.cache[require.resolve('../lib/desktop-schema.ts')];
  await require('../lib/desktop-schema.ts').ensureDesktopSchema();
  const [after]=await db.execute(sql`select snapshot from facturas where id=${invoice.id}::uuid`);
  assert.deepEqual(after.snapshot,invoice.snapshot);assert.equal(after.snapshot.fiscal_status,undefined);
  console.log(JSON.stringify({legacyReceiptRecoveredWithoutEffects:true,receiptTenantUserDeviceScope:true,replayRevokedPermissionDenied:true,pullRevokedPermissionDenied:true,legacyFiscalSnapshotUnchanged:true}));
}
