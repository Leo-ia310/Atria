import Link from "next/link";
import {
  Receipt,
  Package,
  Wallet,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { requireSession } from "@/lib/actions/session-helpers";
import { db } from "@/lib/db";
import {
  sucursales,
  ventas,
  productos,
  cuentasPorCobrar,
  clientes,
} from "@/lib/db/schema";
import { eq, and, isNull, gte, sql, sum, count, desc, inArray } from "drizzle-orm";
import { formatearMoneda, formatearFechaHora } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { getEmpresaMetadata } from "@/lib/tenant-data";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenida?: string }>;
}) {
  const user = await requireSession();
  const [params, empresa, scope] = await Promise.all([
    searchParams,
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const esBienvenida = params.bienvenida === "1";

  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const sucursalIds = selectedSucursalIds(scope);
  const filtroSucursalVenta = sucursalIds
    ? inArray(ventas.sucursalId, sucursalIds)
    : undefined;

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const [ventasHoyRes, ventasMesRes, productosRes, cxcRes, recientes] =
    await Promise.all([
      db
        .select({ total: sum(ventas.total) })
        .from(ventas)
        .where(
          and(
            eq(ventas.empresaId, user.empresaId),
            isNull(ventas.anuladoEn),
            sql`${ventas.fecha}::date = current_date`,
            filtroSucursalVenta,
          ),
        ),
      db
        .select({ total: sum(ventas.total) })
        .from(ventas)
        .where(
          and(
            eq(ventas.empresaId, user.empresaId),
            isNull(ventas.anuladoEn),
            gte(ventas.fecha, inicioMes),
            filtroSucursalVenta,
          ),
        ),
      db
        .select({ n: count() })
        .from(productos)
        .where(
          and(
            eq(productos.empresaId, user.empresaId),
            eq(productos.activo, true),
            isNull(productos.eliminadoEn),
          ),
        ),
      db
        .select({ saldo: sum(cuentasPorCobrar.saldo) })
        .from(cuentasPorCobrar)
        .leftJoin(ventas, eq(ventas.id, cuentasPorCobrar.ventaId))
        .where(
          and(
            eq(cuentasPorCobrar.empresaId, user.empresaId),
            eq(cuentasPorCobrar.estado, "pendiente"),
            filtroSucursalVenta,
          ),
        ),
      db
        .select({
          id: ventas.id,
          numero: ventas.numero,
          fecha: ventas.fecha,
          total: ventas.total,
          esCredito: ventas.esCredito,
          cliente: clientes.nombre,
          sucursal: sucursales.nombre,
        })
        .from(ventas)
        .leftJoin(clientes, eq(clientes.id, ventas.clienteId))
        .leftJoin(sucursales, eq(sucursales.id, ventas.sucursalId))
        .where(
          and(
            eq(ventas.empresaId, user.empresaId),
            isNull(ventas.anuladoEn),
            filtroSucursalVenta,
          ),
        )
        .orderBy(desc(ventas.fecha))
        .limit(6),
    ]);

  const ventasHoy = parseFloat(ventasHoyRes[0]?.total ?? "0");
  const ventasMes = parseFloat(ventasMesRes[0]?.total ?? "0");
  const productosCount = productosRes[0]?.n ?? 0;
  const cxcPendiente = parseFloat(cxcRes[0]?.saldo ?? "0");

  return (
    <div>
      <PageHeader
        title="Operaciones del día"
        subtitle={`Bienvenido, ${user.nombre}. Sistema sincronizado.`}
        actions={
          <span className="arca-badge arca-badge-success">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
            En línea
          </span>
        }
      />

      {esBienvenida && (
        <div className="mb-6 arca-card overflow-hidden border-[color:var(--color-tertiary)]/40 bg-gradient-to-br from-[color:var(--color-tertiary-light)]/30 to-[color:var(--color-surface)]">
          <div className="flex items-start gap-4 p-5">
            <div className="rounded-md bg-[color:var(--color-primary)] p-2.5 text-white">
              <Sparkles size={20} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg text-[color:var(--color-text-primary)]">
                Bienvenido a ARCA, {user.nombre.split(" ")[0]}
              </h2>
              <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
                Tu empresa <strong>{empresa?.razonSocial}</strong> está lista.
                Te configuramos automáticamente:
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-1.5 text-small text-[color:var(--color-text-secondary)] sm:grid-cols-2">
                <li>✓ Sucursal Principal</li>
                <li>✓ Almacén Principal</li>
                <li>✓ Catálogo contable base ({empresa?.pais})</li>
                <li>✓ Período contable abierto</li>
                <li>✓ Roles (Admin, Cajero, Contador, Gerente, Vendedor)</li>
                <li>✓ Formas de pago (Efectivo, Tarjeta, Transferencia, Crédito)</li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/inventario/nuevo">
                  <Button size="sm">Agregar primer producto</Button>
                </Link>
                <Link href="/configuracion/facturacion">
                  <Button variant="secondary" size="sm">
                    Configurar facturación
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Ventas hoy"
            value={formatearMoneda(ventasHoy, pais)}
            hint={ventasHoy > 0 ? "Ventas del día de hoy" : "Aún no hay ventas hoy"}
            icon={Receipt}
          />
          <KpiCard
            label="Ventas del mes"
            value={formatearMoneda(ventasMes, pais)}
            hint="Acumulado del mes en curso"
            icon={TrendingUp}
          />
          <KpiCard
            label="Productos en catálogo"
            value={String(productosCount)}
            hint={productosCount > 0 ? "Productos activos" : "Crea tu primer producto"}
            icon={Package}
          />
          <KpiCard
            label="Cuentas por cobrar"
            value={formatearMoneda(cxcPendiente, pais)}
            hint={cxcPendiente > 0 ? "Saldo pendiente de cobro" : "Sin saldos pendientes"}
            icon={Wallet}
          />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Actividad reciente"
            subtitle="Tus últimas operaciones aparecerán aquí"
          />
          {recientes.length === 0 ? (
            <CardBody>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 rounded-full bg-[color:var(--color-surface-2)] p-3 text-[color:var(--color-text-muted)]">
                  <Receipt size={24} />
                </div>
                <p className="text-base font-medium text-[color:var(--color-text-primary)]">
                  Sin actividad todavía
                </p>
                <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
                  Cuando hagas tu primera venta o compra, la verás aquí.
                </p>
                <Link href="/pos">
                  <Button size="sm" className="mt-4">
                    Abrir POS
                  </Button>
                </Link>
              </div>
            </CardBody>
          ) : (
            <div className="divide-y divide-[color:var(--color-border)]">
              {recientes.map((v) => (
                <Link
                  key={v.id}
                  href={`/ventas/${v.id}`}
                  className="flex items-center justify-between px-4 py-3 transition hover:bg-[color:var(--color-surface-2)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-[color:var(--color-surface-2)] p-2 text-[color:var(--color-primary)]">
                      <Receipt size={16} />
                    </div>
                    <div>
                      <div className="text-small font-medium">{v.numero}</div>
                      <div className="text-[12px] text-[color:var(--color-text-muted)]">
                        {v.cliente ?? "Consumidor final"} · {formatearFechaHora(v.fecha)}
                        {scope.visible && v.sucursal ? ` · ${v.sucursal}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-small font-semibold">
                      {formatearMoneda(parseFloat(v.total), pais)}
                    </div>
                    <div className="text-[11px] text-[color:var(--color-text-muted)]">
                      {v.esCredito ? "Crédito" : "Contado"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Tu cuenta" />
          <CardBody className="space-y-3 text-small">
            <Fila
              label={scope.visible ? "Sucursales en vista" : "Sucursales activas"}
              valor={String(scope.sucursalIds.length)}
            />
            {scope.visible && <Fila label="Alcance" valor={scope.etiqueta} />}
            <Fila label="Último acceso" valor={formatearFechaHora(new Date())} />
            <Fila
              label="Estado fiscal"
              valor={
                <Badge variant="success">Operativo</Badge>
              }
            />
            <Fila
              label="Plan"
              valor={
                <Link href="/configuracion/facturacion" className="text-[color:var(--color-secondary)] hover:underline">
                  Ver detalles →
                </Link>
              }
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Fila({
  label,
  valor,
}: {
  label: string;
  valor: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[color:var(--color-text-muted)]">{label}</span>
      <span className="font-medium text-[color:var(--color-text-primary)]">{valor}</span>
    </div>
  );
}
