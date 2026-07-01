"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { useApi, ApiAviso } from "@/lib/use-api";
import { formatearMoneda } from "@/lib/utils";
import {
  calcularSaldosPorCuenta,
  calcularEstadoResultados,
  type AccountDTO,
  type EntryDTO,
} from "@/lib/accounting";

type EntriesPage = { data: EntryDTO[]; meta: { page: number; pageSize: number; total: number } };

export default function EstadoResultadosPage() {
  const accounts = useApi<AccountDTO[]>("/accounting/accounts");
  const entries = useApi<EntriesPage>("/accounting/entries?pageSize=100");

  const er = useMemo(() => {
    if (!accounts.data || !entries.data) return null;
    const saldos = calcularSaldosPorCuenta(entries.data.data, accounts.data);
    return calcularEstadoResultados(saldos);
  }, [accounts.data, entries.data]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/app/contabilidad"
        className="inline-flex items-center gap-1 text-small text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
      >
        <ArrowLeft size={14} /> Volver
      </Link>
      <PageHeader
        title="Estado de Resultados"
        subtitle="Ingresos − Costos − Gastos = Utilidad neta"
      />

      <ApiAviso
        apiDisabled={accounts.apiDisabled || entries.apiDisabled}
        error={accounts.error || entries.error}
      />

      <Card>
        <CardBody>
          {!er ? (
            <p className="py-8 text-center text-small text-[color:var(--color-text-muted)]">
              Cargando datos contables...
            </p>
          ) : (
            <div className="space-y-6">
              <Seccion titulo="Ingresos">
                {er.ingresos.length === 0 && <SinDatos />}
                {er.ingresos.map((c) => (
                  <Linea key={c.code} codigo={c.code} nombre={c.name} monto={c.saldo} />
                ))}
                <TotalLinea texto="Total ingresos" monto={er.totalIngresos} bold />
              </Seccion>

              <Seccion titulo="Costo de ventas">
                {er.costos.length === 0 && <SinDatos />}
                {er.costos.map((c) => (
                  <Linea key={c.code} codigo={c.code} nombre={c.name} monto={-c.saldo} />
                ))}
                <TotalLinea texto="Total costos" monto={-er.totalCostos} bold />
              </Seccion>

              <TotalLinea texto="UTILIDAD BRUTA" monto={er.utilidadBruta} bold highlight />

              <Seccion titulo="Gastos operativos">
                {er.gastos.length === 0 && <SinDatos />}
                {er.gastos.map((c) => (
                  <Linea key={c.code} codigo={c.code} nombre={c.name} monto={-c.saldo} />
                ))}
                <TotalLinea texto="Total gastos" monto={-er.totalGastos} bold />
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
                    {formatearMoneda(er.utilidadNeta)}
                  </span>
                </div>
              </div>

              <p className="mt-6 text-[11px] text-[color:var(--color-text-muted)]">
                Calculado en cliente sobre los últimos asientos disponibles. Para reportes
                con histórico completo y filtros por período, espera la versión servidor.
              </p>
            </div>
          )}
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

function Linea({ codigo, nombre, monto }: { codigo: string; nombre: string; monto: number }) {
  return (
    <div className="flex justify-between">
      <span>
        <span className="font-mono text-[11px] text-[color:var(--color-text-muted)]">
          {codigo}
        </span>{" "}
        {nombre}
      </span>
      <span className="font-medium">{formatearMoneda(monto)}</span>
    </div>
  );
}

function TotalLinea({
  texto,
  monto,
  bold,
  highlight,
}: {
  texto: string;
  monto: number;
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
      <span>{formatearMoneda(monto)}</span>
    </div>
  );
}

function SinDatos() {
  return <p className="italic text-[color:var(--color-text-muted)]">Sin movimientos</p>;
}
