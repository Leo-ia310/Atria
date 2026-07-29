import Link from "next/link";
import { BookOpen, BookText, TableProperties, FileBarChart, PieChart, Calendar } from "lucide-react";
import { count, eq, and, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  asientosContables,
  periodosContables,
  asientoPartidas,
  catalogoCuentas,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { formatearMoneda } from "@/lib/utils";
import { getEmpresaMetadata } from "@/lib/tenant-data";

export default async function ContabilidadPage() {
  const user = await requireSession();
  const hoy = new Date();
  const [empresa, asientosRows, periodoRows, resumenRows] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    db
      .select({ n: count() })
      .from(asientosContables)
      .where(eq(asientosContables.empresaId, user.empresaId)),
    db
      .select({
        id: periodosContables.id,
        anio: periodosContables.anio,
        mes: periodosContables.mes,
        estado: periodosContables.estado,
      })
      .from(periodosContables)
      .where(
        and(
          eq(periodosContables.empresaId, user.empresaId),
          eq(periodosContables.anio, hoy.getFullYear()),
          eq(periodosContables.mes, hoy.getMonth() + 1),
        ),
      )
      .limit(1),
    db
      .select({
        debe: sum(asientoPartidas.debe),
        haber: sum(asientoPartidas.haber),
      })
      .from(asientoPartidas)
      .innerJoin(
        asientosContables,
        eq(asientosContables.id, asientoPartidas.asientoId),
      )
      .where(
        and(
          eq(asientosContables.empresaId, user.empresaId),
          eq(asientosContables.estado, "registrado"),
        ),
      ),
  ]);
  const pais = empresa?.pais ?? "NI";
  const asientosCount = asientosRows[0];
  const periodoActual = periodoRows[0];
  const resumen = resumenRows[0];

  const totalMovimiento = parseFloat(resumen?.debe ?? "0");
  const balanceado =
    Math.abs(parseFloat(resumen?.debe ?? "0") - parseFloat(resumen?.haber ?? "0")) < 0.01;

  const mesesEs = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  return (
    <div>
      <PageHeader
        title="Contabilidad"
        subtitle={
          periodoActual
            ? `Período activo: ${mesesEs[periodoActual.mes - 1]} ${periodoActual.anio} · ${periodoActual.estado}`
            : "Sin período abierto"
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Asientos registrados"
          value={String(asientosCount?.n ?? 0)}
          hint="Todo el histórico"
          icon={BookOpen}
        />
        <KpiCard
          label="Movimiento total"
          value={formatearMoneda(totalMovimiento, pais)}
          hint={balanceado ? "Libros balanceados" : "Hay desbalance"}
          icon={TableProperties}
          delta={balanceado ? "✓" : "✗"}
          deltaPositive={balanceado}
        />
        <KpiCard
          label="Estado del período"
          value={periodoActual?.estado === "abierto" ? "Abierto" : periodoActual?.estado ?? "—"}
          hint="Puedes registrar operaciones"
          icon={FileBarChart}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ModuloLink
          href="/contabilidad/libro-diario"
          icon={BookOpen}
          titulo="Libro Diario"
          descripcion="Todos los asientos en orden cronológico"
        />
        <ModuloLink
          href="/contabilidad/libro-mayor"
          icon={BookText}
          titulo="Libro Mayor"
          descripcion="Movimientos por cuenta con saldo corrido"
        />
        <ModuloLink
          href="/contabilidad/balance-comprobacion"
          icon={TableProperties}
          titulo="Balance de comprobación"
          descripcion="Saldos deudores vs acreedores por cuenta"
        />
        <ModuloLink
          href="/contabilidad/estado-resultados"
          icon={FileBarChart}
          titulo="Estado de Resultados"
          descripcion="Ingresos, costos, gastos y utilidad"
        />
        <ModuloLink
          href="/contabilidad/balance-general"
          icon={PieChart}
          titulo="Balance General"
          descripcion="Activos, pasivos y patrimonio"
        />
        <ModuloLink
          href="/contabilidad/catalogo-cuentas"
          icon={BookText}
          titulo="Catálogo de cuentas"
          descripcion="Plan de cuentas de tu empresa"
        />
        <ModuloLink
          href="/contabilidad/periodos"
          icon={Calendar}
          titulo="Períodos contables"
          descripcion="Abrir y cerrar períodos mensuales"
        />
      </div>
    </div>
  );
}

import type { LucideIcon } from "lucide-react";

function ModuloLink({
  href,
  icon: Icon,
  titulo,
  descripcion,
}: {
  href: string;
  icon: LucideIcon;
  titulo: string;
  descripcion: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="transition hover:border-[color:var(--color-tertiary)] hover:shadow-md">
        <CardBody>
          <div className="mb-3 inline-flex rounded-md bg-[color:var(--color-surface-2)] p-2 text-[color:var(--color-primary)] transition group-hover:bg-[color:var(--color-tertiary)]/20">
            <Icon size={18} />
          </div>
          <div className="text-base font-semibold text-[color:var(--color-text-primary)]">
            {titulo}
          </div>
          <p className="mt-1 text-small text-[color:var(--color-text-muted)]">{descripcion}</p>
        </CardBody>
      </Card>
    </Link>
  );
}
