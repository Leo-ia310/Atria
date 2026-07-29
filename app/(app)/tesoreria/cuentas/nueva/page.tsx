import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { catalogoCuentas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { CuentaFinancieraForm } from "@/components/tesoreria/CuentaFinancieraForm";
import type { PaisCodigo } from "@/lib/paises";
import { getPaisConfig } from "@/lib/paises";

export default async function NuevaCuentaFinancieraPage() {
  const user = await requireSession();

  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const moneda = empresa?.moneda ?? getPaisConfig(pais).moneda;

  // Only activo accounts of activo type (caja, banco - balance sheet accounts)
  const cuentasContables = await db
    .select({ id: catalogoCuentas.id, codigo: catalogoCuentas.codigo, nombre: catalogoCuentas.nombre })
    .from(catalogoCuentas)
    .where(
      and(
        eq(catalogoCuentas.empresaId, user.empresaId),
        eq(catalogoCuentas.tipo, "activo"),
        eq(catalogoCuentas.esDetalle, true),
        eq(catalogoCuentas.activa, true),
      ),
    )
    .orderBy(catalogoCuentas.codigo);

  return (
    <div>
      <PageHeader
        title="Nueva cuenta financiera"
        subtitle="Caja, banco, tarjeta o wallet electrónico"
      />
      <CuentaFinancieraForm
        moneda={moneda}
        cuentasContables={cuentasContables.map((c) => ({
          value: c.id,
          label: `${c.codigo} — ${c.nombre}`,
        }))}
      />
    </div>
  );
}
