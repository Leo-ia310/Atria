import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { almacenes, existencias, productos } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { GraficaInventarioDinamica } from "@/components/reportes/GraficasDinamicas";
import { Package, TrendingDown, Coins } from "lucide-react";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { getEmpresaMetadata } from "@/lib/tenant-data";

export default async function ReporteInventarioPage() {
  const user = await requireSession();

  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sucursalIds = selectedSucursalIds(scope);

  const stockRows = await db
    .select({
      productoId: existencias.productoId,
      stockTotal: sql<string>`COALESCE(SUM(${existencias.cantidad}), 0)`,
    })
    .from(existencias)
    .innerJoin(almacenes, eq(almacenes.id, existencias.almacenId))
    .where(
      and(
        eq(existencias.empresaId, user.empresaId),
        eq(almacenes.empresaId, user.empresaId),
        eq(almacenes.activo, true),
        sucursalIds ? inArray(almacenes.sucursalId, sucursalIds) : undefined,
      ),
    )
    .groupBy(existencias.productoId);
  const stockPorProducto = new Map(
    stockRows.map((row) => [row.productoId, row.stockTotal]),
  );
  const productoIdsEnScope = sucursalIds ? stockRows.map((row) => row.productoId) : null;

  const productosRows =
    productoIdsEnScope && productoIdsEnScope.length === 0
      ? []
      : await db
          .select({
            productoId: productos.id,
            nombre: productos.nombre,
            sku: productos.sku,
            stockMinimo: productos.stockMinimo,
            costoPromedio: productos.costoPromedio,
          })
          .from(productos)
          .where(
            and(
              eq(productos.empresaId, user.empresaId),
              eq(productos.activo, true),
              isNull(productos.eliminadoEn),
              productoIdsEnScope ? inArray(productos.id, productoIdsEnScope) : undefined,
            ),
          );
  const rows = productosRows.map((producto) => ({
    ...producto,
    stockTotal: stockPorProducto.get(producto.productoId) ?? "0",
  }));

  const procesados = rows
    .map((r) => ({
      productoId: r.productoId,
      nombre: r.nombre,
      sku: r.sku,
      stockTotal: parseFloat(r.stockTotal),
      stockMinimo: parseFloat(r.stockMinimo),
      costoPromedio: parseFloat(r.costoPromedio),
      valorTotal: parseFloat(r.stockTotal) * parseFloat(r.costoPromedio),
    }))
    .sort((a, b) => b.valorTotal - a.valorTotal);

  const totalValorizado = procesados.reduce((a, p) => a + p.valorTotal, 0);
  const bajoMinimo = procesados.filter((p) => p.stockTotal < p.stockMinimo);

  const chartData = procesados
    .filter((p) => p.valorTotal > 0)
    .slice(0, 15)
    .map((p) => ({
      nombre: p.nombre.length > 22 ? p.nombre.slice(0, 22) + "…" : p.nombre,
      valor: p.valorTotal,
    }));

  return (
    <div>
      <PageHeader
        title="Reporte de inventario"
        subtitle={`Stock valorizado al costo promedio${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
        actions={
          <Link href="/reportes" className="arca-btn arca-btn-secondary arca-btn-sm">
            ← Reportes
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Productos en stock"
          value={String(procesados.length)}
          hint="Con registro de existencias"
          icon={Package}
        />
        <KpiCard
          label="Valor en bodega"
          value={formatearMoneda(totalValorizado, pais)}
          hint="Costo promedio × stock"
          icon={Coins}
        />
        <KpiCard
          label="Bajo mínimo"
          value={String(bajoMinimo.length)}
          hint={bajoMinimo.length > 0 ? "Requieren reposición" : "Todo en orden"}
          icon={TrendingDown}
          delta={bajoMinimo.length > 0 ? "Alerta" : undefined}
          deltaPositive={false}
        />
      </div>

      <div className="mt-4 space-y-4">
        {chartData.length > 0 ? (
          <Card>
            <CardHeader title="Top 15 productos por valor en stock" />
            <CardBody>
              <GraficaInventarioDinamica data={chartData} pais={pais} />
            </CardBody>
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={Package}
              titulo="Sin stock registrado"
              descripcion="Registra compras o ajusta el inventario para ver el reporte valorizado."
            />
          </Card>
        )}

        {bajoMinimo.length > 0 && (
          <Card>
            <CardHeader title={`Productos bajo mínimo (${bajoMinimo.length})`} />
            <CardBody className="p-0">
              <table className="w-full text-small">
                <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                  <tr className="text-label">
                    <th className="px-4 py-2 text-left">SKU</th>
                    <th className="px-4 py-2 text-left">Producto</th>
                    <th className="px-4 py-2 text-right">Stock actual</th>
                    <th className="px-4 py-2 text-right">Mínimo</th>
                    <th className="px-4 py-2 text-right">Valor actual</th>
                    <th className="px-4 py-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {bajoMinimo.map((p) => (
                    <tr
                      key={p.productoId}
                      className="border-b border-[color:var(--color-border)] last:border-b-0"
                    >
                      <td className="px-4 py-2 font-mono text-[12px] text-[color:var(--color-text-muted)]">
                        {p.sku}
                      </td>
                      <td className="px-4 py-2 font-medium">{p.nombre}</td>
                      <td className="px-4 py-2 text-right">
                        {p.stockTotal.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right text-[color:var(--color-text-muted)]">
                        {p.stockMinimo.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatearMoneda(p.valorTotal, pais)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {p.stockTotal <= 0 ? (
                          <Badge variant="error">Sin stock</Badge>
                        ) : (
                          <Badge variant="warning">Bajo mínimo</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
