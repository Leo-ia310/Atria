import { getCuentasConSaldoContable } from "@/lib/tesoreria/saldos";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CrearCuentaForm } from "@/components/configuracion/CrearCuentaForm";
import { Wallet } from "lucide-react";


const TIPO_LABEL: Record<string, string> = {
  caja: "Caja",
  banco: "Banco",
  tarjeta: "Tarjeta",
  wallet: "Wallet",
};

export default async function CuentasFinancierasPage() {
  const user = await requireSession();

  const empresa = await getEmpresaMetadata(user.empresaId);


  const filas=(await getCuentasConSaldoContable(user.empresaId)).map((row)=>({...row,numeroCuenta:row.numero_cuenta}));
  const money=(amount:string,currency:string)=>new Intl.NumberFormat("es",{style:"currency",currency}).format(Number(amount));
  const messages:Record<string,string>={sin_vincular:"Sin cuenta contable vinculada",cuenta_compartida:"Cuenta contable compartida: no se distribuye el saldo",requiere_conversion:"Requiere conversión de moneda"};

  return (
    <div>
      <PageHeader
        title="Cuentas financieras"
        subtitle={`${filas.length} cuentas · caja, bancos y tarjetas`}
        actions={<CrearCuentaForm monedaDefault={empresa?.moneda ?? "NIO"} />}
      />

      <p className="mb-4 text-small text-[color:var(--color-text-muted)]">El saldo contable usa los asientos registrados. La apertura se muestra por separado; la conciliación bancaria se revisa con los comprobantes del banco.</p>
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
                  {c.saldo_contable===null ? "—" : money(c.saldo_contable,c.moneda)}
                </div>
                <div className="text-[11px] text-[color:var(--color-text-muted)]">
                  Saldo contable · {c.moneda}
                </div>
                {c.saldo_contable===null && <p className="mt-1 text-small text-[color:var(--color-warning)]">{messages[c.estado_saldo]}</p>}
                <p className="mt-2 text-small text-[color:var(--color-text-muted)]">Apertura registrada: {money(c.saldo_actual,c.moneda)}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
