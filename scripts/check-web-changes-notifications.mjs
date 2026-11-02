import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadNotificationBranches } from "../lib/layout-notification-query.ts";
import { readWebChanges } from "../lib/web-changes.ts";
import {
  sumarDiasIso,
  normalizarPoliticasNegocio,
} from "../lib/politicas-negocio.ts";
export async function checkWebChangesNotifications({
  db,
  s,
  sql,
  user,
  branch,
  branch2,
  product,
  supplierId,
  customerId,
  desktopBootstrap,
  device1,
}) {
  assert.equal(
    new URL(process.env.ARCA_TEST_DATABASE_URL).hostname,
    "127.0.0.1",
  );
  const empresaId = user.empresaId,
    today = new Date().toISOString().slice(0, 10),
    cutoff = sumarDiasIso(today, -5);
  const load = (
    branches = [branch],
    cxc = true,
    cxp = true,
    hr = true,
    cxcCut = today,
    cxpCut = today,
  ) =>
    loadNotificationBranches(
      db,
      empresaId,
      branches,
      cxcCut,
      cxpCut,
      cxc,
      cxp,
      hr,
    );
  const baseline = (await load())[0],
    graceBaseline = (await load([branch], true, true, true, cutoff, cutoff))[0];
  const [policyRow] = await db.execute(
    sql`select valor from configuraciones where empresa_id=${empresaId}::uuid and clave='politicas_negocio'`,
  );
  const policy = normalizarPoliticasNegocio(policyRow?.valor);
  const policyCxc = sumarDiasIso(today, -policy.diasGraciaCobroCliente),
    policyCxp = sumarDiasIso(today, -policy.diasGraciaPagoProveedor);
  const unassignedBaseline = (
    await loadNotificationBranches(
      db,
      empresaId,
      [branch],
      policyCxc,
      policyCxp,
      true,
      true,
      true,
      true,
    )
  ).find((row) => row.sucursalId === null).cxcVencidas;
  const [sale] = await db.execute(
    sql`select id from ventas where empresa_id=${empresaId}::uuid and sucursal_id=${branch}::uuid limit 1`,
  );
  const [purchase] = await db.execute(
    sql`select id from compras where empresa_id=${empresaId}::uuid and sucursal_id=${branch}::uuid limit 1`,
  );
  assert.ok(sale && purchase);
  const oldId = randomUUID(),
    recentId = randomUUID(),
    partialId = randomUUID(),
    payableId = randomUUID(),
    unassignedId = randomUUID();
  try {
    await db.insert(s.cuentasPorCobrar).values([
      {
        id: oldId,
        empresaId,
        clienteId: customerId,
        ventaId: sale.id,
        fechaEmision: "2020-01-01",
        fechaVencimiento: "2020-01-02",
        monto: "10",
        saldo: "10",
        estado: "pendiente",
      },
      {
        id: recentId,
        empresaId,
        clienteId: customerId,
        ventaId: sale.id,
        fechaEmision: sumarDiasIso(today, -3),
        fechaVencimiento: sumarDiasIso(today, -2),
        monto: "10",
        saldo: "10",
        estado: "pendiente",
      },
      {
        id: partialId,
        empresaId,
        clienteId: customerId,
        ventaId: sale.id,
        fechaEmision: "2020-01-01",
        fechaVencimiento: "2020-01-02",
        monto: "10",
        saldo: "5",
        estado: "parcial",
      },
    ]);
    await db
      .insert(s.cuentasPorPagar)
      .values({
        id: payableId,
        empresaId,
        proveedorId: supplierId,
        compraId: purchase.id,
        fechaEmision: "2020-01-01",
        fechaVencimiento: "2020-01-02",
        monto: "10",
        saldo: "10",
        estado: "pendiente",
      });
    await db
      .insert(s.cuentasPorCobrar)
      .values({
        id: unassignedId,
        empresaId,
        clienteId: customerId,
        ventaId: null,
        fechaEmision: "2020-01-01",
        fechaVencimiento: "2020-01-02",
        monto: "10",
        saldo: "10",
        estado: "pendiente",
      });
    const normal = (await load())[0],
      grace = (await load([branch], true, true, true, cutoff, cutoff))[0];
    assert.equal(normal.cxcVencidas, baseline.cxcVencidas + 2);
    assert.equal(normal.cxpVencidas, baseline.cxpVencidas + 1);
    assert.equal(grace.cxcVencidas, graceBaseline.cxcVencidas + 1);
    assert.equal(grace.cxpVencidas, graceBaseline.cxpVencidas + 1);
    assert.deepEqual(await load([branch2], false, false, false), [
      {
        sucursalId: branch2,
        cxcVencidas: 0,
        cxpVencidas: 0,
        solicitudesPendientes: 0,
      },
    ]);
    const snapshot = await desktopBootstrap(user, [branch], {
      deviceId: device1,
    });
    const item = snapshot.settings.notificaciones.find(
      (row) => row.id === branch,
    );
    assert.equal(
      snapshot.settings.notificaciones.find((row) => row.id === "unassigned")
        .cxcVencidas,
      unassignedBaseline + 1,
    );
    const policyCounts = (
      await load(
        [branch],
        true,
        true,
        true,
        sumarDiasIso(today, -policy.diasGraciaCobroCliente),
        sumarDiasIso(today, -policy.diasGraciaPagoProveedor),
      )
    )[0];
    assert.equal(item.cxcVencidas, policyCounts.cxcVencidas);
    assert.equal(item.cxpVencidas, policyCounts.cxpVencidas);
  } finally {
    await db.execute(
      sql`delete from cuentas_por_cobrar where empresa_id=${empresaId}::uuid and id=any(ARRAY[${oldId}::uuid,${recentId}::uuid,${partialId}::uuid,${unassignedId}::uuid])`,
    );
    await db.execute(
      sql`delete from cuentas_por_pagar where empresa_id=${empresaId}::uuid and id=${payableId}::uuid`,
    );
  }
  const initial = await readWebChanges(user, null);
  assert.equal((await readWebChanges(user, initial.cursor)).changed, false);
  let start, release;
  const ready = new Promise((r) => {
      start = r;
    }),
    gate = new Promise((r) => {
      release = r;
    });
  const late = db.transaction(async (tx) => {
    await tx.execute(
      sql`update productos set descripcion='Transacción tardía QA' where empresa_id=${empresaId}::uuid and id=${product}::uuid`,
    );
    start();
    await gate;
  });
  let middle;
  try {
    await ready;
    assert.equal((await readWebChanges(user, initial.cursor)).changed, false);
    await db.execute(
      sql`update clientes set telefono='Cambio intermedio QA' where empresa_id=${empresaId}::uuid and id=${customerId}::uuid`,
    );
    middle = await readWebChanges(user, initial.cursor);
    assert.equal(middle.changed, true);
  } finally {
    release();
    await late;
  }
  const after = await readWebChanges(user, middle.cursor);
  assert.equal(
    after.changed,
    true,
    "A lower-sequence transaction committed later must refresh",
  );
  assert.equal((await readWebChanges(user, after.cursor)).changed, false);
  const other = { id: randomUUID(), empresaId: randomUUID() },
    isolated = await readWebChanges(other, null);
  await db.execute(
    sql`update clientes set telefono='Cambio sólo empresa QA' where empresa_id=${empresaId}::uuid and id=${customerId}::uuid`,
  );
  assert.equal((await readWebChanges(other, isolated.cursor)).changed, false);
  assert.equal(
    (await readWebChanges(other, initial.cursor)).changed,
    true,
    "Foreign cursor resets to authenticated tenant",
  );
  console.log(
    JSON.stringify({
      notificationBranchScope: "passed",
      notificationGraceDays: "passed",
      notificationPermissions: "passed",
      notificationBootstrap: "passed",
      webIdleNoRefresh: "passed",
      webLateCommitDetection: "passed",
      webTenantIsolation: "passed",
    }),
  );
}
