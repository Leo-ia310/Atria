import { and, eq, gte, inArray, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { ventas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { GraficaRentabilidadDinamica } from "@/components/reportes/GraficasDinamicas";
import { TrendingUp, Coins, Percent } from "lucide-react";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { cacheModulo } from "@/lib/redis/cache";
import { MODULOS, TTL } from "@/lib/redis/keys";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";

const MESES_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export default async function ReporteRentabilidadPage() {
  const user = await requireSession();

  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sucursalIds = selectedSucursalIds(scope);

  const hace12 = new Date();
  hace12.setFullYear(hace12.getFullYear() - 1);
  hace12.setDate(1);

  // Group sales by YYYY-MM period
  const periodoExpr = sql<string>`TO_CHAR(${ventas.fecha}, 'YYYY-MM')`;

  const scopeKey = sucursalIds ? [...sucursalIds].sort().join(",") : "all";
  const datos = await cacheModulo(
    user.empresaId,
    MODULOS.REPORTES,
    `rentabilidad:${scopeKey}`,
    TTL.REPORTES,
    () =>
      db
        .select({
          periodo: periodoExpr,
          ingresos: sql<string>`COALESCE(SUM(${ventas.total}), 0)`,
          costos: sql<string>`COALESCE(SUM(${ventas.costoTotal}), 0)`,
          cantVentas: sql<string>`COUNT(*)`,
        })
        .from(ventas)
        .where(
          and(
            eq(ventas.empresaId, user.empresaId),
            eq(ventas.estado, "completada"),
            gte(ventas.fecha, hace12),
            sucursalIds ? inArray(ventas.sucursalId, sucursalIds) : undefined,
          ),
        )
        .groupBy(periodoExpr)
        .orderBy(periodoExpr),
  );

  const chartData = datos.map((d) => {
    const [anioStr, mesStr] = d.periodo.split("-");
    const mes = parseInt(mesStr, 10);
    return {
      mes: `${MESES_ES[mes - 1]} ${anioStr}`,
      ingresos: parseFloat(d.ingresos),
      costos: parseFloat(d.costos),
      margen: parseFloat(d.ingresos) - parseFloat(d.costos),
    };
  });

  const totalIngresos = chartData.reduce((a, d) => a + d.ingresos, 0);
  const totalCostos = chartData.reduce((a, d) => a + d.costos, 0);
  const totalMargen = totalIngresos - totalCostos;
  const pctMargen = totalIngresos > 0 ? (totalMargen / totalIngresos) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Rentabilidad"
        subtitle={`Ingresos vs costo de ventas — últimos 12 meses${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportarExcel recurso="reportes-rentabilidad" />
            <Link href="/reportes" className="arca-btn arca-btn-secondary arca-btn-sm">
              ← Reportes
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Ingresos 12 meses"
          value={formatearMoneda(totalIngresos, pais)}
          icon={TrendingUp}
        />
        <KpiCard
          label="Margen bruto"
          value={formatearMoneda(totalMargen, pais)}
          hint={`Ingresos menos costo de ventas`}
          icon={Coins}
          delta={totalMargen >= 0 ? undefined : "Pérdida"}
          deltaPositive={totalMargen >= 0}
        />
        <KpiCard
          label="% Margen bruto"
          value={`${pctMargen.toFixed(1)}%`}
          hint={`Costo de ventas: ${formatearMoneda(totalCostos, pais)}`}
          icon={Percent}
          delta={pctMargen >= 30 ? "Saludable" : pctMargen > 0 ? "Ajustado" : undefined}
          deltaPositive={pctMargen >= 30}
        />
      </div>

      <div className="mt-4">
        {chartData.length === 0 ? (
          <Card>
            <EmptyState
              icon={TrendingUp}
              titulo="Sin ventas en los últimos 12 meses"
              descripcion="Registra ventas para ver el análisis de rentabilidad."
            />
          </Card>
        ) : (
          <Card>
            <CardHeader title="Ingresos vs costo de ventas por mes" />
            <CardBody>
              <GraficaRentabilidadDinamica data={chartData} pais={pais} />
            </CardBody>
          </Card>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="mt-4">
          <Card>
            <CardHeader title="Detalle por mes" />
            <CardBody className="p-0">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-small">
                <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                  <tr className="text-label">
                    <th className="px-4 py-2 text-left">Período</th>
                    <th className="px-4 py-2 text-right">Ingresos</th>
                    <th className="px-4 py-2 text-right">Costo de ventas</th>
                    <th className="px-4 py-2 text-right">Margen bruto</th>
                    <th className="px-4 py-2 text-right">% Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((d) => {
                    const pct = d.ingresos > 0 ? (d.margen / d.ingresos) * 100 : 0;
                    return (
                      <tr
                        key={d.mes}
                        className="border-b border-[color:var(--color-border)] last:border-b-0"
                      >
                        <td className="px-4 py-2 font-medium">{d.mes}</td>
                        <td className="px-4 py-2 text-right">
                          {formatearMoneda(d.ingresos, pais)}
                        </td>
                        <td className="px-4 py-2 text-right text-[color:var(--color-text-muted)]">
                          {formatearMoneda(d.costos, pais)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-semibold ${
                            d.margen >= 0
                              ? "text-[color:var(--color-success)]"
                              : "text-[color:var(--color-error)]"
                          }`}
                        >
                          {formatearMoneda(d.margen, pais)}
                        </td>
                        <td className="px-4 py-2 text-right text-[color:var(--color-text-muted)]">
                          {pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] font-bold">
                  <tr>
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right">{formatearMoneda(totalIngresos, pais)}</td>
                    <td className="px-4 py-3 text-right">{formatearMoneda(totalCostos, pais)}</td>
                    <td
                      className={`px-4 py-3 text-right ${
                        totalMargen >= 0
                          ? "text-[color:var(--color-success)]"
                          : "text-[color:var(--color-error)]"
                      }`}
                    >
                      {formatearMoneda(totalMargen, pais)}
                    </td>
                    <td className="px-4 py-3 text-right">{pctMargen.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
