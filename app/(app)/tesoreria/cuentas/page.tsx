import Link from "next/link";
import { Plus, Landmark, Wallet, CreditCard } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuentasFinancieras, empresas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

const ICONO = {
  caja: Wallet,
  banco: Landmark,
  tarjeta: CreditCard,
  wallet: Wallet,
};

const TIPO_LABEL: Record<string, string> = {
  caja: "Caja",
  banco: "Banco",
  tarjeta: "Tarjeta",
  wallet: "Wallet digital",
};

export default async function CuentasFinancierasPage() {
  const user = await requireSession();

  const [empresa] = await db
    .select({ pais: empresas.pais })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const cuentas = await db
    .select({
      id: cuentasFinancieras.id,
      nombre: cuentasFinancieras.nombre,
      tipo: cuentasFinancieras.tipo,
      banco: cuentasFinancieras.banco,
      numeroCuenta: cuentasFinancieras.numeroCuenta,
      moneda: cuentasFinancieras.moneda,
      saldoActual: cuentasFinancieras.saldoActual,
      activa: cuentasFinancieras.activa,
    })
    .from(cuentasFinancieras)
    .where(eq(cuentasFinancieras.empresaId, user.empresaId))
    .orderBy(cuentasFinancieras.tipo, cuentasFinancieras.nombre);

  const totalSaldo = cuentas
    .filter((c) => c.activa)
    .reduce((a, c) => a + parseFloat(c.saldoActual), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cuentas financieras"
        subtitle={`${cuentas.length} cuentas · Total disponible: ${formatearMoneda(totalSaldo, pais)}`}
        actions={
          <Link
            href="/tesoreria/cuentas/nueva"
            className="atria-btn atria-btn-primary atria-btn-sm"
          >
            <Plus size={14} /> Nueva cuenta
          </Link>
        }
      />

      {cuentas.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={Landmark}
              titulo="Sin cuentas financieras"
              descripcion="Las cuentas de caja y banco indican de dónde salen los pagos."
              accion={
                <Link
                  href="/tesoreria/cuentas/nueva"
                  className="atria-btn atria-btn-primary atria-btn-sm"
                >
                  <Plus size={14} /> Crear primera cuenta
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cuentas.map((c) => {
            const Icon = ICONO[c.tipo] ?? Landmark;
            return (
              <Card key={c.id} className={!c.activa ? "opacity-60" : ""}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-md bg-[color:var(--color-surface-2)] p-2 text-[color:var(--color-secondary)]">
                      <Icon size={18} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="neutral">{TIPO_LABEL[c.tipo] ?? c.tipo}</Badge>
                      {!c.activa && <Badge variant="error">Inactiva</Badge>}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-base font-semibold text-[color:var(--color-text-primary)]">
                      {c.nombre}
                    </div>
                    {c.banco && (
                      <div className="text-small text-[color:var(--color-text-muted)]">
                        {c.banco}
                        {c.numeroCuenta && ` · ****${c.numeroCuenta.slice(-4)}`}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 border-t border-[color:var(--color-border)] pt-3">
                    <div className="text-label mb-1">Saldo actual</div>
                    <div className="text-xl font-bold text-[color:var(--color-text-primary)]">
                      {formatearMoneda(parseFloat(c.saldoActual), pais)}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
