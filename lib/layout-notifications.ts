import { cache } from "react";
import { unstable_cache } from "next/cache";
import { dbConEmpresa } from "@/lib/db";
import { getPoliticasNegocio, sumarDiasIso } from "@/lib/politicas-negocio";
import { loadNotificationBranches } from "./layout-notification-query";
import {
  layoutNotificationTag,
  type LayoutNotificationCounts,
} from "./layout-notification-items";
export type { LayoutNotificationCounts } from "./layout-notification-items";
const cargarConteos = async (
  empresaId: string,
  branchKey: string,
  cutoffCxc: string,
  cutoffCxp: string,
  canCxc: boolean,
  canCxp: boolean,
  canHr: boolean,
): Promise<LayoutNotificationCounts> =>
  unstable_cache(
    async () => {
      const rows = await dbConEmpresa(empresaId, (tx) =>
        loadNotificationBranches(
          tx,
          empresaId,
          branchKey ? branchKey.split(",") : null,
          cutoffCxc,
          cutoffCxp,
          canCxc,
          canCxp,
          canHr,
        ),
      );
      return rows.reduce(
        (sum, row) => ({
          cxcVencidas: sum.cxcVencidas + row.cxcVencidas,
          cxpVencidas: sum.cxpVencidas + row.cxpVencidas,
          solicitudesPendientes:
            sum.solicitudesPendientes + row.solicitudesPendientes,
        }),
        { cxcVencidas: 0, cxpVencidas: 0, solicitudesPendientes: 0 },
      );
    },
    [
      "layout-notification-counts-v3",
      empresaId,
      branchKey,
      cutoffCxc,
      cutoffCxp,
      String(canCxc),
      String(canCxp),
      String(canHr),
    ],
    { revalidate: 30, tags: [layoutNotificationTag(empresaId)] },
  )();
export const getLayoutNotificationCounts = cache(
  async (
    empresaId: string,
    sucursalIds: string[] | null,
    canCxc: boolean,
    canCxp: boolean,
    canHr: boolean,
  ) => {
    const policies = await getPoliticasNegocio(empresaId),
      today = new Date().toISOString().slice(0, 10);
    return cargarConteos(
      empresaId,
      sucursalIds ? [...sucursalIds].sort().join(",") : "",
      sumarDiasIso(today, -policies.diasGraciaCobroCliente),
      sumarDiasIso(today, -policies.diasGraciaPagoProveedor),
      canCxc,
      canCxp,
      canHr,
    );
  },
);
