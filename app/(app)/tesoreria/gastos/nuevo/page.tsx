import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cuentasFinancieras,
  categoriasGasto,
  impuestos,
  empresas,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { GastoForm } from "@/components/tesoreria/GastoForm";
import { getPaisConfig } from "@/lib/paises";
import type { PaisCodigo } from "@/lib/paises";

export default async function NuevoGastoPage() {
  const user = await requireSession();

  const [empresa] = await db
    .select({ pais: empresas.pais })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const paisConfig = getPaisConfig(pais);

  const cuentas = await db
    .select({
      id: cuentasFinancieras.id,
      nombre: cuentasFinancieras.nombre,
      tipo: cuentasFinancieras.tipo,
    })
    .from(cuentasFinancieras)
    .where(eq(cuentasFinancieras.empresaId, user.empresaId))
    .orderBy(cuentasFinancieras.tipo, cuentasFinancieras.nombre);

  const categorias = await db
    .select({ id: categoriasGasto.id, nombre: categoriasGasto.nombre })
    .from(categoriasGasto)
    .where(eq(categoriasGasto.empresaId, user.empresaId))
    .orderBy(categoriasGasto.nombre);

  if (cuentas.length === 0) redirect("/tesoreria/cuentas");
  if (categorias.length === 0) redirect("/tesoreria");

  const [impuesto] = await db
    .select({ tasa: impuestos.tasa })
    .from(impuestos)
    .where(eq(impuestos.empresaId, user.empresaId))
    .limit(1);

  const tasaImpuesto = impuesto ? parseFloat(impuesto.tasa) : paisConfig.tasaDefault;

  return (
    <div>
      <PageHeader
        title="Registrar gasto"
        subtitle="El asiento contable se genera automáticamente"
      />
      <GastoForm
        pais={pais}
        categorias={categorias.map((c) => ({ value: c.id, label: c.nombre }))}
        cuentas={cuentas.map((c) => ({ value: c.id, label: c.nombre }))}
        tasaImpuesto={tasaImpuesto}
      />
    </div>
  );
}
