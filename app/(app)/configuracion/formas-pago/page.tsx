import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { formasPago, cuentasFinancieras } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormasPagoManager } from "@/components/configuracion/FormasPagoManager";

export default async function FormasPagoPage() {
  const user = await requireSession();

  const [filas, cuentas] = await Promise.all([
    db
      .select({
        id: formasPago.id,
        codigo: formasPago.codigo,
        nombre: formasPago.nombre,
        cuentaFinancieraId: formasPago.cuentaFinancieraId,
        cuentaFinanciera: cuentasFinancieras.nombre,
        requiereReferencia: formasPago.requiereReferencia,
        activa: formasPago.activa,
      })
      .from(formasPago)
      .leftJoin(
        cuentasFinancieras,
        eq(cuentasFinancieras.id, formasPago.cuentaFinancieraId),
      )
      .where(eq(formasPago.empresaId, user.empresaId)),
    db
      .select({ id: cuentasFinancieras.id, nombre: cuentasFinancieras.nombre })
      .from(cuentasFinancieras)
      .where(
        and(
          eq(cuentasFinancieras.empresaId, user.empresaId),
          eq(cuentasFinancieras.activa, true),
        ),
      ),
  ]);

  return (
    <div>
      <PageHeader
        title="Formas de pago"
        subtitle={`${filas.length} formas disponibles en el POS`}
      />
      <FormasPagoManager
        formas={filas}
        cuentas={cuentas.map((c) => ({ value: c.id, label: c.nombre }))}
      />
    </div>
  );
}
