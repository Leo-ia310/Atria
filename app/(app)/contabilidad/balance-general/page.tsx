import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { saldosPorCuenta, calcularBalanceGeneral } from "@/lib/contabilidad/queries";
import { formatearMoneda } from "@/lib/utils";

export default async function BalanceGeneralPage() {
  const user = await requireSession();
  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = empresa?.pais ?? "NI";

  const saldos = await saldosPorCuenta(user.empresaId);
  const bg = calcularBalanceGeneral(saldos);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Balance General"
        subtitle={empresa?.razonSocial ?? ""}
        actions={
          bg.balanceado ? (
            <Badge variant="success">Balanceado</Badge>
          ) : (
            <Badge variant="error">Diferencia: {formatearMoneda(bg.totalActivos - bg.totalPasivoMasPatrimonio, pais)}</Badge>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="ACTIVO" />
          <CardBody className="space-y-1 text-small">
            {bg.activos.length === 0 ? (
              <p className="italic text-[color:var(--color-text-muted)]">Sin saldos</p>
            ) : (
              bg.activos.map((c) => (
                <Linea key={c.id} codigo={c.codigo} nombre={c.nombre} monto={c.saldo} pais={pais} />
              ))
            )}
            <div className="mt-3 flex justify-between border-t-2 border-[color:var(--color-primary)] pt-2 text-base font-bold">
              <span>Total Activo</span>
              <span>{formatearMoneda(bg.totalActivos, pais)}</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="PASIVO Y PATRIMONIO" />
          <CardBody className="space-y-4 text-small">
            <div>
              <h4 className="text-label mb-2">Pasivo</h4>
              <div className="space-y-1 px-2">
                {bg.pasivos.length === 0 ? (
                  <p className="italic text-[color:var(--color-text-muted)]">Sin saldos</p>
                ) : (
                  bg.pasivos.map((c) => (
                    <Linea key={c.id} codigo={c.codigo} nombre={c.nombre} monto={c.saldo} pais={pais} />
                  ))
                )}
                <div className="flex justify-between border-t border-[color:var(--color-border)] pt-1 font-semibold">
                  <span>Total Pasivo</span>
                  <span>{formatearMoneda(bg.totalPasivos, pais)}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-label mb-2">Patrimonio</h4>
              <div className="space-y-1 px-2">
                {bg.patrimonio.map((c) => (
                  <Linea key={c.id} codigo={c.codigo} nombre={c.nombre} monto={c.saldo} pais={pais} />
                ))}
                <Linea codigo="3103" nombre="Utilidad del Ejercicio" monto={bg.utilidadEjercicio} pais={pais} />
                <div className="flex justify-between border-t border-[color:var(--color-border)] pt-1 font-semibold">
                  <span>Total Patrimonio</span>
                  <span>{formatearMoneda(bg.totalPatrimonio, pais)}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-between border-t-2 border-[color:var(--color-primary)] pt-2 text-base font-bold">
              <span>Total Pasivo + Patrimonio</span>
              <span>{formatearMoneda(bg.totalPasivoMasPatrimonio, pais)}</span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Linea({
  codigo,
  nombre,
  monto,
  pais,
}: {
  codigo: string;
  nombre: string;
  monto: number;
  pais: string;
}) {
  return (
    <div className="flex justify-between">
      <span>
        <span className="font-mono text-[11px] text-[color:var(--color-text-muted)]">
          {codigo}
        </span>{" "}
        {nombre}
      </span>
      <span className="font-medium">{formatearMoneda(monto, pais as never)}</span>
    </div>
  );
}
