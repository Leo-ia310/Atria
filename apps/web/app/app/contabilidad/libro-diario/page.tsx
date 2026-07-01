"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, ArrowLeft, Filter, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { useApi, ApiAviso } from "@/lib/use-api";
import { formatearMoneda, formatearFecha } from "@/lib/utils";

type Line = {
  id: string;
  description: string | null;
  debit: string | number;
  credit: string | number;
  account: { code: string; name: string };
};

type Entry = {
  id: string;
  number: string;
  memo: string;
  entryDate: string;
  sourceType: string | null;
  status: string;
  lines: Line[];
};

const ORIGENES = ["sale", "purchase", "expense", "manual", "payment_received", "payment_made"];

type EntriesPage = { data: Entry[]; meta: { page: number; pageSize: number; total: number } };

export default function LibroDiarioPage() {
  const [busqueda, setBusqueda] = useState("");
  const [origen, setOrigen] = useState<string>("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", "25");
  if (busqueda) params.set("search", busqueda);
  if (origen) params.set("sourceType", origen);
  const path = `/accounting/entries?${params.toString()}`;
  const { data, loading, apiDisabled, error } = useApi<EntriesPage>(path, [page, busqueda, origen]);

  const filtrados = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const pageSize = data?.meta.pageSize ?? 25;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  const totalDebe = filtrados.reduce(
    (acc, e) => acc + e.lines.reduce((a, l) => a + Number(l.debit), 0),
    0,
  );
  const totalHaber = filtrados.reduce(
    (acc, e) => acc + e.lines.reduce((a, l) => a + Number(l.credit), 0),
    0,
  );
  const balanceado = Math.abs(totalDebe - totalHaber) < 0.01;

  return (
    <div>
      <Link
        href="/app/contabilidad"
        className="inline-flex items-center gap-1 text-small text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
      >
        <ArrowLeft size={14} /> Volver a contabilidad
      </Link>
      <PageHeader
        title="Libro Diario"
        subtitle={
          loading
            ? "Cargando..."
            : `${filtrados.length} de ${total} asientos · página ${page} de ${totalPaginas} · ${
                balanceado ? "balanceado" : "DESBALANCE"
              }`
        }
        actions={
          balanceado ? (
            <Badge variant="success">Σ debe = Σ haber</Badge>
          ) : (
            <Badge variant="error">Desbalance: {formatearMoneda(Math.abs(totalDebe - totalHaber))}</Badge>
          )
        }
      />

      <ApiAviso apiDisabled={apiDisabled} error={error} />

      <div className="atria-card mb-4 flex flex-wrap items-center gap-2 p-2">
        <div className="flex flex-1 items-center gap-2">
          <Search size={14} className="ml-2 text-[color:var(--color-text-muted)]" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por número, concepto o cuenta..."
            className="flex-1 border-none bg-transparent text-small focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[color:var(--color-text-muted)]" />
          <select
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            className="atria-input text-small"
          >
            <option value="">Todos los orígenes</option>
            {ORIGENES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            titulo={total ? "Sin resultados" : "Aún no hay asientos"}
            descripcion={
              total
                ? "Ajusta los filtros para ver más asientos."
                : "Cada venta, compra o gasto generará uno automáticamente."
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map((e) => {
            const sumD = e.lines.reduce((a, l) => a + Number(l.debit), 0);
            return (
              <div key={e.id} className="atria-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-small font-semibold">{e.number}</span>
                      <Badge variant="neutral">{e.sourceType ?? "manual"}</Badge>
                      {e.status === "VOIDED" && <Badge variant="error">Anulado</Badge>}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[color:var(--color-text-muted)]">
                      {formatearFecha(e.entryDate)} · {e.memo}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-label">Total</div>
                    <div className="text-base font-semibold">{formatearMoneda(sumD)}</div>
                  </div>
                </div>
                <table className="w-full text-small">
                  <thead className="border-b border-[color:var(--color-border)]">
                    <tr className="text-label">
                      <th className="px-4 py-2 text-left">Cuenta</th>
                      <th className="px-4 py-2 text-left">Detalle</th>
                      <th className="px-4 py-2 text-right">Debe</th>
                      <th className="px-4 py-2 text-right">Haber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.lines.map((l) => (
                      <tr
                        key={l.id}
                        className="border-b border-[color:var(--color-border)] last:border-b-0"
                      >
                        <td className="px-4 py-2">
                          <span className="font-mono text-[12px] text-[color:var(--color-text-muted)]">
                            {l.account.code}
                          </span>{" "}
                          <span className="font-medium">{l.account.name}</span>
                        </td>
                        <td className="px-4 py-2 text-[color:var(--color-text-muted)]">
                          {l.description ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {Number(l.debit) > 0 ? formatearMoneda(Number(l.debit)) : ""}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {Number(l.credit) > 0 ? formatearMoneda(Number(l.credit)) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-between text-small">
          <span className="text-[color:var(--color-text-muted)]">
            Página {page} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="atria-btn atria-btn-secondary atria-btn-sm disabled:opacity-30"
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
              disabled={page >= totalPaginas}
              className="atria-btn atria-btn-secondary atria-btn-sm disabled:opacity-30"
            >
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
