import { getTableName, gt, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { cuentasPorCobrar, facturas } from "./db/schema";

// Preserve correlation in SELECT too: Drizzle strips Column qualifiers when
// building a single-table projection, including columns nested in a subquery.
const reference = (column: PgColumn) => sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;

/** Any positive receivable is unpaid, including overdue or uncollectible debt. */
export function facturaTieneSaldo() {
  return sql<boolean>`exists(select 1 from ${cuentasPorCobrar}
    where ${reference(cuentasPorCobrar.empresaId)}=${reference(facturas.empresaId)}
      and ${reference(cuentasPorCobrar.ventaId)}=${reference(facturas.ventaId)}
      and ${gt(reference(cuentasPorCobrar.saldo), "0")})`;
}
