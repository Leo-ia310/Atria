import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import {
  customerListWhere,
  supplierListWhere,
  purchaseListWhere,
} from "../lib/list-query.ts";
import { LIST_PAGE_SIZE, parseListFilters } from "../lib/list-filters.ts";

export async function checkListFilters({ db, s, sql, user, branch, branch2 }) {
  assert.equal(
    new URL(process.env.ARCA_TEST_DATABASE_URL).hostname,
    "127.0.0.1",
  );
  const empresaId = user.empresaId,
    prefix = `Filter-${randomUUID()}`,
    supplierId = randomUUID(),
    purchaseIds = [randomUUID(), randomUUID()],
    customerIds = Array.from({ length: 205 }, () => randomUUID());
  const [purchase] = await db.execute(
    sql`select almacen_id from compras where empresa_id=${empresaId}::uuid limit 1`,
  );
  assert.ok(purchase);
  const filters = (params, kind = "clientes") => parseListFilters(params, kind);
  const customers = async (params) =>
    db
      .select({ id: s.clientes.id })
      .from(s.clientes)
      .where(customerListWhere(empresaId, filters(params)))
      .orderBy(asc(s.clientes.nombre), asc(s.clientes.id));
  const suppliers = async (params) =>
    db
      .select({ id: s.proveedores.id })
      .from(s.proveedores)
      .where(supplierListWhere(empresaId, filters(params, "proveedores")));
  const purchases = async (params, branches = [branch]) =>
    db
      .select({ id: s.compras.id })
      .from(s.compras)
      .innerJoin(s.proveedores, eq(s.proveedores.id, s.compras.proveedorId))
      .where(
        purchaseListWhere(empresaId, branches, filters(params, "compras")),
      );
  try {
    await db
      .insert(s.clientes)
      .values(
        customerIds.map((id, n) => ({
          id,
          empresaId,
          nombre: `${prefix}-${String(n).padStart(3, "0")}${n === 0 ? " %_ literal" : ""}`,
          telefono: n === 204 ? `${prefix}-phone` : null,
          limiteCredito: n === 204 ? "500" : "0",
          diasCredito: n === 204 ? 30 : 0,
          esConsumidorFinal: n === 203,
          activo: n !== 204,
          eliminadoEn: n === 202 ? new Date() : null,
        })),
      );
    await db
      .insert(s.proveedores)
      .values({
        id: supplierId,
        empresaId,
        razonSocial: prefix,
        nombreComercial: `${prefix}-comercial`,
        email: `${prefix}@test.invalid`,
        contacto: `${prefix}-contact`,
        diasCredito: 30,
        activo: false,
      });
    await db
      .insert(s.compras)
      .values(
        purchaseIds.map((id, n) => ({
          id,
          empresaId,
          almacenId: purchase.almacen_id,
          proveedorId: supplierId,
          sucursalId: n === 0 ? branch : branch2,
          numeroFactura: `${prefix}-${n}`,
          fecha: n === 0 ? "2026-08-10" : "2026-09-09",
          estado: n === 0 ? "recibida" : "anulada",
          esCredito: n === 1,
          subtotal: n === 0 ? "20.5555" : "60",
          total: n === 0 ? "20.5555" : "60",
        })),
      );
    assert.equal(
      (await customers({ q: prefix })).length,
      204,
      "Deleted rows excluded; search covers more than the old 200-row cap",
    );
    assert.deepEqual(
      (
        await customers({
          q: `${prefix}-phone`,
          credito: "credito",
          estado: "inactivo",
          tipo: "registrado",
        })
      ).map((row) => row.id),
      [customerIds[204]],
    );
    assert.deepEqual(
      (
        await customers({
          q: prefix,
          tipo: "consumidor",
          credito: "contado",
          estado: "activo",
        })
      ).map((row) => row.id),
      [customerIds[203]],
    );
    assert.deepEqual(
      (await customers({ q: `${prefix}-000 %_` })).map((row) => row.id),
      [customerIds[0]],
      "Wildcards are literal",
    );
    const page = await db
      .select({ id: s.clientes.id })
      .from(s.clientes)
      .where(customerListWhere(empresaId, filters({ q: prefix })))
      .orderBy(asc(s.clientes.nombre), asc(s.clientes.id))
      .limit(LIST_PAGE_SIZE)
      .offset(200);
    assert.equal(page.length, 4);
    assert.equal(page.at(-1).id, customerIds[204]);
    assert.deepEqual(
      (
        await suppliers({
          q: `${prefix}-contact`,
          credito: "credito",
          estado: "inactivo",
        })
      ).map((row) => row.id),
      [supplierId],
    );
    assert.equal(
      (await suppliers({ q: prefix, credito: "contado" })).length,
      0,
    );
    assert.equal((await suppliers({ q: prefix, estado: "activo" })).length, 0);
    assert.deepEqual(
      (
        await purchases({
          q: prefix,
          desde: "2026-08-10",
          hasta: "2026-08-10",
          minimo: "20.5555",
          maximo: "20.5555",
          credito: "contado",
          estado: "recibida",
        })
      ).map((row) => row.id),
      [purchaseIds[0]],
    );
    assert.equal((await purchases({ q: prefix, minimo: "20.5556" })).length, 0);
    assert.deepEqual(
      (
        await purchases({ q: prefix, credito: "credito", estado: "anulada" }, [
          branch2,
        ])
      ).map((row) => row.id),
      [purchaseIds[1]],
    );
    assert.equal(
      (await purchases({ q: prefix, credito: "credito" })).length,
      0,
      "Branch scope always applies alongside search",
    );
    assert.equal((await purchases({ q: prefix }, [])).length, 0);
    const foreign = await db
      .select({ id: s.clientes.id })
      .from(s.clientes)
      .where(customerListWhere(randomUUID(), filters({ q: prefix })));
    assert.equal(foreign.length, 0);
    console.log(
      JSON.stringify({
        listSearchBeyond200: "passed",
        listLiteralSearch: "passed",
        listCreditAndStatus: "passed",
        listPurchaseDateAndDecimal: "passed",
        listPagination: "passed",
        listTenantAndBranch: "passed",
      }),
    );
  } finally {
    await db.delete(s.compras).where(inArray(s.compras.id, purchaseIds));
    await db.delete(s.proveedores).where(eq(s.proveedores.id, supplierId));
    await db.delete(s.clientes).where(inArray(s.clientes.id, customerIds));
  }
}
