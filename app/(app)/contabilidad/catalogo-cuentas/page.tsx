import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { catalogoCuentas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";

export default async function CatalogoCuentasPage() {
  const user = await requireSession();

  const cuentas = await db
    .select()
    .from(catalogoCuentas)
    .where(eq(catalogoCuentas.empresaId, user.empresaId))
    .orderBy(asc(catalogoCuentas.codigo));

  return (
    <div>
      <PageHeader
        title="Catálogo de Cuentas"
        subtitle={`${cuentas.length} cuentas en el plan`}
        actions={<BotonExportarExcel recurso="catalogo-cuentas" />}
      />
      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-small">
            <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
              <tr className="text-label">
                <th className="px-4 py-2 text-left">Código</th>
                <th className="px-4 py-2 text-left">Nombre</th>
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-left">Naturaleza</th>
                <th className="px-4 py-2 text-center">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[color:var(--color-border)] last:border-b-0"
                >
                  <td
                    className="px-4 py-2 font-mono text-[12px]"
                    style={{ paddingLeft: 16 + (c.nivel - 1) * 16 }}
                  >
                    {c.codigo}
                  </td>
                  <td className="px-4 py-2">
                    <span className={c.nivel === 1 ? "font-bold uppercase" : c.nivel === 2 ? "font-semibold" : ""}>
                      {c.nombre}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-[color:var(--color-text-muted)]">
                    {c.tipo}
                  </td>
                  <td className="px-4 py-2 text-[color:var(--color-text-muted)]">
                    {c.naturaleza}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {c.esDetalle ? <Badge variant="success">Sí</Badge> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
