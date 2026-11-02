import Link from "next/link";
import { Truck, Plus } from "lucide-react";
import { asc, count } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import {
  FiltrosListado,
  PaginacionListado,
} from "@/components/ui/FiltrosListado";
import { supplierListWhere } from "@/lib/list-query";
import {
  hasListFilters,
  LIST_PAGE_SIZE,
  parseListFilters,
  type ListSearchParams,
} from "@/lib/list-filters";
import { proveedores } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";

type Fila = {
  id: string;
  razonSocial: string;
  identificacionFiscal: string | null;
  telefono: string | null;
  diasCredito: number;
};

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>;
}) {
  const [user, sp] = await Promise.all([requireSession(), searchParams]);
  const filters = parseListFilters(sp, "proveedores"),
    where = supplierListWhere(user.empresaId, filters);

  const { filas, total, pagina } = await dbConEmpresa(
    user.empresaId,
    async (tx) => {
      const [{ total }] = await tx
        .select({ total: count() })
        .from(proveedores)
        .where(where);
      const pagina = Math.min(
        filters.pagina,
        Math.max(1, Math.ceil(total / LIST_PAGE_SIZE)),
      );
      const filas: Fila[] = await tx
        .select({
          id: proveedores.id,
          razonSocial: proveedores.razonSocial,
          identificacionFiscal: proveedores.identificacionFiscal,
          telefono: proveedores.telefono,
          diasCredito: proveedores.diasCredito,
        })
        .from(proveedores)
        .where(where)
        .orderBy(asc(proveedores.razonSocial), asc(proveedores.id))
        .limit(LIST_PAGE_SIZE)
        .offset((pagina - 1) * LIST_PAGE_SIZE);
      return { filas, total, pagina };
    },
  );
  filters.pagina = pagina;

  const columnas: Columna<Fila>[] = [
    {
      key: "nombre",
      header: "Proveedor",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.razonSocial}</div>
          {r.identificacionFiscal && (
            <div className="text-[12px] text-[color:var(--color-text-muted)]">
              {r.identificacionFiscal}
            </div>
          )}
        </div>
      ),
    },
    { key: "telefono", header: "Teléfono", cell: (r) => r.telefono ?? "—" },
    {
      key: "credito",
      header: "Crédito",
      cell: (r) => (r.diasCredito > 0 ? `${r.diasCredito} días` : "Contado"),
    },
    {
      key: "accion",
      header: "",
      align: "right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/cxp?proveedorId=${r.id}`}
            className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-secondary)] text-[12px]"
          >
            Pagos
          </Link>
          <Link
            href={`/compras/proveedores/${r.id}`}
            className="text-[color:var(--color-secondary)] hover:underline"
          >
            Editar →
          </Link>
        </div>
      ),
      width: "160px",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Proveedores"
        subtitle={`${total} proveedores${hasListFilters(filters) ? " encontrados" : " registrados"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportarExcel recurso="proveedores" />
            <Link
              href="/compras/proveedores/nuevo"
              className="arca-btn arca-btn-primary arca-btn-sm"
            >
              <Plus size={14} /> Nuevo proveedor
            </Link>
          </div>
        }
      />
      <FiltrosListado
        kind="proveedores"
        path="/compras/proveedores"
        value={filters}
      />
      <DataTable
        data={filas}
        columns={columnas}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={Truck}
            titulo={
              hasListFilters(filters)
                ? "No hay proveedores con estos filtros"
                : "Aún no hay proveedores"
            }
            descripcion={
              hasListFilters(filters)
                ? "Prueba otra búsqueda o limpia los filtros."
                : "Registra a tus proveedores para crear órdenes de compra."
            }
            accion={
              <Link href="/compras/proveedores/nuevo">
                <Button size="sm">
                  <Plus size={14} /> Crear primer proveedor
                </Button>
              </Link>
            }
          />
        }
      />
      <PaginacionListado
        path="/compras/proveedores"
        value={filters}
        total={total}
      />
    </div>
  );
}
