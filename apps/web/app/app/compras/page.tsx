"use client";

import Link from "next/link";
import { useState } from "react";
import { Truck, Plus, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useApi, ApiAviso } from "@/lib/use-api";
import { apiClient, ApiError, ApiDisabledError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { formatearMoneda, formatearFecha } from "@/lib/utils";

type Compra = {
  referenceId: string;
  createdAt: string;
  supplierName: string | null;
  branchName: string;
  itemCount: number;
  total: number;
  note: string | null;
};

type ComprasPage = { data: Compra[]; meta: { page: number; pageSize: number; total: number } };

type Supplier = {
  id: string;
  name: string;
  taxIdentifier: string | null;
  phone: string | null;
  email: string | null;
};

export default function ComprasPage() {
  const compras = useApi<ComprasPage>("/purchases?pageSize=50");
  const suppliers = useApi<Supplier[]>("/purchases/suppliers");
  const { mostrar } = useToast();
  const [modalProveedor, setModalProveedor] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    taxIdentifier: "",
    contactName: "",
  });

  async function crearProveedor() {
    setEnviando(true);
    try {
      await apiClient.post("/purchases/suppliers", form);
      mostrar("success", "Proveedor creado");
      setModalProveedor(false);
      setForm({ name: "", email: "", phone: "", taxIdentifier: "", contactName: "" });
      await suppliers.refetch();
    } catch (err) {
      if (err instanceof ApiDisabledError) mostrar("error", "API deshabilitada");
      else if (err instanceof ApiError) mostrar("error", err.message);
      else mostrar("error", "No pudimos crear el proveedor");
    } finally {
      setEnviando(false);
    }
  }

  const columnas: Columna<Compra>[] = [
    {
      key: "fecha",
      header: "Fecha",
      cell: (r) => formatearFecha(r.createdAt),
      width: "120px",
    },
    {
      key: "ref",
      header: "Referencia",
      cell: (r) => <span className="font-mono text-[11px]">{r.referenceId.slice(0, 8)}</span>,
    },
    {
      key: "items",
      header: "Productos",
      align: "right",
      cell: (r) => r.itemCount,
    },
    {
      key: "sucursal",
      header: "Sucursal",
      cell: (r) => r.branchName,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (r) => <span className="font-semibold">{formatearMoneda(r.total)}</span>,
    },
    {
      key: "nota",
      header: "Detalle",
      cell: (r) => (
        <span className="text-[color:var(--color-text-muted)]">{r.note ?? "—"}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Compras"
        subtitle={
          compras.loading
            ? "Cargando..."
            : `${compras.data?.meta.total ?? 0} compras · ${suppliers.data?.length ?? 0} proveedores`
        }
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setModalProveedor(true)}>
              <Truck size={14} /> Proveedor
            </Button>
            <Link href="/app/compras/nueva" className="atria-btn atria-btn-primary atria-btn-sm">
              <Plus size={14} /> Nueva compra
            </Link>
          </div>
        }
      />

      <ApiAviso apiDisabled={compras.apiDisabled} error={compras.error} />

      {!compras.data || compras.data.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            titulo="Sin compras registradas"
            descripcion="Cuando registres entradas al inventario aparecerán aquí."
            accion={
              <Link href="/app/compras/nueva">
                <Button size="sm">
                  <Plus size={14} /> Registrar primera compra
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <DataTable data={compras.data.data} columns={columnas} rowKey={(r) => r.referenceId} />
      )}

      <Card className="mt-6">
        <CardHeader title="Proveedores" subtitle={`${suppliers.data?.length ?? 0} registrados`} />
        <CardBody className="p-0">
          {!suppliers.data || suppliers.data.length === 0 ? (
            <div className="px-5 py-6 text-center text-small text-[color:var(--color-text-muted)]">
              <Truck size={20} className="mx-auto mb-1 opacity-40" /> Sin proveedores
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--color-border)]">
              {suppliers.data.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-small"
                >
                  <div>
                    <div className="font-medium">{s.name}</div>
                    {(s.taxIdentifier || s.phone || s.email) && (
                      <div className="text-[11px] text-[color:var(--color-text-muted)]">
                        {[s.taxIdentifier, s.phone, s.email].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                  <Badge variant="neutral">Proveedor</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        abierto={modalProveedor}
        onCerrar={() => !enviando && setModalProveedor(false)}
        titulo="Nuevo proveedor"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalProveedor(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={crearProveedor} loading={enviando} disabled={!form.name}>
              Crear
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Correo"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Teléfono"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <Input
            label="Identificación fiscal"
            value={form.taxIdentifier}
            onChange={(e) => setForm({ ...form, taxIdentifier: e.target.value })}
          />
          <Input
            label="Contacto"
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}
