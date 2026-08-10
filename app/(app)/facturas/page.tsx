import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, FileText, HandCoins, WalletCards } from "lucide-react";
import { and, count, eq, inArray, sum, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { facturas, ventas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatearMoneda } from "@/lib/utils";
import { getPaisConfig, type PaisCodigo } from "@/lib/paises";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { getEmpresaMetadata } from "@/lib/tenant-data";

export default async function FacturasPage() {
  const user = await requireSession();
  const [scope, empresa] = await Promise.all([
    getSucursalScope(user),
    getEmpresaMetadata(user.empresaId),
  ]);
  const sucursalIds = selectedSucursalIds(scope);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const moneda = getPaisConfig(pais);

  const cond: SQL[] = [eq(facturas.empresaId, user.empresaId)];
  if (sucursalIds) cond.push(inArray(ventas.sucursalId, sucursalIds));

  const resumenRows = await db
    .select({
      esCredito: facturas.esCredito,
      cantidad: count(facturas.id),
      total: sum(facturas.total),
    })
    .from(facturas)
    .leftJoin(ventas, eq(ventas.id, facturas.ventaId))
    .where(and(...cond))
    .groupBy(facturas.esCredito);

  const cobradas = metricas(resumenRows, false);
  const credito = metricas(resumenRows, true);
  const totalCantidad = cobradas.cantidad + credito.cantidad;
  const totalMonto = cobradas.total + credito.total;

  return (
    <div>
      <PageHeader
        title="Facturas"
        subtitle={`Facturas cobradas y al credito${scope.visible ? ` - ${scope.etiqueta}` : ""}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Facturas emitidas"
          value={String(totalCantidad)}
          hint={formatearMoneda(totalMonto, pais)}
          icon={FileText}
        />
        <KpiCard
          label="Cobradas"
          value={String(cobradas.cantidad)}
          hint={formatearMoneda(cobradas.total, pais)}
          icon={WalletCards}
        />
        <KpiCard
          label="Al credito"
          value={String(credito.cantidad)}
          hint={formatearMoneda(credito.total, pais)}
          icon={HandCoins}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SubmoduloCard
          href="/facturas/cobradas"
          icon={CheckCircle2}
          titulo="Facturas cobradas"
          descripcion={`Aumentan caja o banco en ${moneda.moneda}.`}
          cantidad={cobradas.cantidad}
          total={formatearMoneda(cobradas.total, pais)}
        />
        <SubmoduloCard
          href="/facturas/credito"
          icon={Clock}
          titulo="Facturas al credito"
          descripcion="Generan cuenta por cobrar a clientes."
          cantidad={credito.cantidad}
          total={formatearMoneda(credito.total, pais)}
        />
      </div>
    </div>
  );
}

function metricas(
  rows: { esCredito: boolean; cantidad: number; total: string | null }[],
  esCredito: boolean,
) {
  const row = rows.find((item) => item.esCredito === esCredito);
  return {
    cantidad: Number(row?.cantidad ?? 0),
    total: parseFloat(row?.total ?? "0"),
  };
}

function SubmoduloCard({
  href,
  icon: Icon,
  titulo,
  descripcion,
  cantidad,
  total,
}: {
  href: string;
  icon: typeof CheckCircle2;
  titulo: string;
  descripcion: string;
  cantidad: number;
  total: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition hover:border-[color:var(--color-tertiary)] hover:shadow-md">
        <CardBody>
          <div className="flex items-start justify-between gap-4">
            <div className="inline-flex rounded-md bg-[color:var(--color-surface-2)] p-2 text-[color:var(--color-primary)] transition group-hover:bg-[color:var(--color-tertiary)]/20">
              <Icon size={18} />
            </div>
            <ArrowRight
              size={18}
              className="text-[color:var(--color-text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--color-primary)]"
            />
          </div>
          <div className="mt-4 text-base font-semibold text-[color:var(--color-text-primary)]">
            {titulo}
          </div>
          <p className="mt-1 text-small text-[color:var(--color-text-muted)]">{descripcion}</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-label">Facturas</div>
              <div className="text-xl font-semibold text-[color:var(--color-text-primary)]">
                {cantidad}
              </div>
            </div>
            <div className="text-right">
              <div className="text-label">Total</div>
              <div className="text-xl font-semibold text-[color:var(--color-text-primary)]">
                {total}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
