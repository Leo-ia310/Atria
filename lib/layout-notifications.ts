import { cache } from "react";
import { unstable_cache } from "next/cache";
import { and, count, eq, inArray, isNull, lt } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import {
  compras,
  cuentasPorCobrar,
  cuentasPorPagar,
  empleados,
  solicitudesRrhh,
  ventas,
} from "@/lib/db/schema";
import { getPoliticasNegocio, sumarDiasIso } from "@/lib/politicas-negocio";

export type LayoutNotificationCounts = {
  cxcVencidas: number;
  cxpVencidas: number;
  solicitudesPendientes: number;
};

const cargarConteos = unstable_cache(
  async (
    empresaId: string,
    sucursalIdsKey: string,
    fechaCorteCxc: string,
    fechaCorteCxp: string,
    puedeVerCxc: boolean,
    puedeVerCxp: boolean,
    puedeVerRrhh: boolean,
  ): Promise<LayoutNotificationCounts> => {
    const sucursalIds = sucursalIdsKey
      ? sucursalIdsKey.split(",").filter(Boolean)
      : null;
    const [cxcRows, cxpRows, solicitudesRows] = await dbConEmpresa(empresaId, (tx) =>
      Promise.all([
      puedeVerCxc
        ? tx
            .select({ n: count() })
            .from(cuentasPorCobrar)
            .leftJoin(ventas, eq(ventas.id, cuentasPorCobrar.ventaId))
            .where(
              and(
                eq(cuentasPorCobrar.empresaId, empresaId),
                eq(cuentasPorCobrar.estado, "pendiente"),
                lt(cuentasPorCobrar.fechaVencimiento, fechaCorteCxc),
                sucursalIds
                  ? inArray(ventas.sucursalId, sucursalIds)
                  : undefined,
              ),
            )
        : Promise.resolve([{ n: 0 }]),
      puedeVerCxp
        ? tx
            .select({ n: count() })
            .from(cuentasPorPagar)
            .leftJoin(compras, eq(compras.id, cuentasPorPagar.compraId))
            .where(
              and(
                eq(cuentasPorPagar.empresaId, empresaId),
                eq(cuentasPorPagar.estado, "pendiente"),
                lt(cuentasPorPagar.fechaVencimiento, fechaCorteCxp),
                sucursalIds
                  ? inArray(compras.sucursalId, sucursalIds)
                  : undefined,
              ),
            )
        : Promise.resolve([{ n: 0 }]),
      puedeVerRrhh
        ? tx
            .select({ n: count() })
            .from(solicitudesRrhh)
            .innerJoin(empleados, eq(empleados.id, solicitudesRrhh.empleadoId))
            .where(
              and(
                eq(solicitudesRrhh.empresaId, empresaId),
                eq(solicitudesRrhh.estado, "pendiente"),
                eq(empleados.empresaId, empresaId),
                isNull(empleados.eliminadoEn),
                sucursalIds
                  ? inArray(empleados.sucursalId, sucursalIds)
                  : undefined,
              ),
            )
        : Promise.resolve([{ n: 0 }]),
      ]),
    );

    return {
      cxcVencidas: cxcRows[0]?.n ?? 0,
      cxpVencidas: cxpRows[0]?.n ?? 0,
      solicitudesPendientes: solicitudesRows[0]?.n ?? 0,
    };
  },
  ["layout-notification-counts-v1"],
  { revalidate: 30 },
);

export const getLayoutNotificationCounts = cache(
  async (
    empresaId: string,
    sucursalIds: string[] | null,
    puedeVerCxc: boolean,
    puedeVerCxp: boolean,
    puedeVerRrhh: boolean,
  ) => {
    const politicas = await getPoliticasNegocio(empresaId);
    const hoy = new Date().toISOString().slice(0, 10);

    return cargarConteos(
      empresaId,
      sucursalIds ? [...sucursalIds].sort().join(",") : "",
      sumarDiasIso(hoy, -politicas.diasGraciaCobroCliente),
      sumarDiasIso(hoy, -politicas.diasGraciaPagoProveedor),
      puedeVerCxc,
      puedeVerCxp,
      puedeVerRrhh,
    );
  },
);
