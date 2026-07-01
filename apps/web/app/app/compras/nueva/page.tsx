"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, Trash2, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useApi, ApiAviso } from "@/lib/use-api";
import { apiClient, ApiError, ApiDisabledError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { formatearMoneda } from "@/lib/utils";

type Supplier = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  costPrice: number | string;
  taxRate: { rate: number | string } | null;
};

type ProductsPage = { data: Product[]; meta: { total: number } };

type Linea = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
};

export default function NuevaCompraPage() {
  const router = useRouter();
  const { mostrar } = useToast();
  const suppliers = useApi<Supplier[]>("/purchases/suppliers");
  const [busqueda, setBusqueda] = useState("");
  const productos = useApi<ProductsPage>(
    `/inventory/products?pageSize=8${busqueda ? `&search=${encodeURIComponent(busqueda)}` : ""}`,
    [busqueda],
  );

  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentTerms, setPaymentTerms] = useState<"CASH" | "CREDIT">("CASH");
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  );
  const [note, setNote] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [enviando, setEnviando] = useState(false);

  const sugerencias = useMemo(
    () => (busqueda ? productos.data?.data ?? [] : []),
    [busqueda, productos.data],
  );

  function agregar(p: Product) {
    setLineas((ls) => [
      ...ls,
      {
        id: crypto.randomUUID(),
        productId: p.id,
        productName: p.name,
        productSku: p.sku,
        quantity: 1,
        unitCost: Number(p.costPrice),
        taxRate: p.taxRate ? Number(p.taxRate.rate) / 100 : 0,
      },
    ]);
    setBusqueda("");
  }

  function actualizar(id: string, cambios: Partial<Linea>) {
    setLineas((ls) => ls.map((l) => (l.id === id ? { ...l, ...cambios } : l)));
  }

  function quitar(id: string) {
    setLineas((ls) => ls.filter((l) => l.id !== id));
  }

  const subtotal = lineas.reduce((acc, l) => acc + l.quantity * l.unitCost, 0);
  const impuestos = lineas.reduce((acc, l) => acc + l.quantity * l.unitCost * l.taxRate, 0);
  const total = subtotal + impuestos;

  async function registrar() {
    if (!supplierId) {
      mostrar("warning", "Selecciona un proveedor");
      return;
    }
    if (lineas.length === 0) {
      mostrar("warning", "Agrega al menos un producto");
      return;
    }
    setEnviando(true);
    try {
      await apiClient.post("/purchases", {
        supplierId,
        supplierInvoiceNumber: invoiceNumber || undefined,
        paymentTerms,
        dueDate: paymentTerms === "CREDIT" ? dueDate : undefined,
        note: note || undefined,
        items: lineas.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitCost: l.unitCost,
          taxAmount: l.quantity * l.unitCost * l.taxRate,
        })),
      });
      mostrar("success", "Compra registrada");
      router.push("/app/compras");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiDisabledError) mostrar("error", "API deshabilitada");
      else if (err instanceof ApiError) mostrar("error", err.message);
      else mostrar("error", "No pudimos registrar la compra");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/app/compras"
        className="inline-flex items-center gap-1 text-small text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
      >
        <ArrowLeft size={14} /> Volver
      </Link>
      <PageHeader
        title="Registrar compra"
        subtitle="Entrada de inventario + cuenta por pagar + asiento contable"
      />

      <ApiAviso apiDisabled={suppliers.apiDisabled} error={suppliers.error} />

      <div className="space-y-5">
        <Card>
          <CardHeader title="Datos de la compra" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Proveedor"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Selecciona..."
              />
              <Input
                label="Número de factura"
                placeholder="FAC-1234"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-end gap-4 rounded-md bg-[color:var(--color-surface-2)] p-3">
              <Select
                label="Condiciones"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value as "CASH" | "CREDIT")}
                options={[
                  { value: "CASH", label: "Contado" },
                  { value: "CREDIT", label: "Crédito" },
                ]}
                className="max-w-[200px]"
              />
              {paymentTerms === "CREDIT" && (
                <Input
                  label="Vencimiento"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="max-w-[200px]"
                />
              )}
            </div>
            <Input
              label="Notas internas"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Productos" subtitle="Busca y agrega líneas a la compra" />
          <CardBody>
            <div className="relative mb-4">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]"
              />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar producto por SKU o nombre..."
                className="atria-input pl-9"
              />
              {sugerencias.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg">
                  {sugerencias.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => agregar(p)}
                      className="flex w-full items-center justify-between gap-3 border-b border-[color:var(--color-border)] px-3 py-2 text-left text-small last:border-b-0 hover:bg-[color:var(--color-surface-2)]"
                    >
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-[11px] text-[color:var(--color-text-muted)]">
                          {p.sku}
                        </div>
                      </div>
                      <div className="text-[color:var(--color-text-muted)]">
                        Costo: {formatearMoneda(Number(p.costPrice))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {lineas.length === 0 ? (
              <p className="py-4 text-center text-small text-[color:var(--color-text-muted)]">
                Sin productos aún
              </p>
            ) : (
              <table className="w-full text-small">
                <thead className="border-b border-[color:var(--color-border)]">
                  <tr className="text-label">
                    <th className="px-2 py-2 text-left">Producto</th>
                    <th className="px-2 py-2 text-right">Cant.</th>
                    <th className="px-2 py-2 text-right">Costo</th>
                    <th className="px-2 py-2 text-right">Impuesto</th>
                    <th className="px-2 py-2 text-right">Subtotal</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => (
                    <tr key={l.id} className="border-b border-[color:var(--color-border)]">
                      <td className="px-2 py-2">{l.productName}</td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          step="0.01"
                          value={l.quantity}
                          onChange={(e) =>
                            actualizar(l.id, { quantity: parseFloat(e.target.value) || 0 })
                          }
                          className="atria-input w-20 text-right"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          step="0.01"
                          value={l.unitCost}
                          onChange={(e) =>
                            actualizar(l.id, { unitCost: parseFloat(e.target.value) || 0 })
                          }
                          className="atria-input w-28 text-right"
                        />
                      </td>
                      <td className="px-2 py-2 text-right text-[color:var(--color-text-muted)]">
                        {formatearMoneda(l.quantity * l.unitCost * l.taxRate)}
                      </td>
                      <td className="px-2 py-2 text-right font-medium">
                        {formatearMoneda(l.quantity * l.unitCost)}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => quitar(l.id)}
                          className="rounded p-1 text-[color:var(--color-error)] hover:bg-[color:var(--color-error-bg)]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="ml-auto max-w-sm space-y-1 text-small">
              <Fila label="Subtotal" valor={formatearMoneda(subtotal)} />
              <Fila label="Impuestos" valor={formatearMoneda(impuestos)} />
              <div className="mt-2 flex justify-between border-t border-[color:var(--color-border)] pt-2">
                <span className="text-label">Total</span>
                <span className="text-xl font-bold text-[color:var(--color-primary)]">
                  {formatearMoneda(total)}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => router.back()} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            onClick={registrar}
            loading={enviando}
            disabled={!supplierId || lineas.length === 0}
          >
            <Plus size={14} /> Registrar compra
          </Button>
        </div>
      </div>
    </div>
  );
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[color:var(--color-text-muted)]">{label}</span>
      <span className="font-medium">{valor}</span>
    </div>
  );
}
