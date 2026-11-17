import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { procesarVenta } = require("../lib/actions/ventas.ts");
const { registrarCompraRapidaInventarioPorLector } = require("../lib/actions/productos.ts");
const { procesarCompra } = require("../lib/actions/compras.ts");
const { inAuthenticatedUserContext } = require("../lib/authenticated-user-context.ts");
const {recoverWebAttempt}=require('../lib/actions/web-attempt-recovery.ts');

export async function checkWebAttempts({ db, user, branch, branch2, warehouse, product, method, supplierId, day, foreignWarehouse }) {
  const migration = await readFile(new URL("../lib/db/migrations/0027_web_operation_attempts.sql", import.meta.url), "utf8");
  for (const statement of migration.split("--> statement-breakpoint")) await db.execute(sql.raw(statement));
  const sale = { sucursalId: branch, almacenId: warehouse, items: [
    { productoId: product, cantidad: 1, precioUnitario: 10, costoUnitario: 4 },
  ], pagos: [{ formaPagoId: method, monto: 10 }] };
  const purchase = { proveedorId: supplierId, almacenId: warehouse, fecha: day,
    esCredito: true, diasCredito: 30, items: [{ productoId: product, cantidad: 1, costoUnitario: 4 }] };
  const asUser = action => inAuthenticatedUserContext(user, action);
  const snapshot = async () => [...await db.execute(sql`
    select (select count(*) from ventas) as sales, (select count(*) from venta_detalle) as sale_lines,
      (select count(*) from compras) as purchases, (select count(*) from compra_detalle) as purchase_lines,
      (select count(*) from pagos_venta) as payments, (select count(*) from cuentas_por_cobrar) as receivables,
      (select count(*) from cuentas_por_pagar) as payables, (select count(*) from facturas) as receipts,
      (select count(*) from movimientos_inventario) as movements, (select sum(cantidad) from existencias) as stock,
      (select count(*) from asientos_contables) as journals, (select count(*) from asiento_partidas) as entries,
      (select count(*) from web_operation_attempts) as attempts
  `)];
  await db.execute(sql`create function qa_web_failure() returns trigger language plpgsql as
    $$ begin raise exception 'qa forced late failure'; end; $$`);
  const saleKey = randomUUID(), purchaseKey = randomUUID();
  for (const [table, submit] of [
    ["facturas", () => procesarVenta(sale, saleKey)],
    ["asientos_contables", () => procesarVenta(sale, saleKey)],
    ["asientos_contables", () => procesarCompra(purchase, purchaseKey)],
  ]) {
    const before = await snapshot();
    await db.execute(sql`create trigger qa_web_failure before insert on ${sql.identifier(table)}
      for each row execute function qa_web_failure()`);
    try {
      const rejected = await asUser(submit);
      assert.equal(rejected.ok, false);
      assert.deepEqual(await snapshot(), before, `Failure in ${table} rolls back all effects`);
    } finally {
      await db.execute(sql`drop trigger qa_web_failure on ${sql.identifier(table)}`);
    }
  }
  for (const [submit, payload, key, idField, changed] of [
    [procesarVenta, sale, saleKey, "ventaId", { ...sale, notas: "changed" }],
    [procesarCompra, purchase, purchaseKey, "compraId", { ...purchase, notas: "changed" }],
  ]) {
    const [before] = await snapshot();
    const [first, retry] = await Promise.all([
      asUser(() => submit(payload, key)), asUser(() => submit(payload, key)),
    ]);
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.deepEqual(retry, first);
    const confirmed = await snapshot();
    const countField = idField === "ventaId" ? "sales" : "purchases";
    assert.equal(Number(confirmed[0][countField]) - Number(before[countField]), 1);
    assert.equal(Number(confirmed[0].attempts) - Number(before.attempts), 1);
    assert.deepEqual(await asUser(() => submit(payload, key)), first);
    assert.match((await asUser(() => submit(changed, key))).error, /otro intento/);
    assert.deepEqual(await snapshot(), confirmed);
    const separate = await asUser(() => submit(payload, randomUUID()));
    assert.equal(separate.ok, true, JSON.stringify(separate));
    assert.notEqual(separate[idField], first[idField]);
  }
  const barcode = "QA-WEB-ATTEMPT";
  const [priorBarcode] = await db.execute(sql`select codigo_barras from productos where id = ${product}::uuid`);
  await db.execute(sql`update productos set codigo_barras = ${barcode} where id = ${product}::uuid`);
  try {
    const quick = { productoId: product, almacenId: warehouse, proveedorId: supplierId, codigoBarras: barcode, cantidad: 1, costoUnitario: 4 };
    const key = randomUUID();
    const first = await asUser(() => registrarCompraRapidaInventarioPorLector(quick, key));
    assert.equal(first.ok, true, JSON.stringify(first));
    const confirmed = await snapshot();
    assert.deepEqual(await asUser(() => registrarCompraRapidaInventarioPorLector(quick, key)), first);
    assert.deepEqual(await snapshot(), confirmed);
  } finally {
    await db.execute(sql`update productos set codigo_barras = ${priorBarcode.codigo_barras} where id = ${product}::uuid`);
  }
  const beforeDenied = await snapshot();
  const foreign = await asUser(() => procesarVenta({ ...sale, almacenId: foreignWarehouse }, saleKey));
  assert.equal(foreign.ok, false);
  await db.execute(sql`insert into usuario_sucursales (usuario_id, sucursal_id) values (${user.id}::uuid, ${branch2}::uuid)`);
  try {
    const blockedReplay = await asUser(() => procesarVenta(sale, saleKey));
    assert.match(blockedReplay.error, /sucursal no autorizados/);
  } finally {
    await db.execute(sql`delete from usuario_sucursales where usuario_id = ${user.id}::uuid and sucursal_id = ${branch2}::uuid`);
  }
  assert.deepEqual(await snapshot(), beforeDenied);
  await db.execute(sql`create role qa_web_attempt_reader nologin`);
  await db.execute(sql`grant select on web_operation_attempts to qa_web_attempt_reader`);
  await db.transaction(async tx => {
    await tx.execute(sql`set local role qa_web_attempt_reader`);
    const visible = () => tx.execute(sql`select attempt_key from web_operation_attempts where attempt_key = ${saleKey}::uuid`);
    await tx.execute(sql`select set_config('app.empresa_id', ${randomUUID()}, true)`);
    assert.equal((await visible()).length, 0);
    await tx.execute(sql`select set_config('app.empresa_id', ${user.empresaId}, true)`);
    assert.equal((await visible()).length, 1);
  });
  const recovery=await asUser(()=>recoverWebAttempt({kind:'venta',key:saleKey}));
  assert.equal(recovery.state,'confirmed');assert.ok(recovery.result.ventaId);
  const discardedKey=randomUUID();
  assert.equal((await asUser(()=>recoverWebAttempt({kind:'venta',key:discardedKey,discard:true}))).state,'discarded');
  const beforeLate=await snapshot();
  const late=await asUser(()=>procesarVenta(sale,discardedKey));assert.equal(late.ok,false);assert.equal(late.discarded,true);
  assert.deepEqual(await snapshot(),beforeLate,'Una petición que llega después del descarte no crea una venta');
  const confirmedDiscard=await asUser(()=>recoverWebAttempt({kind:'venta',key:saleKey,discard:true}));
  assert.equal(confirmedDiscard.state,'confirmed');
  assert.equal((await inAuthenticatedUserContext({...user,id:randomUUID()},()=>recoverWebAttempt({kind:'venta',key:saleKey}))).ok,false);
  console.log(JSON.stringify({webRecoveryAfterLostResponse:true,webDiscardBlocksLateRequest:true,webConfirmedCannotBeDiscarded:true,webRecoveryUserIsolation:true}));
  console.log(JSON.stringify({ webLateInvoiceRollback: true, webSaleJournalRollback: true,
    webPurchaseJournalRollback: true, webConcurrentRetries: true, webPayloadConflict: true,
    webIdenticalSeparateAttempts: true, webQuickPurchaseRetry: true, webForeignWarehouseDenied: true, webReceiptRls: true }));
}
