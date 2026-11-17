import { sql } from "drizzle-orm";
import { dbConEmpresa } from "../db";
import type { CommercialAdjustment } from "./commercial-adjustments";
export function commercialAdjustmentQuery(
  company: string,
  branches: string[] | null,
  from?: string,
  to?: string,
) {
  return sql`select n.id,n.empresa_id,n.sucursal_id,n.fecha::text,n.total,coalesce((select sum(d.costo) from nota_credito_detalle d where d.nota_id=n.id),0) as costo,coalesce((select jsonb_agg(jsonb_build_object('productoId',d.producto_id,'nombre',p.nombre,'sku',p.sku,'cantidad',d.cantidad::float8,'subtotal',d.subtotal::float8)) from nota_credito_detalle d join productos p on p.id=d.producto_id and p.empresa_id=n.empresa_id where d.nota_id=n.id),'[]'::jsonb) as lineas from notas_credito n where n.empresa_id=${company}::uuid and n.snapshot is not null ${branches ? sql`and n.sucursal_id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(branches)}::jsonb))::uuid[])` : sql``} ${from ? sql`and n.fecha>=${from}::date` : sql``} ${to ? sql`and n.fecha<=${to}::date` : sql``}`;
}
export async function loadCommercialAdjustments(
  company: string,
  branches: string[] | null,
  from: string,
  to: string,
): Promise<CommercialAdjustment[]> {
  return dbConEmpresa(
    company,
    async (tx) =>
      [
        ...(await tx.execute(
          commercialAdjustmentQuery(company, branches, from, to),
        )),
      ] as unknown as CommercialAdjustment[],
  );
}
