import Link from "next/link";
import { Truck, Plus } from "lucide-react";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { proveedores } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

type Fila = {
  id: string;
  razonSocial: string;
  identificacionFiscal: string | null;
  telefono: string | null;
  diasCredito: number;
};

export default async function ProveedoresPage() {
  const user = await requireSession();

  const filas: Fila[] = await db
    .select({
      id: proveedores.id,
      razonSocial: proveedores.razonSocial,
      identificacionFiscal: proveedores.identificacionFiscal,
      telefono: proveedores.telefono,
      diasCredito: proveedores.diasCredito,
    })
    .from(proveedores)
    .where(and(eq(proveedores.empresaId, user.empresaId), isNull(proveedores.eliminadoEn)))
    .orderBy(desc(proveedores.creadoEn))
    .limit(200);

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
        subtitle={`${filas.length} proveedores activos`}
        actions={
          <Link
            href="/compras/proveedores/nuevo"
            className="arca-btn arca-btn-primary arca-btn-sm"
          >
            <Plus size={14} /> Nuevo proveedor
          </Link>
        }
      />
      <DataTable
        data={filas}
        columns={columnas}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={Truck}
            titulo="Aún no hay proveedores"
            descripcion="Registra a tus proveedores para crear órdenes de compra."
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
    </div>
  );
}
