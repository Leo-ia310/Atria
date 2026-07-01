"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useApi, ApiAviso } from "@/lib/use-api";
import { formatearMoneda } from "@/lib/utils";
import {
  calcularSaldosPorCuenta,
  calcularBalanceGeneral,
  type AccountDTO,
  type EntryDTO,
} from "@/lib/accounting";

type EntriesPage = { data: EntryDTO[]; meta: { page: number; pageSize: number; total: number } };

export default function BalanceGeneralPage() {
  const accounts = useApi<AccountDTO[]>("/accounting/accounts");
  const entries = useApi<EntriesPage>("/accounting/entries?pageSize=100");

  const bg = useMemo(() => {
    if (!accounts.data || !entries.data) return null;
    const saldos = calcularSaldosPorCuenta(entries.data.data, accounts.data);
    return calcularBalanceGeneral(saldos);
  }, [accounts.data, entries.data]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/app/contabilidad"
        className="inline-flex items-center gap-1 text-small text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
      >
        <ArrowLeft size={14} /> Volver
      </Link>
      <PageHeader
        title="Balance General"
        subtitle="Posición financiera al cierre"
        actions={
          bg ? (
            bg.balanceado ? (
              <Badge variant="success">Balanceado</Badge>
            ) : (
              <Badge variant="error">
                Diferencia: {formatearMoneda(bg.totalActivos - bg.totalPasivoMasPatrimonio)}
              </Badge>
            )
          ) : null
        }
      />

      <ApiAviso
        apiDisabled={accounts.apiDisabled || entries.apiDisabled}
        error={accounts.error || entries.error}
      />

      {!bg ? (
        <Card>
          <CardBody>
            <p className="py-8 text-center text-small text-[color:var(--color-text-muted)]">
              Cargando datos contables...
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="ACTIVO" />
            <CardBody className="space-y-1 text-small">
              {bg.activos.length === 0 ? (
                <p className="italic text-[color:var(--color-text-muted)]">Sin saldos</p>
              ) : (
                bg.activos.map((c) => (
                  <Linea key={c.code} codigo={c.code} nombre={c.name} monto={c.saldo} />
                ))
              )}
              <div className="mt-3 flex justify-between border-t-2 border-[color:var(--color-primary)] pt-2 text-base font-bold">
                <span>Total Activo</span>
                <span>{formatearMoneda(bg.totalActivos)}</span>
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
                      <Linea key={c.code} codigo={c.code} nombre={c.name} monto={c.saldo} />
                    ))
                  )}
                  <div className="flex justify-between border-t border-[color:var(--color-border)] pt-1 font-semibold">
                    <span>Total Pasivo</span>
                    <span>{formatearMoneda(bg.totalPasivos)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-label mb-2">Patrimonio</h4>
                <div className="space-y-1 px-2">
                  {bg.patrimonio.map((c) => (
                    <Linea key={c.code} codigo={c.code} nombre={c.name} monto={c.saldo} />
                  ))}
                  <Linea codigo="—" nombre="Utilidad del Ejercicio" monto={bg.utilidadEjercicio} />
                  <div className="flex justify-between border-t border-[color:var(--color-border)] pt-1 font-semibold">
                    <span>Total Patrimonio</span>
                    <span>{formatearMoneda(bg.totalPatrimonio)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-between border-t-2 border-[color:var(--color-primary)] pt-2 text-base font-bold">
                <span>Total Pasivo + Patrimonio</span>
                <span>{formatearMoneda(bg.totalPasivoMasPatrimonio)}</span>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
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
