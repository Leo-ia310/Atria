import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuentasFinancieras, empresas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CrearCuentaForm } from "@/components/configuracion/CrearCuentaForm";
import { Wallet } from "lucide-react";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

const TIPO_LABEL: Record<string, string> = {
  caja: "Caja",
  banco: "Banco",
  tarjeta: "Tarjeta",
  wallet: "Wallet",
};

export default async function CuentasFinancierasPage() {
  const user = await requireSession();

  const [empresa] = await db
    .select({ pais: empresas.pais, moneda: empresas.moneda })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const filas = await db
    .select({
      id: cuentasFinancieras.id,
      tipo: cuentasFinancieras.tipo,
      nombre: cuentasFinancieras.nombre,
      banco: cuentasFinancieras.banco,
      numeroCuenta: cuentasFinancieras.numeroCuenta,
      moneda: cuentasFinancieras.moneda,
      saldoActual: cuentasFinancieras.saldoActual,
      activa: cuentasFinancieras.activa,
    })
    .from(cuentasFinancieras)
    .where(eq(cuentasFinancieras.empresaId, user.empresaId));

  return (
    <div>
      <PageHeader
        title="Cuentas financieras"
        subtitle={`${filas.length} cuentas · caja, bancos y tarjetas`}
        actions={<CrearCuentaForm monedaDefault={empresa?.moneda ?? "NIO"} />}
      />

      {filas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            titulo="Sin cuentas financieras"
            descripcion="Crea tu caja general y cuentas de banco para registrar cobros y pagos."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filas.map((c) => (
            <Card key={c.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <Badge variant="info">{TIPO_LABEL[c.tipo] ?? c.tipo}</Badge>
                  {c.activa ? (
                    <Badge variant="success">Activa</Badge>
                  ) : (
                    <Badge variant="neutral">Inactiva</Badge>
                  )}
                </div>
                <div className="mt-2 text-base font-semibold">{c.nombre}</div>
                {(c.banco || c.numeroCuenta) && (
                  <div className="text-[12px] text-[color:var(--color-text-muted)]">
                    {c.banco}
                    {c.banco && c.numeroCuenta ? " · " : ""}
                    {c.numeroCuenta}
                  </div>
                )}
                <div className="mt-3 text-xl font-bold text-[color:var(--color-primary)]">
                  {formatearMoneda(parseFloat(c.saldoActual), pais)}
                </div>
                <div className="text-[11px] text-[color:var(--color-text-muted)]">
                  Saldo actual · {c.moneda}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
