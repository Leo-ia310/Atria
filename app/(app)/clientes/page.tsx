import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { and, desc, eq, isNull } from "drizzle-orm";
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

export default async function ClientesPage() {
  const user = await requireSession();

  const [empresa, filas] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    dbConEmpresa(user.empresaId, (tx) =>
      tx
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
        .where(and(eq(clientes.empresaId, user.empresaId), isNull(clientes.eliminadoEn)))
        .orderBy(desc(clientes.creadoEn))
        .limit(200),
    ),
  ]);

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
        subtitle={`${filas.length} clientes registrados`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportarExcel recurso="clientes" />
            <Link href="/clientes/nuevo" className="arca-btn arca-btn-primary arca-btn-sm">
              <Plus size={14} /> Nuevo cliente
            </Link>
          </div>
        }
      />
      <DataTable
        data={filas}
        columns={columnas}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={Users}
            titulo="Aún no hay clientes"
            descripcion="Registra a tus clientes para emitirles facturas con sus datos."
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
    </div>
  );
}
