import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import { BarChart3, PieChart } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import { restauranteOrdenItems } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { cargarResumenFoodCost } from "@/lib/restaurante/queries";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RestaurantModuleGrid } from "@/components/restaurante/RestaurantCoreModulePage";

export const metadata: Metadata = {
  title: "Reportes Restaurante | ARCA",
  description: "Reportes operativos, financieros, fiscales y de personal para restaurantes.",
};

export default async function RestauranteReportesPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-reportes");
  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const [foodCost, menuRows] = await Promise.all([
    cargarResumenFoodCost({ empresaId: user.empresaId }),
    dbConEmpresa(user.empresaId, (tx) =>
      tx
        .select({
          nombre: restauranteOrdenItems.nombreSnapshot,
          unidades: sql<string>`COALESCE(SUM(${restauranteOrdenItems.cantidad}), 0)`,
          ingresos: sql<string>`COALESCE(SUM(${restauranteOrdenItems.cantidad} * ${restauranteOrdenItems.precioUnitario}), 0)`,
          costo: sql<string>`COALESCE(SUM(${restauranteOrdenItems.cantidad} * ${restauranteOrdenItems.costoUnitario}), 0)`,
        })
        .from(restauranteOrdenItems)
        .where(eq(restauranteOrdenItems.empresaId, user.empresaId))
        .groupBy(restauranteOrdenItems.nombreSnapshot)
        .orderBy(desc(sql`SUM(${restauranteOrdenItems.cantidad})`))
        .limit(50),
    ),
  ]);

  const maxUnidades = Math.max(
    1,
    ...menuRows.map((row) => parseFloat(row.unidades)),
  );

  return (
    <div className="space-y-5">
      <header>
        <p className="text-label">Analitica restaurante</p>
        <h1 className="mt-1 text-xl">Reportes</h1>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          Food cost, rentabilidad y popularidad sin duplicar datos contables.
        </p>
      </header>

      <RestaurantModuleGrid
        title="Reportes empresariales"
        subtitle="Ventas, inventario, compras, finanzas, fiscal y personal usando el mismo ARCA Core."
        actions={[
          { href: "/restaurante/facturacion", label: "Ventas e impuestos" },
          { href: "/restaurante/existencias", label: "Inventario y vencimientos" },
          { href: "/restaurante/compras", label: "Compras y costos" },
          { href: "/restaurante/tesoreria", label: "Flujo y tesoreria" },
          { href: "/restaurante/gastos", label: "Gastos operativos" },
          { href: "/restaurante/nomina", label: "Nomina y personal" },
          { href: "/restaurante/contabilidad", label: "Libro contable" },
          { href: "/restaurante/auditoria", label: "Auditoria" },
        ]}
      />

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <PieChart size={16} /> Food cost por receta
              </span>
            }
          />
          <CardBody>
            {foodCost.length === 0 ? (
              <p className="py-8 text-center text-small text-[color:var(--color-text-muted)]">
                Crea recetas para ver food cost.
              </p>
            ) : (
              <div className="space-y-3">
                {foodCost.map((row) => (
                  <div key={row.id} className="rounded-md bg-[color:var(--color-surface-2)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{row.nombre}</span>
                      <Badge variant={row.foodCostPct > 35 ? "warning" : "success"}>
                        {row.foodCostPct.toFixed(2)}%
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-[color:var(--color-text-muted)]">
                      <span>Costo {formatearMoneda(row.costoPorPorcion, pais)}</span>
                      <span>Precio {formatearMoneda(row.precioVenta, pais)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <BarChart3 size={16} /> Ingenieria de menu
              </span>
            }
          />
          <CardBody>
            {menuRows.length === 0 ? (
              <p className="py-8 text-center text-small text-[color:var(--color-text-muted)]">
                No hay ventas de platillos aun.
              </p>
            ) : (
              <div className="space-y-3">
                {menuRows.map((row) => {
                  const unidades = parseFloat(row.unidades);
                  const ingresos = parseFloat(row.ingresos);
                  const costo = parseFloat(row.costo);
                  const margen = ingresos - costo;
                  const margenPct = ingresos > 0 ? margen / ingresos : 0;
                  const popular = unidades >= maxUnidades * 0.5;
                  const rentable = margenPct >= 0.6;
                  return (
                    <div key={row.nombre} className="rounded-md bg-[color:var(--color-surface-2)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-medium">{row.nombre}</span>
                        <Badge variant={rentable ? "success" : "warning"}>
                          {clasificar(popular, rentable)}
                        </Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[12px] text-[color:var(--color-text-muted)]">
                        <span>{unidades.toFixed(0)} uds</span>
                        <span>{formatearMoneda(ingresos, pais)}</span>
                        <span>Margen {formatearMoneda(margen, pais)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function clasificar(popular: boolean, rentable: boolean): string {
  if (popular && rentable) return "Estrella";
  if (popular && !rentable) return "Caballo";
  if (!popular && rentable) return "Rompecabezas";
  return "Perro";
}
