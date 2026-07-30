import Link from "next/link";
import { Receipt, ShoppingCart } from "lucide-react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes, sucursales, ventas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatearMoneda, formatearFechaHora } from "@/lib/utils";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { getEmpresaMetadata } from "@/lib/tenant-data";

type Fila = {
  id: string;
  numero: string;
  fecha: Date;
  cliente: string | null;
  sucursal: string | null;
  total: string;
  esCredito: boolean;
  estado: string;
};

export default async function VentasPage() {
  const user = await requireSession();
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const sucursalIds = selectedSucursalIds(scope);

  const filas: Fila[] = await db
    .select({
      id: ventas.id,
      numero: ventas.numero,
      fecha: ventas.fecha,
      cliente: clientes.nombre,
      sucursal: sucursales.nombre,
      total: ventas.total,
      esCredito: ventas.esCredito,
      estado: ventas.estado,
    })
    .from(ventas)
    .leftJoin(clientes, eq(clientes.id, ventas.clienteId))
    .leftJoin(sucursales, eq(sucursales.id, ventas.sucursalId))
    .where(
      and(
        eq(ventas.empresaId, user.empresaId),
        sucursalIds ? inArray(ventas.sucursalId, sucursalIds) : undefined,
      ),
    )
    .orderBy(desc(ventas.fecha))
    .limit(200);

  const columnas: Columna<Fila>[] = [
    {
      key: "numero",
      header: "N° Venta",
      cell: (r) => <span className="font-mono text-[12px]">{r.numero}</span>,
      width: "140px",
    },
    {
      key: "fecha",
      header: "Fecha y hora",
      cell: (r) => formatearFechaHora(r.fecha),
      width: "180px",
    },
    {
      key: "cliente",
      header: "Cliente",
      cell: (r) =>
        r.cliente ?? (
          <span className="italic text-[color:var(--color-text-muted)]">Consumidor final</span>
        ),
    },
    ...(scope.visible
      ? [
          {
            key: "sucursal",
            header: "Sucursal",
            cell: (r: Fila) => r.sucursal ?? "Sin sucursal",
            width: "150px",
          } satisfies Columna<Fila>,
        ]
      : []),
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (r) => (
        <span className="font-semibold">
          {formatearMoneda(parseFloat(r.total), empresa?.pais ?? "NI")}
        </span>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      cell: (r) =>
        r.esCredito ? (
          <Badge variant="warning">Crédito</Badge>
        ) : (
          <Badge variant="neutral">Contado</Badge>
        ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) =>
        r.estado === "anulada" ? (
          <Badge variant="error">Anulada</Badge>
        ) : (
          <Badge variant="success">Completada</Badge>
        ),
    },
    {
      key: "accion",
      header: "",
      align: "right",
      cell: (r) => (
        <Link
          href={`/ventas/${r.id}`}
          className="text-[color:var(--color-secondary)] hover:underline"
        >
          Ver →
        </Link>
      ),
      width: "80px",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle={`${filas.length} ventas registradas${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
        actions={
          <Link href="/pos" className="arca-btn arca-btn-primary arca-btn-sm">
            <ShoppingCart size={14} /> Abrir POS
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
            titulo="Aún no hay ventas"
            descripcion="Abre el POS y haz tu primera venta para empezar a registrar."
            accion={
              <Link href="/pos">
                <Button size="sm">
                  <ShoppingCart size={14} /> Ir al POS
                </Button>
              </Link>
            }
          />
        }
      />
    </div>
  );
}
