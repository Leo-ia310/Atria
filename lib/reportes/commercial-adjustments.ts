/** Append-only credits belong to their own date, never rewrite the original sale period. */
export type CommercialAdjustment = {
  id: string;
  sucursal_id: string;
  fecha: string;
  total: number | string;
  costo: number | string;
  lineas: Array<{
    productoId: string;
    nombre: string;
    sku: string;
    cantidad: number;
    subtotal: number;
  }>;
};
export function scopedAdjustments(
  rows: CommercialAdjustment[],
  branches: string[] | null,
  from: string,
  to: string,
) {
  return rows.filter(
    (r) =>
      (!branches || branches.includes(r.sucursal_id)) &&
      r.fecha >= from &&
      r.fecha <= to,
  );
}
export function adjustedDays<
  T extends { fecha: string; total: number | string; count: number | string },
>(days: T[], notes: CommercialAdjustment[]) {
  const map = new Map(
    days.map((r) => [
      r.fecha,
      { fecha: r.fecha, total: Number(r.total), count: Number(r.count) },
    ]),
  );
  for (const n of notes) {
    const row = map.get(n.fecha) ?? { fecha: n.fecha, total: 0, count: 0 };
    row.total -= Number(n.total);
    map.set(n.fecha, row);
  }
  return [...map.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}
export function adjustedMonths(
  rows: Array<{
    periodo: string;
    ingresos: number | string;
    costos: number | string;
    cantVentas: number | string;
  }>,
  notes: CommercialAdjustment[],
) {
  const map = new Map(
    rows.map((r) => [
      r.periodo,
      {
        periodo: r.periodo,
        ingresos: Number(r.ingresos),
        costos: Number(r.costos),
        cantVentas: Number(r.cantVentas),
      },
    ]),
  );
  for (const n of notes) {
    const key = n.fecha.slice(0, 7),
      row = map.get(key) ?? {
        periodo: key,
        ingresos: 0,
        costos: 0,
        cantVentas: 0,
      };
    row.ingresos -= Number(n.total);
    row.costos -= Number(n.costo);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
}
export function adjustedProducts(
  rows: Array<{
    productoId: string;
    nombre: string;
    sku: string;
    cantidad: number;
    total: number;
  }>,
  notes: CommercialAdjustment[],
) {
  const map = new Map(rows.map((r) => [r.productoId, { ...r }]));
  for (const n of notes)
    for (const l of n.lineas) {
      const r = map.get(l.productoId) ?? {
        productoId: l.productoId,
        nombre: l.nombre,
        sku: l.sku,
        cantidad: 0,
        total: 0,
      };
      r.cantidad -= Number(l.cantidad);
      r.total -= Number(l.subtotal);
      map.set(l.productoId, r);
    }
  return [...map.values()]
    .sort((a, b) => b.total - a.total || a.sku.localeCompare(b.sku))
    .slice(0, 10);
}
