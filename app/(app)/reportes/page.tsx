import Link from "next/link";
import { TrendingUp, Package, Coins } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";

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

export default function ReportesPage() {
  return (
    <div>
      <PageHeader
        title="Reportes"
        subtitle="Métricas y análisis del negocio"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTES.map((r) => (
          <Link key={r.href} href={r.href} className="group">
            <Card className="transition hover:border-[color:var(--color-tertiary)] hover:shadow-md">
              <CardBody>
                <div className="mb-3 inline-flex rounded-md bg-[color:var(--color-surface-2)] p-2 text-[color:var(--color-primary)] transition group-hover:bg-[color:var(--color-tertiary)]/20">
                  <r.icon size={18} />
                </div>
                <div className="text-base font-semibold text-[color:var(--color-text-primary)]">
                  {r.titulo}
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
