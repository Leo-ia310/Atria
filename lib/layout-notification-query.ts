import { and, count, eq, inArray, isNull, lt, or } from "drizzle-orm";
import type { Tx } from "./db";
import {
  compras,
  cuentasPorCobrar,
  cuentasPorPagar,
  empleados,
  solicitudesRrhh,
  ventas,
} from "./db/schema";
import type { LayoutNotificationCounts } from "./layout-notification-items";
export type NotificationBranch = LayoutNotificationCounts & {
  sucursalId: string | null;
};
/** Shared query for the web header and the device snapshot. Three grouped reads. */
export async function loadNotificationBranches(
  tx: Tx,
  empresaId: string,
  sucursalIds: string[] | null,
  cutoffCxc: string,
  cutoffCxp: string,
  canCxc: boolean,
  canCxp: boolean,
  canHr: boolean,
  includeUnassigned = false,
): Promise<NotificationBranch[]> {
  const [cxc, cxp, hr] = await Promise.all([
    canCxc
      ? tx
          .select({ sucursalId: ventas.sucursalId, n: count() })
          .from(cuentasPorCobrar)
          .leftJoin(ventas, eq(ventas.id, cuentasPorCobrar.ventaId))
          .where(
            and(
              eq(cuentasPorCobrar.empresaId, empresaId),
              eq(cuentasPorCobrar.estado, "pendiente"),
              lt(cuentasPorCobrar.fechaVencimiento, cutoffCxc),
              sucursalIds
                ? includeUnassigned
                  ? or(
                      inArray(ventas.sucursalId, sucursalIds),
                      isNull(ventas.sucursalId),
                    )
                  : inArray(ventas.sucursalId, sucursalIds)
                : undefined,
            ),
          )
          .groupBy(ventas.sucursalId)
      : [],
    canCxp
      ? tx
          .select({ sucursalId: compras.sucursalId, n: count() })
          .from(cuentasPorPagar)
          .leftJoin(compras, eq(compras.id, cuentasPorPagar.compraId))
          .where(
            and(
              eq(cuentasPorPagar.empresaId, empresaId),
              eq(cuentasPorPagar.estado, "pendiente"),
              lt(cuentasPorPagar.fechaVencimiento, cutoffCxp),
              sucursalIds
                ? includeUnassigned
                  ? or(
                      inArray(compras.sucursalId, sucursalIds),
                      isNull(compras.sucursalId),
                    )
                  : inArray(compras.sucursalId, sucursalIds)
                : undefined,
            ),
          )
          .groupBy(compras.sucursalId)
      : [],
    canHr
      ? tx
          .select({ sucursalId: empleados.sucursalId, n: count() })
          .from(solicitudesRrhh)
          .innerJoin(empleados, eq(empleados.id, solicitudesRrhh.empleadoId))
          .where(
            and(
              eq(solicitudesRrhh.empresaId, empresaId),
              eq(solicitudesRrhh.estado, "pendiente"),
              eq(empleados.empresaId, empresaId),
              isNull(empleados.eliminadoEn),
              sucursalIds
                ? includeUnassigned
                  ? or(
                      inArray(empleados.sucursalId, sucursalIds),
                      isNull(empleados.sucursalId),
                    )
                  : inArray(empleados.sucursalId, sucursalIds)
                : undefined,
            ),
          )
          .groupBy(empleados.sucursalId)
      : [],
  ]);
  const rows = new Map<string | null, NotificationBranch>(
    (sucursalIds ?? []).map((id) => [
      id,
      {
        sucursalId: id,
        cxcVencidas: 0,
        cxpVencidas: 0,
        solicitudesPendientes: 0,
      },
    ]),
  );
  if (includeUnassigned)
    rows.set(null, {
      sucursalId: null,
      cxcVencidas: 0,
      cxpVencidas: 0,
      solicitudesPendientes: 0,
    });
  for (const [key, counts] of [
    ["cxcVencidas", cxc],
    ["cxpVencidas", cxp],
    ["solicitudesPendientes", hr],
  ] as const)
    for (const value of counts) {
      const row = rows.get(value.sucursalId) ?? {
        sucursalId: value.sucursalId,
        cxcVencidas: 0,
        cxpVencidas: 0,
        solicitudesPendientes: 0,
      };
      row[key] = Number(value.n);
      rows.set(value.sucursalId, row);
    }
  return [...rows.values()];
}
