import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { executeCommercial } = require("../lib/commercial-service.ts");
const { commercialCommandSchema } = require("../lib/commercial-core.ts");
const {
  inAuthenticatedUserContext,
} = require("../lib/authenticated-user-context.ts");
const { firmarGrantCanonico } = require("../lib/desktop-grant.ts");

export async function checkCommercial({
  db,
  s,
  sql,
  user,
  branch,
  branch2,
  warehouse,
  product,
  method,
  day,
  op,
  applyDesktopOperation,
  device1,
  device2,
}) {
  assert.equal(
    new URL(process.env.ARCA_TEST_DATABASE_URL).hostname,
    "127.0.0.1",
  );
  // Drizzle's fixture builder includes the current models. Recreate ONLY its
  // seven empty commercial tables to exercise the actual SQL from a pre-0029
  // state. All emptiness checks precede DDL; never runs on an existing database.
  const fixtureTables = [
    "comercial_eventos",
    "comercial_intentos",
    "comercial_conversiones",
    "proformas",
    "comercial_revisiones",
    "comercial_origenes",
    "perfiles_documentales",
  ];
  for (const table of fixtureTables) {
    const [row] = await db.execute(
      sql.raw(`select count(*)::int n from ${table}`),
    );
    assert.equal(
      row.n,
      0,
      "fixture table must be empty before rebuilding migration baseline",
    );
  }
  await db.execute(sql.raw(`drop table ${fixtureTables.join(",")}`));
  const legacyQuoteId = randomUUID();
  await db
    .insert(s.cotizaciones)
    .values({
      id: legacyQuoteId,
      empresaId: user.empresaId,
      sucursalId: branch,
      numero: "LEGACY-QA-" + legacyQuoteId,
      fecha: day,
      subtotal: "1",
      total: "1",
      usuarioId: user.id,
    });
  const legacyQuote = [
    ...(await db.execute(
      sql`select * from cotizaciones where id=${legacyQuoteId}::uuid`,
    )),
  ];
  const migration = await readFile(
    new URL(
      "../lib/db/migrations/0029_commercial_documents.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.transaction((tx) => tx.execute(sql.raw(migration)));
  await assert.rejects(
    db.execute(
      sql`insert into perfiles_documentales(empresa_id,perfil,ruc) values(${user.empresaId}::uuid,'registrado',null)`,
    ),
    /check constraint/,
  );
  // Reapplication must be safe. Grants exist only in this synthetic role.
  await db.transaction((tx) => tx.execute(sql.raw(migration)));
  const permissions = await db
    .select()
    .from(s.permisos)
    .where(
      sql`clave like 'cotizacion.%' or clave like 'proforma.%' or clave='documental.configurar'`,
    );
  for (const permission of permissions)
    await db
      .insert(s.rolPermisos)
      .values({ rolId: user.rolId, permisoId: permission.id })
      .onConflictDoNothing();
  const command = (data) =>
    commercialCommandSchema.parse({
      requestId: randomUUID(),
      kind: "cotizacion",
      sucursalId: branch,
      ...data,
    });
  const run = (data, device = null) =>
    executeCommercial(
      user,
      command(data),
      device,
      device ? [branch] : undefined,
    );
  const ok = (r) => {
    assert.equal(r.ok, true, JSON.stringify(r));
    return r;
  };
  const effects = async () => [
    ...(await db.execute(sql`select
    (select count(*) from ventas) as ventas,(select count(*) from venta_detalle) as lineas,
    (select count(*) from movimientos_inventario) as movimientos,(select sum(cantidad) from existencias) as stock,
    (select count(*) from pagos_venta) as pagos,(select count(*) from caja_movimientos) as caja,
    (select count(*) from cuentas_por_cobrar) as cxc,(select count(*) from cuentas_por_pagar) as cxp,
    (select count(*) from asientos_contables) as asientos,(select count(*) from facturas) as facturas`)),
  ];
  const [originalCompany] = await db.execute(
    sql`select identificacion_fiscal from empresas where id=${user.empresaId}::uuid`,
  );
  await db.execute(
    sql`update empresas set identificacion_fiscal='' where id=${user.empresaId}::uuid`,
  );
  const before = await effects();
  const draft = {
    sucursalId: branch,
    fecha: day,
    moneda: "NIO",
    items: [
      {
        productoId: product,
        cantidad: 1,
        precioUnitario: 10,
        tasa: 0,
        descuento: 0,
      },
    ],
    condicionesPago: "Contado",
    condicionesComerciales: "Oferta de prueba",
    observaciones: "Sin efecto financiero",
  };
  const create = command({ action: "create", draft });
  const created = ok(await executeCommercial(user, create));
  let q = created.document;
  await db.execute(sql`create role qa_commercial_reader nologin`);
  await db.execute(
    sql`grant select on comercial_revisiones to qa_commercial_reader`,
  );
  await db.transaction(async (scoped) => {
    await scoped.execute(sql`set local role qa_commercial_reader`);
    await scoped.execute(
      sql`select set_config('app.empresa_id',${randomUUID()},true)`,
    );
    assert.equal(
      (await scoped.execute(sql`select origen_id from comercial_revisiones`))
        .length,
      0,
    );
    await scoped.execute(
      sql`select set_config('app.empresa_id',${user.empresaId},true)`,
    );
    assert.equal(
      (await scoped.execute(sql`select origen_id from comercial_revisiones`))
        .length,
      1,
    );
  });
  assert.deepEqual(
    ok(await executeCommercial(user, create)),
    created,
    "lost create response recovers identical result",
  );
  assert.equal(
    (
      await executeCommercial(user, {
        ...create,
        draft: { ...draft, observaciones: "otro" },
      })
    ).ok,
    false,
  );
  assert.deepEqual(
    ok(await run({ action: "recover", attemptId: create.requestId })),
    created,
  );
  const unconfirmed = command({ action: "create", draft });
  assert.equal(
    ok(await run({ action: "recover", attemptId: unconfirmed.requestId }))
      .discarded,
    true,
  );
  assert.equal(
    (await executeCommercial(user, unconfirmed)).ok,
    false,
    "late request cannot resurrect a discarded attempt",
  );
  assert.equal(
    (
      await run({
        action: "recover",
        attemptId: create.requestId,
        sucursalId: branch2,
      })
    ).ok,
    false,
  );

  q = ok(
    await run({
      action: "edit",
      id: q.id,
      expectedVersion: 1,
      draft: { ...draft, items: [{ ...draft.items[0], precioUnitario: 12 }] },
    }),
  ).document;
  assert.equal(q.version, 2);
  assert.equal(
    q.revisions.find((r) => r.version === 1).snapshot.amounts.total,
    10,
  );
  assert.equal(
    (await run({ action: "edit", id: q.id, expectedVersion: 1, draft })).ok,
    false,
  );
  const duplicate = ok(await run({ action: "duplicate", id: q.id })).document;
  assert.notEqual(duplicate.origenId, q.origenId);
  const derived = ok(
    await run({ action: "derive", id: q.id, expectedVersion: 2 }),
  ).document;
  assert.equal(derived.origenId, q.origenId);
  assert.equal(
    ok(await run({ action: "derive", id: q.id, expectedVersion: 2 })).document
      .id,
    derived.id,
  );
  const standalone = ok(
    await run({ kind: "proforma", action: "create", draft }),
  ).document;
  assert.notEqual(standalone.origenId, q.origenId);
  assert.equal(
    (
      await run({
        action: "state",
        id: q.id,
        expectedVersion: 2,
        state: "enviada",
      })
    ).ok,
    false,
  );
  q = ok(
    await run({
      action: "state",
      id: q.id,
      expectedVersion: 2,
      state: "enviada",
      evidence: "Entrega manual confirmada por el vendedor",
    }),
  ).document;
  q = ok(
    await run({
      action: "state",
      id: q.id,
      expectedVersion: 2,
      state: "aceptada",
    }),
  ).document;
  assert.equal(
    (await run({ action: "edit", id: q.id, expectedVersion: 2, draft })).ok,
    false,
  );
  const acceptedSnapshot = JSON.stringify(q.snapshot);
  ok(
    await run({
      action: "pdf",
      id: q.id,
      expectedVersion: 2,
      documentVersion: 1,
    }),
  );
  ok(
    await run({
      kind: "proforma",
      action: "print",
      id: derived.id,
      expectedVersion: 2,
    }),
  );
  assert.equal(
    ok(await run({ action: "detail", id: q.id })).document.estado,
    "aceptada",
  );
  const rejected = ok(
    await run({
      action: "state",
      id: duplicate.id,
      expectedVersion: 1,
      state: "rechazada",
      reason: "Cliente no aprobó",
    }),
  ).document;
  assert.equal(rejected.estado, "rechazada");
  const expired = ok(
    await run({
      action: "create",
      draft: { ...draft, fecha: "2020-01-01", vigenteHasta: "2020-01-02" },
    }),
  ).document;
  assert.equal(
    (
      await run({
        action: "state",
        id: expired.id,
        expectedVersion: 1,
        state: "aceptada",
      })
    ).ok,
    false,
  );
  assert.equal(
    ok(
      await run({
        action: "state",
        id: expired.id,
        expectedVersion: 1,
        state: "vencida",
        reason: "Vigencia cumplida",
      }),
    ).document.estado,
    "vencida",
  );
  const revised = ok(
    await run({
      action: "revise",
      id: duplicate.id,
      expectedVersion: 1,
      draft,
    }),
  ).document;
  assert.equal(revised.estado, "borrador");
  assert.equal(revised.version, 2);
  assert.equal(
    (await run({ action: "detail", id: q.id, sucursalId: branch2 })).ok,
    false,
  );
  assert.equal(
    (
      await executeCommercial(
        user,
        command({ action: "detail", id: q.id }),
        device1,
        [branch2],
      )
    ).ok,
    false,
  );
  const deniedId = randomUUID();
  await db.insert(s.usuarios).values({
    id: deniedId,
    empresaId: user.empresaId,
    nombre: "Sin permisos",
    email: `${deniedId}@example.invalid`,
    passwordHash: "test",
  });
  assert.equal(
    (
      await executeCommercial(
        { ...user, id: deniedId, rolId: null },
        command({ action: "list" }),
      )
    ).ok,
    false,
  );
  const otherCompany = randomUUID(),
    otherRole = randomUUID(),
    otherUser = randomUUID(),
    otherBranch = randomUUID();
  await db.insert(s.empresas).values({
    id: otherCompany,
    razonSocial: "Otra empresa QA",
    identificacionFiscal: "",
    pais: "NI",
    moneda: "NIO",
  });
  await db
    .insert(s.roles)
    .values({ id: otherRole, empresaId: otherCompany, nombre: "Comercial QA" });
  await db.insert(s.usuarios).values({
    id: otherUser,
    empresaId: otherCompany,
    rolId: otherRole,
    nombre: "Otro usuario QA",
    email: `${otherUser}@example.invalid`,
    passwordHash: "test",
  });
  const [subscription] = await db
    .select()
    .from(s.suscripciones)
    .where(sql`empresa_id=${user.empresaId}::uuid`)
    .limit(1);
  await db.insert(s.suscripciones).values({
    empresaId: otherCompany,
    planId: subscription.planId,
    estado: "activa",
    inicioPeriodo: new Date(),
    finPeriodo: new Date(Date.now() + 86400000),
  });
  await db.insert(s.sucursales).values({
    id: otherBranch,
    empresaId: otherCompany,
    codigo: "OTRA",
    nombre: "Otra sucursal QA",
  });
  await db.insert(s.rolPermisos).values({
    rolId: otherRole,
    permisoId: permissions.find((p) => p.clave === "cotizacion.ver").id,
  });
  const otherActor = {
    ...user,
    id: otherUser,
    empresaId: otherCompany,
    rolId: otherRole,
  };
  assert.equal(
    (
      await executeCommercial(
        otherActor,
        command({ action: "detail", id: q.id, sucursalId: otherBranch }),
      )
    ).ok,
    false,
    "foreign company cannot read a known UUID",
  );
  // Discard synthetic-tenant effects from the no-side-effects comparison: none above touched business tables.
  // A configured profile never enables fiscal issuance or rewrites accepted documents.
  ok(
    await run({
      action: "profile",
      profile: { perfil: "no_registrado", ruc: null },
    }),
  );
  assert.equal(
    (
      await run({
        action: "profile",
        profile: { perfil: "registrado", ruc: null },
      })
    ).ok,
    false,
  );
  ok(
    await run({
      action: "profile",
      profile: { perfil: "registrado", ruc: "RUC-SINTETICO-PRUEBA" },
    }),
  );
  assert.equal(
    JSON.stringify(
      ok(await run({ action: "detail", id: q.id })).document.snapshot,
    ),
    acceptedSnapshot,
  );
  assert.equal(
    ok(await run({ kind: "proforma", action: "detail", id: standalone.id }))
      .document.snapshot.documental.fiscal,
    false,
  );
  assert.deepEqual(
    await effects(),
    before,
    "all non-conversion actions have zero commercial/financial effects",
  );
  await assert.rejects(
    db.execute(
      sql`update comercial_revisiones set snapshot='{}' where origen_id=${q.origenId}::uuid`,
    ),
    /inmutable/,
  );
  // Explicit original turn, using existing cash architecture unchanged.
  const box = randomUUID();
  await db.insert(s.cajas).values({
    id: box,
    empresaId: user.empresaId,
    sucursalId: branch,
    codigo: box,
    nombre: "Caja comercial QA",
  });
  const open = op("sesion_caja", { cajaId: box, fondoInicial: 0 });
  await applyDesktopOperation(user, device1, [branch], open);
  const settlement = {
    almacenId: warehouse,
    sesionCajaId: open.entityId,
    esCredito: false,
    diasCredito: 0,
    pagos: [{ formaPagoId: method, monto: 12 }],
  };
  const failed = ok(
    await run({
      action: "create",
      draft: { ...draft, items: [{ ...draft.items[0], precioUnitario: 12 }] },
    }),
  ).document;
  ok(
    await run({
      action: "state",
      id: failed.id,
      expectedVersion: 1,
      state: "aceptada",
    }),
  );
  const priorFailure = await effects();
  await db.execute(
    sql`create function qa_commercial_late_failure() returns trigger language plpgsql as $$ begin if NEW.accion='convert' then raise exception 'qa commercial late failure'; end if; return NEW; end $$`,
  );
  await db.execute(
    sql`create trigger qa_commercial_late_failure before insert on comercial_eventos for each row execute function qa_commercial_late_failure()`,
  );
  const failedAttempt = command({
    action: "convert",
    id: failed.id,
    expectedVersion: 1,
    settlement,
  });
  assert.equal(
    (await executeCommercial(user, failedAttempt, device1, [branch])).ok,
    false,
  );
  assert.deepEqual(
    await effects(),
    priorFailure,
    "failure after Core sale rolls back sale, stock, receipt, cash and journal",
  );
  await db.execute(
    sql`drop trigger qa_commercial_late_failure on comercial_eventos`,
  );
  await db.execute(sql`drop function qa_commercial_late_failure()`);
  const convert = command({
    action: "convert",
    id: q.id,
    expectedVersion: 2,
    settlement,
  });
  await db.execute(
    sql`update empresas set moneda='USD' where id=${user.empresaId}::uuid`,
  );
  const currencyBefore = await effects();
  assert.equal(
    (
      await executeCommercial(
        user,
        { ...convert, documentVersion: 1 },
        device1,
        [branch],
      )
    ).ok,
    false,
    "conversion cannot audit a different revision",
  );
  assert.equal(
    (await executeCommercial(user, convert, device1, [branch])).ok,
    false,
  );
  assert.deepEqual(
    await effects(),
    currencyBefore,
    "accepted amounts are not silently reinterpreted in another currency",
  );
  await db.execute(
    sql`update empresas set moneda='NIO' where id=${user.empresaId}::uuid`,
  );
  const results = await Promise.all([
    executeCommercial(user, convert, device1, [branch]),
    run(
      {
        kind: "proforma",
        action: "convert",
        id: derived.id,
        expectedVersion: 2,
        settlement,
      },
      device2,
    ),
    executeCommercial(user, convert, device1, [branch]),
  ]);
  results.forEach(ok);
  const [cashActor] = await db.execute(
    sql`select usuario_id,device_id from caja_movimientos where empresa_id=${user.empresaId}::uuid and origen_tipo='venta' and origen_id=${results[0].ventaId}::uuid`,
  );
  assert.equal(cashActor.usuario_id, user.id);
  assert.ok(
    [device1, device2].includes(cashActor.device_id),
    "Core cash entries keep the authenticated converting device",
  );
  assert.equal(new Set(results.map((r) => r.ventaId)).size, 1);
  assert.equal(
    ok(await executeCommercial(user, convert, device1, [branch])).ventaId,
    results[0].ventaId,
  );
  const [counts] = await db.execute(
    sql`select (select count(*) from comercial_conversiones where origen_id=${q.origenId}::uuid)::int as conversions,(select count(*) from ventas where id=${results[0].ventaId}::uuid)::int as sales,(select count(*) from pagos_venta where venta_id=${results[0].ventaId}::uuid)::int as payments`,
  );
  assert.deepEqual({ ...counts }, { conversions: 1, sales: 1, payments: 1 });
  assert.equal(
    JSON.stringify(
      ok(await run({ action: "detail", id: q.id })).document.snapshot,
    ),
    acceptedSnapshot,
  );
  const webRoute = require("../app/api/commercial/route.ts");
  const webRead = command({ action: "detail", id: q.id });
  const webResponse = await inAuthenticatedUserContext(user, () =>
    webRoute.POST(
      new Request("http://127.0.0.1/api/commercial", {
        method: "POST",
        headers: {
          Origin: "http://127.0.0.1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(webRead),
      }),
    ),
  );
  assert.equal(
    ok(await webResponse.json()).document.ventaId,
    results[0].ventaId,
  );
  assert.equal(
    (
      await webRoute.POST(
        new Request("http://127.0.0.1/api/commercial", {
          method: "POST",
          headers: { Origin: "https://evil.invalid" },
          body: "{}",
        }),
      )
    ).status,
    403,
  );
  // Test the authenticated device route, not only a direct service call.
  for (const device of [device1, device2]) {
    await db.execute(
      sql`insert into desktop_devices(empresa_id,device_id,name) values(${user.empresaId}::uuid,${device}::uuid,'Commercial QA') on conflict do nothing`,
    );
    await db.execute(
      sql`insert into desktop_device_users(empresa_id,device_id,user_id,offline_access_valid_until) values(${user.empresaId}::uuid,${device}::uuid,${user.id}::uuid,now()+interval '1 day') on conflict(empresa_id,device_id,user_id) do update set revoked_at=null,offline_access_valid_until=excluded.offline_access_valid_until`,
    );
  }
  const desktopRoute = require("../app/api/desktop/commercial/route.ts");
  const auth = {
    userId: user.id,
    empresaId: user.empresaId,
    deviceId: device2,
    sucursalIds: [branch],
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };
  auth.signature = firmarGrantCanonico(process.env.AUTH_SECRET, auth);
  const deviceRequest = {
    deviceId: device2,
    auth,
    command: command({
      kind: "proforma",
      action: "convert",
      id: derived.id,
      expectedVersion: 2,
      settlement,
    }),
    capability: "commercial-v1",
  };
  const deviceResponse = await desktopRoute.POST(
    new Request("http://127.0.0.1/api/desktop/commercial", {
      method: "POST",
      body: JSON.stringify(deviceRequest),
    }),
  );
  assert.equal(ok(await deviceResponse.json()).ventaId, results[0].ventaId);
  assert.equal(
    (
      await desktopRoute.POST(
        new Request("http://127.0.0.1/api/desktop/commercial", {
          method: "POST",
          body: JSON.stringify({ ...deviceRequest, deviceId: device1 }),
        }),
      )
    ).status,
    401,
  );
  const [audit] = await db.execute(
    sql`select count(*)::int n from comercial_eventos where origen_id=${q.origenId}::uuid and accion='convert'`,
  );
  assert.equal(audit.n, 1);
  await applyDesktopOperation(
    user,
    device1,
    [branch],
    op(
      "sesion_caja",
      { totalDeclarado: 12, cierreEn: new Date().toISOString() },
      "update",
      open.entityId,
    ),
  );
  await db.execute(
    sql`update empresas set identificacion_fiscal=${originalCompany.identificacion_fiscal} where id=${user.empresaId}::uuid`,
  );
  assert.deepEqual(
    [
      ...(await db.execute(
        sql`select * from cotizaciones where id=${legacyQuoteId}::uuid`,
      )),
    ],
    legacyQuote,
    "historical quote remains byte-for-byte unchanged at the row-value level",
  );
  console.log(
    JSON.stringify({
      commercialNoFinancialEffects: true,
      commercialDraftEditDuplicate: true,
      commercialImmutableRevisions: true,
      commercialStates: true,
      commercialDerivedIdentity: true,
      commercialIndependentProforma: true,
      commercialPdfPrintNoStateChange: true,
      commercialPermissionsBranches: true,
      commercialTenantIsolation: true,
      commercialNoRucAndProfileTransition: true,
      commercialLateFailureRollback: true,
      commercialLostResponse: true,
      commercialReloadRecoveryAndDiscard: true,
      commercialConcurrentQuoteProformaTwoDevices: true,
      commercialOneSaleOnePayment: true,
      commercialMigrationReapply: true,
    }),
  );
}
