import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { saldosPorCuenta, calcularEstadoResultados } from "@/lib/contabilidad/queries";
import { formatearMoneda } from "@/lib/utils";

export default async function EstadoResultadosPage() {
  const user = await requireSession();
  const [empresa] = await db
    .select({ pais: empresas.pais, razonSocial: empresas.razonSocial })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);
  const pais = empresa?.pais ?? "NI";

  const saldos = await saldosPorCuenta(user.empresaId);
  const er = calcularEstadoResultados(saldos);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Estado de Resultados"
        subtitle={empresa?.razonSocial ?? ""}
      />

      <Card>
        <CardBody>
          <div className="space-y-6">
            <Seccion titulo="Ingresos">
              {er.ingresos.length === 0 && <SinDatos />}
              {er.ingresos.map((c) => (
                <Linea key={c.id} codigo={c.codigo} nombre={c.nombre} monto={c.saldo} pais={pais} />
              ))}
              <TotalLinea
                texto="Total ingresos"
                monto={er.totalIngresos}
                pais={pais}
                bold
              />
            </Seccion>

            <Seccion titulo="Costo de ventas">
              {er.costos.length === 0 && <SinDatos />}
              {er.costos.map((c) => (
                <Linea
                  key={c.id}
                  codigo={c.codigo}
                  nombre={c.nombre}
                  monto={-c.saldo}
                  pais={pais}
                />
              ))}
              <TotalLinea
                texto="Total costos"
                monto={-er.totalCostos}
                pais={pais}
                bold
              />
            </Seccion>

            <TotalLinea
              texto="UTILIDAD BRUTA"
              monto={er.utilidadBruta}
              pais={pais}
              bold
              highlight
            />

            <Seccion titulo="Gastos operativos">
              {er.gastos.length === 0 && <SinDatos />}
              {er.gastos.map((c) => (
                <Linea
                  key={c.id}
                  codigo={c.codigo}
                  nombre={c.nombre}
                  monto={-c.saldo}
                  pais={pais}
                />
              ))}
              <TotalLinea
                texto="Total gastos"
                monto={-er.totalGastos}
                pais={pais}
                bold
              />
            </Seccion>

            <div className="rounded-md border-2 border-[color:var(--color-primary)] bg-[color:var(--color-surface-2)] p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-base font-bold text-[color:var(--color-primary)]">
                  UTILIDAD NETA
                </span>
                <span
                  className={`text-xl font-bold ${
                    er.utilidadNeta >= 0
                      ? "text-[color:var(--color-success)]"
                      : "text-[color:var(--color-error)]"
                  }`}
                >
                  {formatearMoneda(er.utilidadNeta, pais)}
                </span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-label mb-2 border-b border-[color:var(--color-border)] pb-1">
        {titulo}
      </h3>
      <div className="space-y-1.5 px-2 text-small">{children}</div>
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

function TotalLinea({
  texto,
  monto,
  pais,
  bold,
  highlight,
}: {
  texto: string;
  monto: number;
  pais: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex justify-between border-t border-[color:var(--color-border)] pt-2 ${
        highlight ? "text-base text-[color:var(--color-primary)]" : ""
      } ${bold ? "font-bold" : ""}`}
    >
      <span>{texto}</span>
      <span>{formatearMoneda(monto, pais as never)}</span>
    </div>
  );
}

function SinDatos() {
  return (
    <p className="italic text-[color:var(--color-text-muted)]">Sin movimientos</p>
  );
}
