import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gastos, categoriasGasto, cuentasFinancieras } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatearMoneda, formatearFecha } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

type Fila = {
  id: string;
  fecha: string;
  descripcion: string;
  referencia: string | null;
  categoria: string;
  cuenta: string;
  subtotal: string;
  impuesto: string;
  total: string;
};

export default async function GastosPage() {
  const user = await requireSession();

  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const filas: Fila[] = await db
    .select({
      id: gastos.id,
      fecha: gastos.fecha,
      descripcion: gastos.descripcion,
      referencia: gastos.referencia,
      categoria: categoriasGasto.nombre,
      cuenta: cuentasFinancieras.nombre,
      subtotal: gastos.subtotal,
      impuesto: gastos.impuesto,
      total: gastos.total,
    })
    .from(gastos)
    .innerJoin(categoriasGasto, eq(categoriasGasto.id, gastos.categoriaId))
    .innerJoin(cuentasFinancieras, eq(cuentasFinancieras.id, gastos.cuentaFinancieraId))
    .where(eq(gastos.empresaId, user.empresaId))
    .orderBy(desc(gastos.fecha), desc(gastos.creadoEn))
    .limit(500);

  const columnas: Columna<Fila>[] = [
    {
      key: "fecha",
      header: "Fecha",
      cell: (r) => formatearFecha(r.fecha, pais),
      width: "110px",
    },
    {
      key: "descripcion",
      header: "Descripción",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.descripcion}</div>
          {r.referencia && (
            <div className="text-[11px] text-[color:var(--color-text-muted)]">{r.referencia}</div>
          )}
        </div>
      ),
    },
    {
      key: "categoria",
      header: "Categoría",
      cell: (r) => <Badge variant="neutral">{r.categoria}</Badge>,
      width: "160px",
    },
    {
      key: "cuenta",
      header: "Cuenta",
      cell: (r) => <span className="text-small">{r.cuenta}</span>,
      width: "150px",
    },
    {
      key: "subtotal",
      header: "Subtotal",
      align: "right",
      cell: (r) => formatearMoneda(parseFloat(r.subtotal), pais),
      width: "110px",
    },
    {
      key: "impuesto",
      header: "IVA",
      align: "right",
      cell: (r) =>
        parseFloat(r.impuesto) > 0 ? (
          formatearMoneda(parseFloat(r.impuesto), pais)
        ) : (
          <span className="text-[color:var(--color-text-muted)]">—</span>
        ),
      width: "90px",
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (r) => (
        <span className="font-semibold text-[color:var(--color-error)]">
          {formatearMoneda(parseFloat(r.total), pais)}
        </span>
      ),
      width: "120px",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Gastos"
        subtitle={`${filas.length} gastos registrados`}
        actions={
          <Link href="/tesoreria/gastos/nuevo" className="atria-btn atria-btn-primary atria-btn-sm">
            <Plus size={14} /> Nuevo gasto
          </Link>
        }
      />
      <DataTable
        data={filas}
        columns={columnas}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={Receipt}
            titulo="Sin gastos registrados"
            descripcion="Registra alquiler, servicios, sueldos y otros gastos operativos."
            accion={
              <Link href="/tesoreria/gastos/nuevo" className="atria-btn atria-btn-primary atria-btn-sm">
                <Plus size={14} /> Registrar primer gasto
              </Link>
            }
          />
        }
      />
    </div>
  );
}
