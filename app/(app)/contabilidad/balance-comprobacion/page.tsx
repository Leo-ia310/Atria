import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { saldosPorCuenta } from "@/lib/contabilidad/queries";
import { formatearMoneda } from "@/lib/utils";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";

export default async function BalanceComprobacionPage() {
  const user = await requireSession();
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = empresa?.pais ?? "NI";
  const sucursalIds = selectedSucursalIds(scope);

  const saldos = await saldosPorCuenta(user.empresaId, undefined, sucursalIds);
  const totalDebe = saldos.reduce((a, s) => a + s.totalDebe, 0);
  const totalHaber = saldos.reduce((a, s) => a + s.totalHaber, 0);
  const totalDeudor = saldos
    .filter((s) => s.naturaleza === "deudora")
    .reduce((a, s) => a + Math.max(s.saldo, 0), 0);
  const totalAcreedor = saldos
    .filter((s) => s.naturaleza === "acreedora")
    .reduce((a, s) => a + Math.max(s.saldo, 0), 0);

  const balanceado = Math.abs(totalDebe - totalHaber) < 0.01;

  return (
    <div>
      <PageHeader
        title="Balance de Comprobacion"
        subtitle={`${saldos.length} cuentas con movimiento${scope.visible ? ` - ${scope.etiqueta}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportarExcel recurso="balance-comprobacion" />
            {balanceado ? (
              <Badge variant="success">Balanceado</Badge>
            ) : (
              <Badge variant="error">Desbalance</Badge>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader title="Saldos por cuenta" />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-small">
              <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                <tr className="text-label">
                  <th className="px-4 py-2 text-left">Codigo</th>
                  <th className="px-4 py-2 text-left">Cuenta</th>
                  <th className="px-4 py-2 text-right">Debe</th>
                  <th className="px-4 py-2 text-right">Haber</th>
                  <th className="px-4 py-2 text-right">Saldo deudor</th>
                  <th className="px-4 py-2 text-right">Saldo acreedor</th>
                </tr>
              </thead>
              <tbody>
                {saldos.map((s) => {
                  const saldoDeudor = s.naturaleza === "deudora" && s.saldo > 0 ? s.saldo : 0;
                  const saldoAcreedor = s.naturaleza === "acreedora" && s.saldo > 0 ? s.saldo : 0;
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-[color:var(--color-border)] last:border-b-0"
                    >
                      <td className="px-4 py-2 font-mono text-[12px]">{s.codigo}</td>
                      <td className="px-4 py-2 font-medium">{s.nombre}</td>
                      <td className="px-4 py-2 text-right text-[color:var(--color-text-muted)]">
                        {formatearMoneda(s.totalDebe, pais)}
                      </td>
                      <td className="px-4 py-2 text-right text-[color:var(--color-text-muted)]">
                        {formatearMoneda(s.totalHaber, pais)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {saldoDeudor > 0 ? formatearMoneda(saldoDeudor, pais) : ""}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {saldoAcreedor > 0 ? formatearMoneda(saldoAcreedor, pais) : ""}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-[color:var(--color-surface-2)] font-bold">
                  <td colSpan={2} className="px-4 py-3 text-right">
                    Totales
                  </td>
                  <td className="px-4 py-3 text-right">{formatearMoneda(totalDebe, pais)}</td>
                  <td className="px-4 py-3 text-right">{formatearMoneda(totalHaber, pais)}</td>
                  <td className="px-4 py-3 text-right">{formatearMoneda(totalDeudor, pais)}</td>
                  <td className="px-4 py-3 text-right">{formatearMoneda(totalAcreedor, pais)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
