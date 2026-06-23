import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { formasPago, cuentasFinancieras } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";

type Fila = {
  id: string;
  codigo: string;
  nombre: string;
  cuentaFinanciera: string | null;
  requiereReferencia: boolean;
  activa: boolean;
};

export default async function FormasPagoPage() {
  const user = await requireSession();

  const filas: Fila[] = await db
    .select({
      id: formasPago.id,
      codigo: formasPago.codigo,
      nombre: formasPago.nombre,
      cuentaFinanciera: cuentasFinancieras.nombre,
      requiereReferencia: formasPago.requiereReferencia,
      activa: formasPago.activa,
    })
    .from(formasPago)
    .leftJoin(cuentasFinancieras, eq(cuentasFinancieras.id, formasPago.cuentaFinancieraId))
    .where(eq(formasPago.empresaId, user.empresaId));

  const columnas: Columna<Fila>[] = [
    {
      key: "codigo",
      header: "Código",
      cell: (r) => <span className="font-mono text-[12px]">{r.codigo}</span>,
      width: "100px",
    },
    { key: "nombre", header: "Nombre", cell: (r) => <span className="font-medium">{r.nombre}</span> },
    {
      key: "cuenta",
      header: "Cuenta financiera",
      cell: (r) => r.cuentaFinanciera ?? <span className="italic text-[color:var(--color-text-muted)]">— Sin asignar</span>,
    },
    {
      key: "referencia",
      header: "Referencia",
      cell: (r) =>
        r.requiereReferencia ? <Badge variant="warning">Requerida</Badge> : <Badge variant="neutral">No</Badge>,
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) =>
        r.activa ? <Badge variant="success">Activa</Badge> : <Badge variant="neutral">Inactiva</Badge>,
      width: "100px",
    },
  ];

  return (
    <div>
      <PageHeader title="Formas de pago" subtitle={`${filas.length} formas disponibles en el POS`} />
      <DataTable data={filas} columns={columnas} rowKey={(r) => r.id} />
    </div>
  );
}
