import Link from "next/link";
import { Plus, Receipt, Repeat2 } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gastos, categoriasGasto } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatearMoneda, formatearFecha } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

export default async function TesoreriaPage() {
  const user = await requireSession();

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

  const [empresa, gastosRecientes] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    gastosPromise,
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tesorería"
        subtitle="Gastos operativos y movimientos de dinero"
        actions={
          <Link href="/tesoreria/gastos/nuevo" className="arca-btn arca-btn-primary arca-btn-sm">
            <Plus size={14} /> Registrar gasto
          </Link>
        }
      />

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
                  className="arca-btn arca-btn-primary arca-btn-sm"
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
        <Link href="/tesoreria/gastos" className="arca-btn arca-btn-secondary arca-btn-sm">
          <Receipt size={14} /> Todos los gastos
        </Link>
        <Link href="/tesoreria/gastos/recurrentes" className="arca-btn arca-btn-secondary arca-btn-sm">
          <Repeat2 size={14} /> Gastos recurrentes
        </Link>
      </div>
    </div>
  );
}
