import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { impuestos } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { CrearImpuestoForm } from "@/components/configuracion/CrearImpuestoForm";
import { TASA_SEGURIDAD_SOCIAL } from "@/lib/rrhh";
import type { PaisCodigo } from "@/lib/paises";

type Fila = {
  id: string;
  codigo: string;
  nombre: string;
  tasa: string;
  esRetencion: boolean;
  activo: boolean;
};

export default async function ImpuestosPage() {
  const user = await requireSession();

  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const tasaInss = TASA_SEGURIDAD_SOCIAL[pais] ?? 0.07;

  const filas: Fila[] = await db
    .select({
      id: impuestos.id,
      codigo: impuestos.codigo,
      nombre: impuestos.nombre,
      tasa: impuestos.tasa,
      esRetencion: impuestos.esRetencion,
      activo: impuestos.activo,
    })
    .from(impuestos)
    .where(eq(impuestos.empresaId, user.empresaId));

  const columnas: Columna<Fila>[] = [
    {
      key: "codigo",
      header: "Código",
      cell: (r) => <span className="font-mono text-[12px]">{r.codigo}</span>,
      width: "100px",
    },
    {
      key: "nombre",
      header: "Nombre",
      cell: (r) => <span className="font-medium">{r.nombre}</span>,
    },
    {
      key: "tasa",
      header: "Tasa",
      align: "right",
      cell: (r) => `${(parseFloat(r.tasa) * 100).toFixed(2)}%`,
      width: "120px",
    },
    {
      key: "tipo",
      header: "Tipo",
      cell: (r) =>
        r.esRetencion ? <Badge variant="warning">Retención</Badge> : <Badge variant="info">Trasladado</Badge>,
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) => (r.activo ? <Badge variant="success">Activo</Badge> : <Badge variant="neutral">Inactivo</Badge>),
      width: "100px",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Impuestos"
        subtitle={`${filas.length} impuestos configurados`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportarExcel recurso="impuestos" />
            <CrearImpuestoForm tasaInssPct={tasaInss} />
          </div>
        }
      />
      <DataTable data={filas} columns={columnas} rowKey={(r) => r.id} />
    </div>
  );
}
