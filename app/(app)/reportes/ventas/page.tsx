import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ventas, ventaDetalle, productos } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { GraficaVentasDinamica } from "@/components/reportes/GraficasDinamicas";
import { Receipt, TrendingUp, ShoppingCart } from "lucide-react";
import { formatearMoneda } from "@/lib/utils";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { getEmpresaMetadata } from "@/lib/tenant-data";

export default async function ReporteVentasPage() {
  const user = await requireSession();
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = empresa?.pais ?? "NI";
  const sucursalIds = selectedSucursalIds(scope);
  const filtroSucursalVenta = sucursalIds
    ? inArray(ventas.sucursalId, sucursalIds)
    : undefined;

  const hace30 = new Date();
  hace30.setDate(hace30.getDate() - 30);

  const ventasUlt30Promise = db
    .select({
      fecha: sql<string>`DATE(${ventas.fecha})`,
      total: sql<string>`SUM(${ventas.total})`,
      count: sql<string>`COUNT(*)`,
    })
    .from(ventas)
    .where(
      and(
        eq(ventas.empresaId, user.empresaId),
        eq(ventas.estado, "completada"),
        gte(ventas.fecha, hace30),
        filtroSucursalVenta,
      ),
    )
    .groupBy(sql`DATE(${ventas.fecha})`)
    .orderBy(sql`DATE(${ventas.fecha})`);

  const topProductosPromise = db
    .select({
      nombre: productos.nombre,
      sku: productos.sku,
      cantidad: sql<string>`SUM(${ventaDetalle.cantidad})`,
      monto: sql<string>`SUM(${ventaDetalle.subtotal})`,
    })
    .from(ventaDetalle)
    .innerJoin(ventas, eq(ventas.id, ventaDetalle.ventaId))
    .innerJoin(productos, eq(productos.id, ventaDetalle.productoId))
    .where(
      and(
        eq(ventas.empresaId, user.empresaId),
        eq(ventas.estado, "completada"),
        gte(ventas.fecha, hace30),
        filtroSucursalVenta,
      ),
    )
    .groupBy(productos.id, productos.nombre, productos.sku)
    .orderBy(sql`SUM(${ventaDetalle.subtotal}) DESC`)
    .limit(10);

  const [ventasUlt30, topProductos] = await Promise.all([
    ventasUlt30Promise,
    topProductosPromise,
  ]);
  const dataDiaria = ventasUlt30.map((d) => ({
    label: new Date(d.fecha).toLocaleDateString("es", {
      day: "2-digit",
      month: "short",
    }),
    total: parseFloat(d.total),
  }));

  const totalMes = ventasUlt30.reduce((a, v) => a + parseFloat(v.total), 0);
  const cantVentas = ventasUlt30.reduce((a, v) => a + parseInt(v.count, 10), 0);
  const ticketPromedio = cantVentas > 0 ? totalMes / cantVentas : 0;

  return (
    <div>
      <PageHeader
        title="Reporte de ventas"
        subtitle={`Últimos 30 días${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Ventas 30 días"
          value={formatearMoneda(totalMes, pais)}
          icon={TrendingUp}
        />
        <KpiCard
          label="N° de transacciones"
          value={String(cantVentas)}
          icon={Receipt}
        />
        <KpiCard
          label="Ticket promedio"
          value={formatearMoneda(ticketPromedio, pais)}
          icon={ShoppingCart}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Ventas diarias" />
          <CardBody>
            {dataDiaria.length === 0 ? (
              <p className="py-8 text-center text-small text-[color:var(--color-text-muted)]">
                Aún no hay ventas en los últimos 30 días
              </p>
            ) : (
              <GraficaVentasDinamica data={dataDiaria} pais={pais} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top 10 productos" />
          <CardBody className="p-0">
            {topProductos.length === 0 ? (
              <p className="px-4 py-8 text-center text-small text-[color:var(--color-text-muted)]">
                Sin ventas registradas
              </p>
            ) : (
              <ol className="divide-y divide-[color:var(--color-border)]">
                {topProductos.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 px-4 py-2 text-small"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {i + 1}. {p.nombre}
                      </div>
                      <div className="text-[11px] text-[color:var(--color-text-muted)]">
                        {p.sku} · {parseFloat(p.cantidad).toFixed(0)} u
                      </div>
                    </div>
                    <div className="font-semibold">
                      {formatearMoneda(parseFloat(p.monto), pais)}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
