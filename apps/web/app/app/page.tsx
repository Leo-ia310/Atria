"use client";

import { Suspense, useMemo, useState } from "react";
import {
  Receipt,
  Package,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
  Building2,
  Clock,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSession } from "@/components/layout/SessionProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useApi, ApiAviso } from "@/lib/use-api";
import { formatearMoneda, formatearFechaHora } from "@/lib/utils";

type Overview = {
  kpis: {
    ventasHoy: { total: number; transacciones: number };
    ingresosMes: { total: number; cobrados: number; transacciones: number; delta: number };
    alertasInventario: number;
    cuentasPorCobrar: number;
    margenBruto: number;
  };
  ventasSerie: { fecha: string; total: number }[];
  stockCritico: {
    id: string;
    producto: string;
    disponible: number;
    minimo: number;
    sucursal: string;
  }[];
  rendimientoEquipo: {
    miembroId: string | null;
    nombre: string;
    transacciones: number;
    total: number;
  }[];
  rendimientoSucursales: {
    sucursalId: string;
    nombre: string;
    ingresosMes: number;
    transacciones: number;
  }[];
  accionRequerida: {
    id: string;
    tipo: "factura_vencida";
    cliente: string;
    venta: string;
    monto: number;
    diasVencido: number;
  }[];
  actividadReciente: {
    id: string;
    actor: string;
    modulo: string;
    accion: string;
    entidad: string;
    fecha: string;
  }[];
};

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const params = useSearchParams();
  const esBienvenida = params.get("bienvenida") === "1";
  const { user } = useSession();
  const { data, loading, apiDisabled, error } = useApi<Overview>("/dashboard/overview");
  const [vista, setVista] = useState<"semanal" | "diaria">("diaria");

  const chartData = useMemo(() => {
    if (!data) return [];
    const serie = data.ventasSerie;
    if (vista === "diaria") {
      return serie.map((p) => ({
        etiqueta: p.fecha.slice(5),
        total: p.total,
      }));
    }
    const semanas: { etiqueta: string; total: number }[] = [];
    for (let i = 0; i < serie.length; i += 7) {
      const tramo = serie.slice(i, i + 7);
      semanas.push({
        etiqueta: `Sem ${semanas.length + 1}`,
        total: tramo.reduce((acc, p) => acc + p.total, 0),
      });
    }
    return semanas;
  }, [data, vista]);

  return (
    <div>
      <PageHeader
        title="Resumen de operaciones"
        subtitle={user ? `Bienvenido, ${user.firstName}. Datos del mes en curso.` : "Cargando..."}
        actions={
          <span className="atria-badge atria-badge-success">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
            Sincronizado
          </span>
        }
      />

      {esBienvenida && (
        <div className="mb-6 atria-card overflow-hidden border-[color:var(--color-tertiary)]/40 bg-gradient-to-br from-[color:var(--color-tertiary-light)]/30 to-[color:var(--color-surface)]">
          <div className="flex items-start gap-4 p-5">
            <div className="rounded-md bg-[color:var(--color-primary)] p-2.5 text-white">
              <Sparkles size={20} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg text-[color:var(--color-text-primary)]">
                Bienvenido a Atria{user ? `, ${user.firstName}` : ""}
              </h2>
              <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
                Tu empresa <strong>{user?.organizationName}</strong> está lista. Te
                configuramos roles, sucursal principal, almacén y formas de pago automáticamente.
              </p>
            </div>
          </div>
        </div>
      )}

      <ApiAviso apiDisabled={apiDisabled} error={error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ingresos del mes"
          value={formatearMoneda(data?.kpis.ingresosMes.total ?? 0)}
          delta={
            data && data.kpis.ingresosMes.delta !== 0
              ? `${Math.abs(data.kpis.ingresosMes.delta).toFixed(1)}%`
              : undefined
          }
          deltaPositive={(data?.kpis.ingresosMes.delta ?? 0) >= 0}
          hint={loading ? "Cargando..." : `${data?.kpis.ingresosMes.transacciones ?? 0} ventas`}
          icon={TrendingUp}
        />
        <KpiCard
          label="Margen bruto"
          value={`${(data?.kpis.margenBruto ?? 0).toFixed(1)}%`}
          hint="Utilidad sobre costo de ventas · MTD"
          icon={Receipt}
        />
        <KpiCard
          label="Cuentas por cobrar"
          value={formatearMoneda(data?.kpis.cuentasPorCobrar ?? 0)}
          hint={
            data && data.accionRequerida.length > 0
              ? `${data.accionRequerida.length} vencidas`
              : "Al día"
          }
          icon={Wallet}
        />
        <KpiCard
          label="Alertas de stock bajo"
          value={String(data?.kpis.alertasInventario ?? 0)}
          hint={data?.kpis.alertasInventario ? "Productos bajo mínimo" : "Inventario en orden"}
          icon={Package}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Ingresos vs volumen"
            subtitle="Últimos 14 días"
            actions={
              <div className="flex items-center gap-1 rounded-md bg-[color:var(--color-surface-2)] p-1">
                {(["semanal", "diaria"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVista(v)}
                    className={
                      "rounded px-2.5 py-1 text-[12px] font-medium capitalize transition " +
                      (vista === v
                        ? "bg-[color:var(--color-surface)] text-[color:var(--color-text-primary)] shadow-sm"
                        : "text-[color:var(--color-text-muted)]")
                    }
                  >
                    {v}
                  </button>
                ))}
              </div>
            }
          />
          <CardBody>
            {!data || chartData.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-small text-[color:var(--color-text-muted)]">
                {loading ? "Cargando..." : "Sin ventas registradas aún"}
              </div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis
                      dataKey="etiqueta"
                      tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--color-surface-2)" }}
                      formatter={(value: number) => formatearMoneda(value)}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid var(--color-border)",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="total" fill="var(--color-tertiary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Acción requerida"
            actions={
              data && data.accionRequerida.length > 0 ? (
                <Badge variant="error">{data.accionRequerida.length}</Badge>
              ) : undefined
            }
          />
          <CardBody className="p-0">
            {!data || data.accionRequerida.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={AlertTriangle}
                  titulo={data ? "Nada pendiente" : "Cargando..."}
                  descripcion={data ? "No hay facturas vencidas por cobrar." : undefined}
                />
              </div>
            ) : (
              <ul className="divide-y divide-[color:var(--color-border)]">
                {data.accionRequerida.map((a) => (
                  <li key={a.id} className="px-4 py-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-small font-semibold">Factura {a.venta} vencida</span>
                      <Badge variant="error">{a.diasVencido}d</Badge>
                    </div>
                    <p className="text-[12px] text-[color:var(--color-text-muted)]">
                      {a.cliente} · {formatearMoneda(a.monto)} pendiente
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Rendimiento por sucursal" subtitle="Ingresos del mes en curso" />
          <CardBody className="p-0">
            {!data || data.rendimientoSucursales.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Building2}
                  titulo={data ? "Sin ventas este mes" : "Cargando..."}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-small">
                  <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                    <tr>
                      <th className="text-label px-5 py-3 text-left font-semibold">Sucursal</th>
                      <th className="text-label px-5 py-3 text-right font-semibold">Ingresos (mes)</th>
                      <th className="text-label px-5 py-3 text-right font-semibold">Transacciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rendimientoSucursales.map((s) => (
                      <tr key={s.sucursalId} className="border-b border-[color:var(--color-border)] last:border-b-0">
                        <td className="px-5 py-3 font-medium">{s.nombre}</td>
                        <td className="px-5 py-3 text-right">{formatearMoneda(s.ingresosMes)}</td>
                        <td className="px-5 py-3 text-right text-[color:var(--color-text-muted)]">
                          {s.transacciones}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Actividad reciente" />
          <CardBody className="p-0">
            {!data || data.actividadReciente.length === 0 ? (
              <div className="p-6 text-center text-small text-[color:var(--color-text-muted)]">
                Sin actividad registrada aún
              </div>
            ) : (
              <ul className="max-h-[340px] divide-y divide-[color:var(--color-border)] overflow-y-auto">
                {data.actividadReciente.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 px-4 py-3 text-small">
                    <Clock size={13} className="mt-0.5 shrink-0 text-[color:var(--color-text-muted)]" />
                    <div className="min-w-0 flex-1">
                      <p>
                        <strong>{a.actor}</strong> · {a.accion} {a.entidad}
                      </p>
                      <p className="text-[11px] text-[color:var(--color-text-muted)]">
                        {formatearFechaHora(a.fecha)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {data && data.stockCritico.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title="Stock crítico"
            subtitle="Productos al nivel mínimo o por debajo"
            actions={
              <a
                href="/app/inventario"
                className="flex items-center gap-1 text-small text-[color:var(--color-secondary)] hover:underline"
              >
                Ver inventario <ArrowUpRight size={13} />
              </a>
            }
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-[color:var(--color-border)]">
              {data.stockCritico.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3 text-small">
                  <div className="rounded-md bg-[color:var(--color-warning-bg)] p-1.5 text-[color:var(--color-warning)]">
                    <AlertTriangle size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{p.producto}</div>
                    <div className="text-[11px] text-[color:var(--color-text-muted)]">{p.sucursal}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {p.disponible.toFixed(0)} / {p.minimo.toFixed(0)}
                    </div>
                    <Badge variant="warning">Bajo</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
