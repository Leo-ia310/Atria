import { Suspense } from "react";
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
import { empresas, sucursales } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { formatearMoneda, formatearFechaHora } from "@/lib/utils";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenida?: string }>;
}) {
  const user = await requireSession();
  const params = await searchParams;
  const esBienvenida = params.bienvenida === "1";

  const [empresa] = await db
    .select({ pais: empresas.pais, razonSocial: empresas.razonSocial })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);

  const sucs = await db
    .select({ id: sucursales.id, nombre: sucursales.nombre })
    .from(sucursales)
    .where(
      and(eq(sucursales.empresaId, user.empresaId), isNull(sucursales.eliminadoEn)),
    );

  return (
    <div>
      <PageHeader
        title="Operaciones del día"
        subtitle={`Bienvenido, ${user.nombre}. Sistema sincronizado.`}
        actions={
          <span className="atria-badge atria-badge-success">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
            En línea
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
                Bienvenido a ATRIA, {user.nombre.split(" ")[0]}
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

      <Suspense fallback={null}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Ventas hoy"
            value={formatearMoneda(0, empresa?.pais ?? "NI")}
            hint="Aún no hay ventas registradas"
            icon={Receipt}
          />
          <KpiCard
            label="Ventas del mes"
            value={formatearMoneda(0, empresa?.pais ?? "NI")}
            hint="Tu primer mes apenas comienza"
            icon={TrendingUp}
          />
          <KpiCard
            label="Productos en catálogo"
            value="0"
            hint="Crea tu primer producto"
            icon={Package}
          />
          <KpiCard
            label="Cuentas por cobrar"
            value={formatearMoneda(0, empresa?.pais ?? "NI")}
            hint="Sin saldos pendientes"
            icon={Wallet}
          />
        </div>
      </Suspense>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Actividad reciente"
            subtitle="Tus últimas operaciones aparecerán aquí"
          />
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
        </Card>

        <Card>
          <CardHeader title="Tu cuenta" />
          <CardBody className="space-y-3 text-small">
            <Fila label="Sucursales activas" valor={String(sucs.length)} />
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
