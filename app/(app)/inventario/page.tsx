import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { productos, empresas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatearMoneda, desdeDecimal } from "@/lib/utils";

type Fila = {
  id: string;
  sku: string;
  nombre: string;
  precio: string;
  costo: string;
  stockMinimo: string;
  activo: boolean;
};

export default async function InventarioPage() {
  const user = await requireSession();
  const [empresa] = await db
    .select({ pais: empresas.pais })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);

  const filas: Fila[] = await db
    .select({
      id: productos.id,
      sku: productos.sku,
      nombre: productos.nombre,
      precio: productos.precioBase,
      costo: productos.costoPromedio,
      stockMinimo: productos.stockMinimo,
      activo: productos.activo,
    })
    .from(productos)
    .where(and(eq(productos.empresaId, user.empresaId), isNull(productos.eliminadoEn)))
    .orderBy(desc(productos.creadoEn))
    .limit(200);

  const columnas: Columna<Fila>[] = [
    { key: "sku", header: "SKU", cell: (r) => <span className="font-mono text-[12px]">{r.sku}</span>, width: "120px" },
    {
      key: "nombre",
      header: "Producto",
      cell: (r) => <span className="font-medium">{r.nombre}</span>,
    },
    {
      key: "precio",
      header: "Precio",
      align: "right",
      cell: (r) => formatearMoneda(desdeDecimal(r.precio), empresa?.pais ?? "NI"),
    },
    {
      key: "costo",
      header: "Costo prom.",
      align: "right",
      cell: (r) => (
        <span className="text-[color:var(--color-text-muted)]">
          {formatearMoneda(desdeDecimal(r.costo), empresa?.pais ?? "NI")}
        </span>
      ),
    },
    {
      key: "stockMinimo",
      header: "Stock mín.",
      align: "right",
      cell: (r) => desdeDecimal(r.stockMinimo).toFixed(0),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) =>
        r.activo ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="neutral">Inactivo</Badge>
        ),
      width: "100px",
    },
    {
      key: "accion",
      header: "",
      cell: (r) => (
        <Link
          href={`/inventario/${r.id}`}
          className="text-[color:var(--color-secondary)] hover:underline"
        >
          Editar →
        </Link>
      ),
      align: "right",
      width: "100px",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Inventario"
        subtitle={`${filas.length} productos en el catálogo`}
        actions={
          <Link href="/inventario/nuevo" className="atria-btn atria-btn-primary atria-btn-sm">
            <Plus size={14} /> Nuevo producto
          </Link>
        }
      />

      <DataTable<Fila>
        data={filas}
        columns={columnas}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={Package}
            titulo="Aún no hay productos"
            descripcion="Crea tu primer producto para empezar a vender."
            accion={
              <Link href="/inventario/nuevo">
                <Button size="sm">
                  <Plus size={14} /> Crear primer producto
                </Button>
              </Link>
            }
          />
        }
      />
    </div>
  );
}
