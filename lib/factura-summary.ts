import { and, count, eq, inArray, sum, type SQL } from "drizzle-orm";
import type { Tx } from "./db";
import { facturas, ventas } from "./db/schema";
import { facturaTieneSaldo } from "./factura-settlement";

/** Shared by the actual invoice dashboard and its PostgreSQL regression test. */
export async function consultarResumenFacturas(tx: Pick<Tx, "select">, empresaId: string, sucursalIds: string[] | null) {
  const cond: SQL[] = [eq(facturas.empresaId, empresaId)];
  if (sucursalIds) cond.push(inArray(ventas.sucursalId, sucursalIds));
  const resumenRows = await tx.select({esCredito:facturas.esCredito,cantidad:count(facturas.id),total:sum(facturas.total)})
    .from(facturas).leftJoin(ventas,eq(ventas.id,facturas.ventaId)).where(and(...cond)).groupBy(facturas.esCredito);
  const [porCobrar] = await tx.select({cantidad:count(facturas.id),total:sum(facturas.total)})
    .from(facturas).leftJoin(ventas,eq(ventas.id,facturas.ventaId))
    .where(and(...cond,eq(facturas.esCredito,false),facturaTieneSaldo()));
  return {resumenRows,porCobrar};
}
