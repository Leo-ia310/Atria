import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { asc, count } from "drizzle-orm";
import {
  FiltrosListado,
  PaginacionListado,
} from "@/components/ui/FiltrosListado";
import { customerListWhere } from "@/lib/list-query";
import {
  hasListFilters,
  LIST_PAGE_SIZE,
  parseListFilters,
  type ListSearchParams,
} from "@/lib/list-filters";
import { dbConEmpresa } from "@/lib/db";
import { clientes } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatearMoneda, desdeDecimal } from "@/lib/utils";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";

type Fila = {
  id: string;
  nombre: string;
  identificacionFiscal: string | null;
  telefono: string | null;
  limiteCredito: string;
  diasCredito: number;
  esConsumidorFinal: boolean;
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>;
}) {
  const [user, sp] = await Promise.all([requireSession(), searchParams]);
  const filters = parseListFilters(sp, "clientes"),
    where = customerListWhere(user.empresaId, filters);

  const [empresa, result] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    dbConEmpresa(user.empresaId, async (tx) => {
      const [{ total }] = await tx
        .select({ total: count() })
        .from(clientes)
        .where(where);
      const pagina = Math.min(
        filters.pagina,
        Math.max(1, Math.ceil(total / LIST_PAGE_SIZE)),
      );
      const filas = await tx
        .select({
          id: clientes.id,
          nombre: clientes.nombre,
          identificacionFiscal: clientes.identificacionFiscal,
          telefono: clientes.telefono,
          limiteCredito: clientes.limiteCredito,
          diasCredito: clientes.diasCredito,
          esConsumidorFinal: clientes.esConsumidorFinal,
        })
        .from(clientes)
        .where(where)
        .orderBy(asc(clientes.nombre), asc(clientes.id))
        .limit(LIST_PAGE_SIZE)
        .offset((pagina - 1) * LIST_PAGE_SIZE);
      return { filas, total, pagina };
    }),
  ]);
  const { filas, total, pagina } = result;
  filters.pagina = pagina;

  const columnas: Columna<Fila>[] = [
    {
      key: "nombre",
      header: "Cliente",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.nombre}</div>
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
      header: "Límite crédito",
      align: "right",
      cell: (r) =>
        desdeDecimal(r.limiteCredito) > 0
          ? `${formatearMoneda(desdeDecimal(r.limiteCredito), empresa?.pais ?? "NI")} · ${r.diasCredito}d`
          : "Solo contado",
    },
    {
      key: "tipo",
      header: "Tipo",
      cell: (r) =>
        r.esConsumidorFinal ? (
          <Badge variant="neutral">Consumidor final</Badge>
        ) : (
          <Badge variant="info">Registrado</Badge>
        ),
      width: "140px",
    },
    {
      key: "accion",
      header: "",
      align: "right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/cxc?clienteId=${r.id}`}
            className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-secondary)] text-[12px]"
          >
            Cobros
          </Link>
          <Link
            href={`/clientes/${r.id}`}
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
        title="Clientes"
        subtitle={`${total} clientes${hasListFilters(filters) ? " encontrados" : " registrados"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportarExcel recurso="clientes" />
            <Link
              href="/clientes/nuevo"
              className="arca-btn arca-btn-primary arca-btn-sm"
            >
              <Plus size={14} /> Nuevo cliente
            </Link>
          </div>
        }
      />
      <FiltrosListado kind="clientes" path="/clientes" value={filters} />
      <DataTable
        data={filas}
        columns={columnas}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={Users}
            titulo={
              hasListFilters(filters)
                ? "No hay clientes con estos filtros"
                : "Aún no hay clientes"
            }
            descripcion={
              hasListFilters(filters)
                ? "Prueba otra búsqueda o limpia los filtros."
                : "Registra a tus clientes para emitirles facturas con sus datos."
            }
            accion={
              <Link href="/clientes/nuevo">
                <Button size="sm">
                  <Plus size={14} /> Crear primer cliente
                </Button>
              </Link>
            }
          />
        }
      />
      <PaginacionListado path="/clientes" value={filters} total={total} />
    </div>
  );
}
