import Link from "next/link";
import {
  TrendingUp,
  Package,
  Coins,
  Receipt,
  Percent,
  ArrowRight,
} from "lucide-react";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ventas, existencias, productos, almacenes } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatearMoneda } from "@/lib/utils";

const REPORTES = [
  {
    href: "/reportes/ventas",
    icon: TrendingUp,
    titulo: "Reporte de ventas",
    descripcion: "Ventas diarias, top productos y ticket promedio",
  },
  {
    href: "/reportes/inventario",
    icon: Package,
    titulo: "Reporte de inventario",
    descripcion: "Stock valorizado, productos con bajo stock",
  },
  {
    href: "/reportes/rentabilidad",
    icon: Coins,
    titulo: "Rentabilidad",
    descripcion: "Margen bruto por producto y categoría",
  },
];

export default async function ReportesPage() {
  const user = await requireSession();
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = empresa?.pais ?? "NI";
  const sucursalIds = selectedSucursalIds(scope);

  const hace30 = new Date();
  hace30.setDate(hace30.getDate() - 30);

  const [ventasRow, inventarioRow] = await Promise.all([
    db
      .select({
        total: sql<string>`COALESCE(SUM(${ventas.total}), 0)`,
        costo: sql<string>`COALESCE(SUM(${ventas.costoTotal}), 0)`,
        count: sql<string>`COUNT(*)`,
      })
      .from(ventas)
      .where(
        and(
          eq(ventas.empresaId, user.empresaId),
          eq(ventas.estado, "completada"),
          gte(ventas.fecha, hace30),
          sucursalIds ? inArray(ventas.sucursalId, sucursalIds) : undefined,
        ),
      ),
    db
      .select({
        valor: sql<string>`COALESCE(SUM(${existencias.cantidad} * ${productos.costoPromedio}), 0)`,
      })
      .from(existencias)
      .innerJoin(productos, eq(productos.id, existencias.productoId))
      .innerJoin(almacenes, eq(almacenes.id, existencias.almacenId))
      .where(
        and(
          eq(existencias.empresaId, user.empresaId),
          eq(almacenes.activo, true),
          sucursalIds ? inArray(almacenes.sucursalId, sucursalIds) : undefined,
        ),
      ),
  ]);

  const totalVentas = parseFloat(ventasRow[0]?.total ?? "0");
  const costoVentas = parseFloat(ventasRow[0]?.costo ?? "0");
  const numVentas = parseInt(ventasRow[0]?.count ?? "0", 10);
  const valorInventario = parseFloat(inventarioRow[0]?.valor ?? "0");
  const margen = totalVentas - costoVentas;
  const margenPct = totalVentas > 0 ? (margen / totalVentas) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Reportes"
        subtitle={`Métricas y análisis del negocio${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Ventas 30 días"
          value={formatearMoneda(totalVentas, pais)}
          icon={TrendingUp}
        />
        <KpiCard label="Transacciones" value={String(numVentas)} icon={Receipt} />
        <KpiCard
          label="Margen bruto 30 días"
          value={`${formatearMoneda(margen, pais)} · ${margenPct.toFixed(0)}%`}
          icon={Percent}
        />
        <KpiCard
          label="Valor de inventario"
          value={formatearMoneda(valorInventario, pais)}
          icon={Package}
        />
      </div>

      <h2 className="mb-3 mt-8 text-base font-semibold text-[color:var(--color-text-primary)]">
        Reportes detallados
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTES.map((r) => (
          <Link key={r.href} href={r.href} className="group">
            <Card className="h-full transition hover:border-[color:var(--color-tertiary)] hover:shadow-md">
              <CardBody>
                <div className="mb-3 inline-flex rounded-md bg-[color:var(--color-surface-2)] p-2 text-[color:var(--color-primary)] transition group-hover:bg-[color:var(--color-tertiary)]/20">
                  <r.icon size={18} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-base font-semibold text-[color:var(--color-text-primary)]">
                    {r.titulo}
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-[color:var(--color-text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--color-primary)]"
                  />
                </div>
                <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
                  {r.descripcion}
                </p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
