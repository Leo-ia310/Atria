"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Receipt, User, MapPin } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useApi, ApiAviso } from "@/lib/use-api";
import { formatearMoneda, formatearFechaHora } from "@/lib/utils";

type Sale = {
  id: string;
  number: string;
  soldAt: string;
  status: string;
  type: string;
  subtotal: string | number;
  taxTotal: string | number;
  discountTotal: string | number;
  grandTotal: string | number;
  paidTotal: string | number;
  note: string | null;
  customer: { fullName: string; documentId: string | null; email: string | null } | null;
  branch: { name: string };
  warehouse: { name: string };
  items: {
    id: string;
    quantity: string | number;
    unitPrice: string | number;
    discountAmount: string | number;
    taxAmount: string | number;
    lineTotal: string | number;
    product: { sku: string; name: string };
  }[];
  payments: {
    id: string;
    method: string;
    amount: string | number;
    reference: string | null;
  }[];
  receivables: { id: string; status: string; outstandingAmount: string | number }[];
  createdByMembership: { user: { firstName: string; lastName: string } } | null;
};

type Journal = {
  id: string;
  number: string;
  memo: string;
  entryDate: string;
  lines: {
    id: string;
    debit: string | number;
    credit: string | number;
    description: string | null;
    account: { code: string; name: string };
  }[];
};

type Response = {
  sale: Sale;
  journal: Journal | null;
};

export default function DetalleVentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, loading, apiDisabled, error } = useApi<Response>(`/sales/${id}`);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="py-8 text-center text-small text-[color:var(--color-text-muted)]">
          Cargando venta...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl">
        <Link
          href="/app/ventas"
          className="inline-flex items-center gap-1 text-small text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
        >
          <ArrowLeft size={14} /> Volver al historial
        </Link>
        <ApiAviso apiDisabled={apiDisabled} error={error ?? "Venta no encontrada"} />
      </div>
    );
  }

  const { sale, journal } = data;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/app/ventas"
        className="inline-flex items-center gap-1 text-small text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
      >
        <ArrowLeft size={14} /> Volver al historial
      </Link>
      <PageHeader
        title={`Venta ${sale.number}`}
        subtitle={formatearFechaHora(sale.soldAt)}
        actions={
          sale.status === "COMPLETED" ? (
            <Badge variant="success">Completada</Badge>
          ) : sale.status === "VOID" ? (
            <Badge variant="error">Anulada</Badge>
          ) : (
            <Badge variant="warning">{sale.status}</Badge>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Productos vendidos" />
          <CardBody className="p-0">
            <table className="w-full text-small">
              <thead className="border-b border-[color:var(--color-border)]">
                <tr className="text-label">
                  <th className="px-4 py-2 text-left">Producto</th>
                  <th className="px-4 py-2 text-right">Cant.</th>
                  <th className="px-4 py-2 text-right">Precio</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((it) => (
                  <tr key={it.id} className="border-b border-[color:var(--color-border)] last:border-b-0">
                    <td className="px-4 py-2">
                      <div className="font-medium">{it.product.name}</div>
                      <div className="text-[11px] text-[color:var(--color-text-muted)]">
                        {it.product.sku}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">{Number(it.quantity).toFixed(0)}</td>
                    <td className="px-4 py-2 text-right">
                      {formatearMoneda(Number(it.unitPrice))}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatearMoneda(Number(it.lineTotal))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Totales" />
          <CardBody className="space-y-2 text-small">
            <Fila
              label="Cliente"
              valor={
                sale.customer ? (
                  <span className="flex items-center gap-1">
                    <User size={11} /> {sale.customer.fullName}
                  </span>
                ) : (
                  "Consumidor final"
                )
              }
            />
            <Fila
              label="Sucursal"
              valor={
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {sale.branch.name}
                </span>
              }
            />
            <Fila
              label="Cajero"
              valor={
                sale.createdByMembership
                  ? `${sale.createdByMembership.user.firstName} ${sale.createdByMembership.user.lastName}`
                  : "—"
              }
            />
            <hr className="border-[color:var(--color-border)]" />
            <Fila label="Subtotal" valor={formatearMoneda(Number(sale.subtotal))} />
            {Number(sale.discountTotal) > 0 && (
              <Fila
                label="Descuento"
                valor={`- ${formatearMoneda(Number(sale.discountTotal))}`}
              />
            )}
            <Fila label="Impuestos" valor={formatearMoneda(Number(sale.taxTotal))} />
            <hr className="border-[color:var(--color-border)]" />
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-label">Total</span>
              <span className="text-lg font-bold text-[color:var(--color-primary)]">
                {formatearMoneda(Number(sale.grandTotal))}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="text-[color:var(--color-text-muted)]">Pagado</span>
              <span className="font-medium">
                {formatearMoneda(Number(sale.paidTotal))}
              </span>
            </div>
            {sale.receivables.length > 0 && (
              <div className="mt-2 rounded-md bg-[color:var(--color-warning-bg)] p-2 text-[12px]">
                Saldo por cobrar:{" "}
                <strong>
                  {formatearMoneda(
                    sale.receivables.reduce((a, r) => a + Number(r.outstandingAmount), 0),
                  )}
                </strong>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Pagos recibidos" />
          <CardBody className="p-0">
            {sale.payments.length === 0 ? (
              <p className="p-4 text-small text-[color:var(--color-text-muted)]">
                Sin pagos registrados
              </p>
            ) : (
              <table className="w-full text-small">
                <tbody>
                  {sale.payments.map((p) => (
                    <tr key={p.id} className="border-b border-[color:var(--color-border)] last:border-b-0">
                      <td className="px-4 py-2">
                        <Badge variant="info">{p.method}</Badge>
                      </td>
                      <td className="px-4 py-2 text-[color:var(--color-text-muted)]">
                        {p.reference ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {formatearMoneda(Number(p.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Trazabilidad" />
          <CardBody className="space-y-3 text-small">
            <div className="flex items-center gap-2 text-[color:var(--color-text-muted)]">
              <Receipt size={14} />
              <span>Documento: {sale.number}</span>
            </div>
            {journal ? (
              <Link
                href="/app/contabilidad/libro-diario"
                className="flex items-center gap-2 text-[color:var(--color-secondary)] hover:underline"
              >
                <BookOpen size={14} />
                Asiento {journal.number} ({journal.lines.length} líneas)
              </Link>
            ) : (
              <span className="italic text-[color:var(--color-text-muted)]">
                Sin asiento ligado
              </span>
            )}
            {sale.note && (
              <div className="rounded-md bg-[color:var(--color-surface-2)] p-2 text-[color:var(--color-text-muted)]">
                {sale.note}
              </div>
            )}
          </CardBody>
        </Card>

        {journal && (
          <Card className="lg:col-span-3">
            <CardHeader
              title={`Asiento contable ${journal.number}`}
              subtitle={journal.memo}
            />
            <CardBody className="p-0">
              <table className="w-full text-small">
                <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                  <tr className="text-label">
                    <th className="px-4 py-2 text-left">Cuenta</th>
                    <th className="px-4 py-2 text-left">Descripción</th>
                    <th className="px-4 py-2 text-right">Debe</th>
                    <th className="px-4 py-2 text-right">Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.lines.map((l) => (
                    <tr key={l.id} className="border-b border-[color:var(--color-border)] last:border-b-0">
                      <td className="px-4 py-2">
                        <span className="font-mono text-[12px] text-[color:var(--color-text-muted)]">
                          {l.account.code}
                        </span>{" "}
                        {l.account.name}
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
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function Fila({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[color:var(--color-text-muted)]">{label}</span>
      <span className="font-medium">{valor}</span>
    </div>
  );
}
