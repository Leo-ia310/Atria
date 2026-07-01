"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Receipt, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useApi, ApiAviso } from "@/lib/use-api";
import { formatearMoneda, formatearFechaHora } from "@/lib/utils";

type Venta = {
  id: string;
  number: string;
  soldAt: string;
  status: string;
  type: string;
  grandTotal: string | number;
  paidTotal: string | number;
  customer: { fullName: string } | null;
  branch: { name: string };
  items: { id: string }[];
};

type Analytics = {
  revenue: number;
  averageTicket: number;
  totalSales: number;
  topCustomers: { id: string; nombre: string; total: number }[];
};

export default function VentasPage() {
  const router = useRouter();
  const { data: ventas, loading, apiDisabled, error } = useApi<Venta[]>("/sales");
  const analytics = useApi<Analytics>("/sales/analytics");

  const columnas: Columna<Venta>[] = [
    {
      key: "numero",
      header: "N°",
      cell: (r) => <span className="font-mono text-[12px]">{r.number}</span>,
      width: "120px",
    },
    {
      key: "fecha",
      header: "Fecha",
      cell: (r) => formatearFechaHora(r.soldAt),
      width: "180px",
    },
    {
      key: "cliente",
      header: "Cliente",
      cell: (r) =>
        r.customer?.fullName ?? (
          <span className="italic text-[color:var(--color-text-muted)]">Consumidor final</span>
        ),
    },
    {
      key: "items",
      header: "Items",
      align: "right",
      cell: (r) => String(r.items.length),
      width: "70px",
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (r) => <span className="font-semibold">{formatearMoneda(Number(r.grandTotal))}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) => {
        const v = r.status === "COMPLETED" ? "success" : r.status === "VOID" ? "error" : "warning";
        return <Badge variant={v as never}>{r.status}</Badge>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle={loading ? "Cargando..." : `${ventas?.length ?? 0} ventas registradas`}
        actions={
          <Link href="/pos" className="atria-btn atria-btn-primary atria-btn-sm">
            <ShoppingCart size={14} /> Abrir POS
          </Link>
        }
      />

      <ApiAviso apiDisabled={apiDisabled} error={error} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Ventas 30 días"
          value={formatearMoneda(analytics.data?.revenue ?? 0)}
          icon={TrendingUp}
          hint={`${analytics.data?.totalSales ?? 0} transacciones`}
        />
        <KpiCard
          label="Ticket promedio"
          value={formatearMoneda(analytics.data?.averageTicket ?? 0)}
          icon={Receipt}
        />
        <KpiCard
          label="Top clientes"
          value={String(analytics.data?.topCustomers.length ?? 0)}
          icon={Users}
          hint="Activos este mes"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {ventas && ventas.length === 0 ? (
            <Card>
              <EmptyState
                icon={Receipt}
                titulo="Aún no hay ventas"
                descripcion="Abre el POS y haz tu primera venta."
                accion={
                  <Link href="/pos">
                    <Button size="sm">
                      <ShoppingCart size={14} /> Ir al POS
                    </Button>
                  </Link>
                }
              />
            </Card>
          ) : (
            <DataTable
              data={ventas ?? []}
              columns={columnas}
              rowKey={(r) => r.id}
              onRowClick={(r) => router.push(`/app/ventas/${r.id}`)}
            />
          )}
        </div>

        <Card>
          <CardHeader title="Top clientes" subtitle="Por monto facturado" />
          <CardBody className="p-0">
            {!analytics.data || analytics.data.topCustomers.length === 0 ? (
              <div className="px-4 py-6 text-center text-small text-[color:var(--color-text-muted)]">
                Sin datos aún
              </div>
            ) : (
              <ol className="divide-y divide-[color:var(--color-border)]">
                {analytics.data.topCustomers.map((c, i) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 px-4 py-3 text-small"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {i + 1}. {c.nombre}
                      </div>
                    </div>
                    <div className="font-semibold">{formatearMoneda(c.total)}</div>
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
