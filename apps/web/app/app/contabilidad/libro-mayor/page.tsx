"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, BookText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useApi, ApiAviso } from "@/lib/use-api";
import { formatearMoneda, formatearFecha } from "@/lib/utils";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type Line = {
  id: string;
  description: string | null;
  debit: string | number;
  credit: string | number;
  account: { id?: string; code: string; name: string };
};

type Entry = {
  id: string;
  number: string;
  memo: string;
  entryDate: string;
  lines: Line[];
};

const NATURALEZA_POR_TIPO: Record<string, "debit" | "credit"> = {
  ASSET: "debit",
  EXPENSE: "debit",
  LIABILITY: "credit",
  EQUITY: "credit",
  INCOME: "credit",
  REVENUE: "credit",
};

type EntriesPage = { data: Entry[]; meta: { page: number; pageSize: number; total: number } };

export default function LibroMayorPage() {
  const accounts = useApi<Account[]>("/accounting/accounts");
  const entriesRes = useApi<EntriesPage>("/accounting/entries?pageSize=100");
  const entries = { ...entriesRes, data: entriesRes.data?.data ?? null };
  const [seleccionada, setSeleccionada] = useState<string>("");

  const cuentaActual = useMemo(
    () => (accounts.data ?? []).find((a) => a.code === seleccionada) ?? accounts.data?.[0],
    [accounts.data, seleccionada],
  );

  const movimientos = useMemo(() => {
    if (!cuentaActual || !entries.data) return [];
    const filas: {
      fecha: string;
      numero: string;
      concepto: string;
      descripcion: string | null;
      debe: number;
      haber: number;
    }[] = [];
    for (const e of entries.data) {
      for (const l of e.lines) {
        if (l.account.code === cuentaActual.code) {
          filas.push({
            fecha: e.entryDate,
            numero: e.number,
            concepto: e.memo,
            descripcion: l.description,
            debe: Number(l.debit),
            haber: Number(l.credit),
          });
        }
      }
    }
    return filas.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [cuentaActual, entries.data]);

  const naturaleza = cuentaActual ? NATURALEZA_POR_TIPO[cuentaActual.type] ?? "debit" : "debit";
  let saldo = 0;
  const filasConSaldo = movimientos.map((m) => {
    saldo += naturaleza === "debit" ? m.debe - m.haber : m.haber - m.debe;
    return { ...m, saldo };
  });

  const totalDebe = movimientos.reduce((a, m) => a + m.debe, 0);
  const totalHaber = movimientos.reduce((a, m) => a + m.haber, 0);

  return (
    <div>
      <Link
        href="/app/contabilidad"
        className="inline-flex items-center gap-1 text-small text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
      >
        <ArrowLeft size={14} /> Volver
      </Link>
      <PageHeader
        title="Libro Mayor"
        subtitle="Movimientos por cuenta con saldo corrido"
      />

      <ApiAviso
        apiDisabled={accounts.apiDisabled || entries.apiDisabled}
        error={accounts.error || entries.error}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader title="Cuentas" />
          <CardBody className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              {(accounts.data ?? []).map((c) => {
                const activa = cuentaActual?.code === c.code;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSeleccionada(c.code)}
                    className={`block w-full border-b border-[color:var(--color-border)] px-4 py-2 text-left text-small last:border-b-0 transition ${
                      activa
                        ? "bg-[color:var(--color-surface-2)] font-medium"
                        : "hover:bg-[color:var(--color-surface-2)]"
                    }`}
                  >
                    <span className="font-mono text-[11px] text-[color:var(--color-text-muted)]">
                      {c.code}
                    </span>
                    <div className="truncate">{c.name}</div>
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title={
              cuentaActual
                ? `${cuentaActual.code} · ${cuentaActual.name}`
                : "Selecciona una cuenta"
            }
            subtitle={cuentaActual ? `Naturaleza ${naturaleza === "debit" ? "deudora" : "acreedora"} · tipo ${cuentaActual.type}` : undefined}
          />
          <CardBody className="p-0">
            {filasConSaldo.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={BookText}
                  titulo="Sin movimientos en esta cuenta"
                  descripcion="Cuando una operación afecte esta cuenta, aparecerán los movimientos aquí."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-small">
                  <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                    <tr className="text-label">
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">N° Asiento</th>
                      <th className="px-3 py-2 text-left">Detalle</th>
                      <th className="px-3 py-2 text-right">Debe</th>
                      <th className="px-3 py-2 text-right">Haber</th>
                      <th className="px-3 py-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasConSaldo.map((f, i) => (
                      <tr
                        key={i}
                        className="border-b border-[color:var(--color-border)] last:border-b-0"
                      >
                        <td className="px-3 py-2">{formatearFecha(f.fecha)}</td>
                        <td className="px-3 py-2 font-mono text-[12px]">{f.numero}</td>
                        <td className="px-3 py-2 text-[color:var(--color-text-muted)]">
                          {f.descripcion ?? f.concepto}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {f.debe > 0 ? formatearMoneda(f.debe) : ""}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {f.haber > 0 ? formatearMoneda(f.haber) : ""}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {formatearMoneda(f.saldo)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[color:var(--color-surface-2)] font-semibold">
                      <td colSpan={3} className="px-3 py-2 text-right">
                        Totales
                      </td>
                      <td className="px-3 py-2 text-right">{formatearMoneda(totalDebe)}</td>
                      <td className="px-3 py-2 text-right">{formatearMoneda(totalHaber)}</td>
                      <td className="px-3 py-2 text-right">{formatearMoneda(saldo)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
