import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { catalogoCuentas, empresas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { CuentaFinancieraForm } from "@/components/tesoreria/CuentaFinancieraForm";
import type { PaisCodigo } from "@/lib/paises";
import { getPaisConfig } from "@/lib/paises";

export default async function NuevaCuentaFinancieraPage() {
  const user = await requireSession();

  const [empresa] = await db
    .select({ pais: empresas.pais, moneda: empresas.moneda })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);
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
