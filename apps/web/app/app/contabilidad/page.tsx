"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  TableProperties,
  FileBarChart,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useApi, ApiAviso } from "@/lib/use-api";
import { apiClient, ApiError, ApiDisabledError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { descargarCSV } from "@/lib/csv";
import { formatearMoneda, formatearFecha } from "@/lib/utils";

type Summary = {
  cashFlow: number;
  cuentasPorCobrar: number;
  cuentasPorPagar: number;
  gastosAcumulados: number;
};

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
};

type JournalLine = {
  id: string;
  description: string | null;
  debit: string | number;
  credit: string | number;
  account: { code: string; name: string };
};

type JournalEntry = {
  id: string;
  number: string;
  memo: string;
  entryDate: string;
  sourceType: string | null;
  status: string;
  lines: JournalLine[];
};

type EntriesPage = { data: JournalEntry[]; meta: { page: number; pageSize: number; total: number } };

type CuentaBalance = { code: string; name: string; balance: number };

type TrialBalance = {
  activos: CuentaBalance[];
  pasivos: CuentaBalance[];
  patrimonio: CuentaBalance[];
  ingresos: CuentaBalance[];
  gastos: CuentaBalance[];
  totalDebit: number;
  totalCredit: number;
  balanceado: boolean;
};

const FILTROS_ESTADO = ["Todos", "Contabilizados", "Borrador"] as const;

export default function ContabilidadPage() {
  const [filtroEstado, setFiltroEstado] = useState<(typeof FILTROS_ESTADO)[number]>("Todos");
  const [modalAbierto, setModalAbierto] = useState(false);

  const summary = useApi<Summary>("/accounting/summary");
  const accounts = useApi<Account[]>("/accounting/accounts");
  const entriesRes = useApi<EntriesPage>("/accounting/entries?pageSize=10");
  const trialBalance = useApi<TrialBalance>("/accounting/trial-balance");
  const entries = entriesRes.data?.data ?? [];

  const filas = entries.flatMap((e) =>
    e.lines.map((l) => ({ entry: e, line: l })),
  );
  const filasFiltradas = filas.filter(({ entry }) => {
    if (filtroEstado === "Contabilizados") return entry.status === "POSTED";
    if (filtroEstado === "Borrador") return entry.status === "DRAFT";
    return true;
  });

  function exportar() {
    const cabecera = ["Fecha", "Ref #", "Cuenta", "Descripción", "Debe", "Haber"];
    const filasCSV = filasFiltradas.map(({ entry, line }) => [
      formatearFecha(entry.entryDate),
      entry.number,
      `${line.account.code} ${line.account.name}`,
      line.description ?? entry.memo,
      Number(line.debit) || "",
      Number(line.credit) || "",
    ]);
    descargarCSV("libro-diario.csv", [cabecera, ...filasCSV]);
  }

  return (
    <div>
      <PageHeader
        title="Libro contable y finanzas"
        subtitle={`Período: ${new Date().toLocaleDateString("es", { month: "long", year: "numeric" })} · ${accounts.data?.length ?? 0} cuentas activas`}
        actions={
          <>
            <button
              type="button"
              onClick={exportar}
              disabled={filasFiltradas.length === 0}
              className="atria-btn atria-btn-secondary atria-btn-sm disabled:opacity-40"
            >
              <Download size={14} /> Exportar
            </button>
            <button
              type="button"
              onClick={() => setModalAbierto(true)}
              className="atria-btn atria-btn-primary atria-btn-sm"
            >
              <Plus size={14} /> Nuevo asiento
            </button>
          </>
        }
      />

      <ApiAviso apiDisabled={summary.apiDisabled} error={summary.error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Flujo de caja"
          value={formatearMoneda(summary.data?.cashFlow ?? 0)}
          icon={Wallet}
          hint="Cobros − gastos"
        />
        <KpiCard
          label="Cuentas por cobrar"
          value={formatearMoneda(summary.data?.cuentasPorCobrar ?? 0)}
          icon={ArrowDownCircle}
          hint="Saldos pendientes de clientes"
        />
        <KpiCard
          label="Cuentas por pagar"
          value={formatearMoneda(summary.data?.cuentasPorPagar ?? 0)}
          icon={ArrowUpCircle}
          hint="Obligaciones con proveedores"
        />
        <KpiCard
          label="Gastos acumulados"
          value={formatearMoneda(summary.data?.gastosAcumulados ?? 0)}
          icon={TableProperties}
          hint="Histórico"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Libro diario"
            subtitle="Asientos por línea contable"
            actions={
              <div className="flex items-center gap-1 rounded-md bg-[color:var(--color-surface-2)] p-1">
                {FILTROS_ESTADO.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFiltroEstado(f)}
                    className={
                      "rounded px-2.5 py-1 text-[12px] font-medium transition " +
                      (filtroEstado === f
                        ? "bg-[color:var(--color-surface)] text-[color:var(--color-text-primary)] shadow-sm"
                        : "text-[color:var(--color-text-muted)]")
                    }
                  >
                    {f}
                  </button>
                ))}
              </div>
            }
          />
          <CardBody className="p-0">
            {filasFiltradas.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <BookOpen size={28} className="mx-auto mb-2 text-[color:var(--color-text-muted)]" />
                <p className="text-small text-[color:var(--color-text-muted)]">
                  Aún no hay asientos. Cada venta/compra/gasto generará uno automáticamente.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-small">
                  <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                    <tr>
                      <th className="text-label px-4 py-2.5 text-left font-semibold">Fecha</th>
                      <th className="text-label px-4 py-2.5 text-left font-semibold">Ref #</th>
                      <th className="text-label px-4 py-2.5 text-left font-semibold">Cuenta</th>
                      <th className="text-label px-4 py-2.5 text-left font-semibold">Descripción</th>
                      <th className="text-label px-4 py-2.5 text-right font-semibold">Debe</th>
                      <th className="text-label px-4 py-2.5 text-right font-semibold">Haber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasFiltradas.map(({ entry, line }) => {
                      const debit = Number(line.debit);
                      const credit = Number(line.credit);
                      return (
                        <tr key={line.id} className="border-b border-[color:var(--color-border)] last:border-b-0">
                          <td className="px-4 py-2.5 text-[color:var(--color-text-muted)]">
                            {formatearFecha(entry.entryDate)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-[12px] font-semibold">{entry.number}</span>
                            {entry.status === "VOIDED" || entry.status === "REVERSED" ? (
                              <Badge variant="error" className="ml-1.5">Anulado</Badge>
                            ) : null}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-[11px] text-[color:var(--color-text-muted)]">
                              {line.account.code}
                            </span>{" "}
                            {line.account.name}
                          </td>
                          <td className="px-4 py-2.5 text-[color:var(--color-text-muted)]">
                            {line.description ?? entry.memo}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {debit > 0 ? formatearMoneda(debit) : ""}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {credit > 0 ? formatearMoneda(credit) : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Trial balance preview" subtitle="Cuentas con movimiento contabilizado" />
          <CardBody className="max-h-[440px] space-y-4 overflow-y-auto">
            <SeccionBalance titulo="Activos" cuentas={trialBalance.data?.activos ?? []} />
            <SeccionBalance titulo="Pasivos" cuentas={trialBalance.data?.pasivos ?? []} />
            <SeccionBalance titulo="Patrimonio" cuentas={trialBalance.data?.patrimonio ?? []} />
          </CardBody>
          {trialBalance.data && (
            <div className="flex items-center justify-between border-t border-[color:var(--color-border)] px-5 py-3">
              <span className="text-label">Diferencia</span>
              <span
                className={
                  "flex items-center gap-1.5 text-small font-semibold " +
                  (trialBalance.data.balanceado
                    ? "text-[color:var(--color-success)]"
                    : "text-[color:var(--color-error)]")
                }
              >
                {trialBalance.data.balanceado ? (
                  <>
                    <CheckCircle2 size={14} /> Libros cuadrados
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} />
                    {formatearMoneda(
                      Math.abs(trialBalance.data.totalDebit - trialBalance.data.totalCredit),
                    )}
                  </>
                )}
              </span>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Reportes financieros" subtitle="Estados al cierre del período" />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ModuloLink
              href="/app/contabilidad/libro-diario"
              icon={BookOpen}
              titulo="Libro diario"
              descripcion="Asientos cronológicos"
            />
            <ModuloLink
              href="/app/contabilidad/libro-mayor"
              icon={TableProperties}
              titulo="Libro mayor"
              descripcion="Movimientos por cuenta"
            />
            <ModuloLink
              href="/app/contabilidad/estado-resultados"
              icon={FileBarChart}
              titulo="Estado de Resultados"
              descripcion="Utilidad del período"
            />
            <ModuloLink
              href="/app/contabilidad/balance-general"
              icon={TableProperties}
              titulo="Balance General"
              descripcion="Activo · Pasivo · Patrimonio"
            />
          </div>
        </CardBody>
      </Card>

      {modalAbierto && (
        <ModalNuevoAsiento
          cuentas={accounts.data ?? []}
          onCerrar={() => setModalAbierto(false)}
          onCreado={() => {
            setModalAbierto(false);
            entriesRes.refetch();
            trialBalance.refetch();
          }}
        />
      )}
    </div>
  );
}

function SeccionBalance({ titulo, cuentas }: { titulo: string; cuentas: CuentaBalance[] }) {
  if (cuentas.length === 0) return null;
  const total = cuentas.reduce((acc, c) => acc + c.balance, 0);
  return (
    <div>
      <div className="text-label mb-1.5">{titulo}</div>
      <ul className="space-y-1">
        {cuentas.map((c) => (
          <li key={c.code} className="flex items-center justify-between text-small">
            <span className="truncate text-[color:var(--color-text-muted)]">
              <span className="font-mono text-[11px]">{c.code}</span> {c.name}
            </span>
            <span className="font-medium">{formatearMoneda(c.balance)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex items-center justify-between border-t border-[color:var(--color-border)] pt-1 text-small font-semibold">
        <span>Subtotal</span>
        <span>{formatearMoneda(total)}</span>
      </div>
    </div>
  );
}

function ModuloLink({
  href,
  icon: Icon,
  titulo,
  descripcion,
}: {
  href: string;
  icon: import("lucide-react").LucideIcon;
  titulo: string;
  descripcion: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-md border border-[color:var(--color-border)] p-3 transition hover:border-[color:var(--color-tertiary)] hover:shadow-sm"
    >
      <div className="mb-2 inline-flex rounded-md bg-[color:var(--color-surface-2)] p-1.5 text-[color:var(--color-primary)]">
        <Icon size={14} />
      </div>
      <div className="text-small font-semibold">{titulo}</div>
      <div className="text-[11px] text-[color:var(--color-text-muted)]">{descripcion}</div>
    </Link>
  );
}

type LineaForm = { accountId: string; description: string; debit: string; credit: string };

function ModalNuevoAsiento({
  cuentas,
  onCerrar,
  onCreado,
}: {
  cuentas: Account[];
  onCerrar: () => void;
  onCreado: () => void;
}) {
  const { mostrar } = useToast();
  const [memo, setMemo] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [lineas, setLineas] = useState<LineaForm[]>([
    { accountId: "", description: "", debit: "", credit: "" },
    { accountId: "", description: "", debit: "", credit: "" },
  ]);
  const [enviando, setEnviando] = useState(false);

  const opcionesCuenta = cuentas
    .filter((c) => c.isActive)
    .map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }));

  const totalDebe = lineas.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
  const totalHaber = lineas.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);
  const balanceado = totalDebe > 0 && Math.abs(totalDebe - totalHaber) < 0.01;

  function actualizarLinea(i: number, cambios: Partial<LineaForm>) {
    setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  function agregarLinea() {
    setLineas((ls) => [...ls, { accountId: "", description: "", debit: "", credit: "" }]);
  }

  function quitarLinea(i: number) {
    setLineas((ls) => ls.filter((_, idx) => idx !== i));
  }

  async function confirmar() {
    if (!balanceado || !memo.trim()) return;
    setEnviando(true);
    try {
      await apiClient.post("/accounting/entries", {
        memo,
        entryDate,
        lines: lineas
          .filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
          .map((l) => ({
            accountId: l.accountId,
            description: l.description || undefined,
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
          })),
      });
      mostrar("success", "Asiento contable creado");
      onCreado();
    } catch (err) {
      if (err instanceof ApiDisabledError) {
        mostrar("error", "API deshabilitada");
      } else if (err instanceof ApiError) {
        mostrar("error", err.message);
      } else {
        mostrar("error", "No pudimos crear el asiento");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={enviando ? () => {} : onCerrar}
      titulo="Nuevo asiento contable"
      descripcion="La partida debe cuadrar: Σ debe = Σ haber"
      ancho="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} loading={enviando} disabled={!balanceado || !memo.trim()}>
            Registrar asiento
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Fecha" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          <Input label="Memo / concepto" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Ej. Pago de renta de oficina" />
        </div>

        <div className="space-y-2">
          {lineas.map((l, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2">
              <div className="col-span-4">
                <Select
                  label={i === 0 ? "Cuenta" : undefined}
                  value={l.accountId}
                  onChange={(e) => actualizarLinea(i, { accountId: e.target.value })}
                  placeholder="Selecciona cuenta"
                  options={opcionesCuenta}
                />
              </div>
              <div className="col-span-3">
                <Input
                  label={i === 0 ? "Descripción" : undefined}
                  value={l.description}
                  onChange={(e) => actualizarLinea(i, { description: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="col-span-2">
                <Input
                  label={i === 0 ? "Debe" : undefined}
                  type="number"
                  step="0.01"
                  value={l.debit}
                  onChange={(e) => actualizarLinea(i, { debit: e.target.value, credit: "" })}
                />
              </div>
              <div className="col-span-2">
                <Input
                  label={i === 0 ? "Haber" : undefined}
                  type="number"
                  step="0.01"
                  value={l.credit}
                  onChange={(e) => actualizarLinea(i, { credit: e.target.value, debit: "" })}
                />
              </div>
              <div className="col-span-1">
                <button
                  type="button"
                  onClick={() => quitarLinea(i)}
                  disabled={lineas.length <= 2}
                  className="rounded p-2 text-[color:var(--color-error)] hover:bg-[color:var(--color-error-bg)] disabled:opacity-30"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={agregarLinea}
          className="atria-btn atria-btn-ghost atria-btn-sm"
        >
          <Plus size={14} /> Agregar línea
        </button>

        <div className="flex items-center justify-between rounded-md bg-[color:var(--color-surface-2)] px-4 py-3 text-small">
          <span>
            Debe: <strong>{formatearMoneda(totalDebe)}</strong> · Haber: <strong>{formatearMoneda(totalHaber)}</strong>
          </span>
          <span
            className={
              balanceado
                ? "flex items-center gap-1 font-semibold text-[color:var(--color-success)]"
                : "flex items-center gap-1 font-semibold text-[color:var(--color-error)]"
            }
          >
            {balanceado ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {balanceado ? "Cuadrado" : "Descuadrado"}
          </span>
        </div>
      </div>
    </Modal>
  );
}
