import Link from "next/link";
import { Plus, Receipt, Landmark, Wallet } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuentasFinancieras, gastos, categoriasGasto } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatearMoneda, formatearFecha } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

const ICONO_TIPO = { caja: Wallet, banco: Landmark, tarjeta: Landmark, wallet: Wallet };
const LABEL_TIPO: Record<string, string> = {
  caja: "Caja",
  banco: "Banco",
  tarjeta: "Tarjeta",
  wallet: "Wallet",
};

export default async function TesoreriaPage() {
  const user = await requireSession();

  const cuentasPromise = db
    .select({
      id: cuentasFinancieras.id,
      nombre: cuentasFinancieras.nombre,
      tipo: cuentasFinancieras.tipo,
      banco: cuentasFinancieras.banco,
      saldoActual: cuentasFinancieras.saldoActual,
    })
    .from(cuentasFinancieras)
    .where(eq(cuentasFinancieras.empresaId, user.empresaId))
    .orderBy(cuentasFinancieras.tipo, cuentasFinancieras.nombre);

  const gastosPromise = db
    .select({
      id: gastos.id,
      fecha: gastos.fecha,
      descripcion: gastos.descripcion,
      total: gastos.total,
      categoria: categoriasGasto.nombre,
    })
    .from(gastos)
    .innerJoin(categoriasGasto, eq(categoriasGasto.id, gastos.categoriaId))
    .where(eq(gastos.empresaId, user.empresaId))
    .orderBy(desc(gastos.creadoEn))
    .limit(10);

  const [empresa, cuentas, gastosRecientes] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    cuentasPromise,
    gastosPromise,
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const totalDisponible = cuentas.reduce((a, c) => a + parseFloat(c.saldoActual), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tesorería"
        subtitle="Cuentas financieras y gastos operativos"
        actions={
          <Link href="/tesoreria/gastos/nuevo" className="atria-btn atria-btn-primary atria-btn-sm">
            <Plus size={14} /> Registrar gasto
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cuentas.map((c) => {
          const Icon = ICONO_TIPO[c.tipo] ?? Wallet;
          return (
            <KpiCard
              key={c.id}
              label={c.nombre}
              value={formatearMoneda(parseFloat(c.saldoActual), pais)}
              hint={`${LABEL_TIPO[c.tipo] ?? c.tipo}${c.banco ? ` · ${c.banco}` : ""}`}
              icon={Icon}
            />
          );
        })}
        {cuentas.length > 1 && (
          <KpiCard
            label="Total disponible"
            value={formatearMoneda(totalDisponible, pais)}
            hint="Suma de todas las cuentas activas"
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">
          Gastos recientes
        </h2>
        <Link
          href="/tesoreria/gastos"
          className="text-small text-[color:var(--color-secondary)] hover:underline"
        >
          Ver todos →
        </Link>
      </div>

      {gastosRecientes.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={Receipt}
              titulo="Sin gastos registrados"
              descripcion="Registra alquiler, servicios y otros egresos para llevar el control."
              accion={
                <Link
                  href="/tesoreria/gastos/nuevo"
                  className="atria-btn atria-btn-primary atria-btn-sm"
                >
                  <Plus size={14} /> Registrar primer gasto
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-[color:var(--color-border)]">
            {gastosRecientes.map((g) => (
              <div key={g.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-small font-medium text-[color:var(--color-text-primary)]">
                    {g.descripcion}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[11px] text-[color:var(--color-text-muted)]">
                      {formatearFecha(g.fecha, pais)}
                    </span>
                    <Badge variant="neutral">{g.categoria}</Badge>
                  </div>
                </div>
                <span className="font-semibold text-[color:var(--color-error)]">
                  -{formatearMoneda(parseFloat(g.total), pais)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/tesoreria/gastos" className="atria-btn atria-btn-secondary atria-btn-sm">
          <Receipt size={14} /> Todos los gastos
        </Link>
        <Link href="/tesoreria/cuentas" className="atria-btn atria-btn-secondary atria-btn-sm">
          <Landmark size={14} /> Gestionar cuentas
        </Link>
      </div>
    </div>
  );
}
