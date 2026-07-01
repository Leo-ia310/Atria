"use client";

import { useState } from "react";
import { Building2, Plus, Warehouse } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useApi, ApiAviso } from "@/lib/use-api";
import { apiClient, ApiError, ApiDisabledError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { formatearMoneda } from "@/lib/utils";

type Branch = {
  id: string;
  code: string;
  name: string;
  addressLine1: string | null;
  city: string | null;
  countryCode: string;
  isPrimary: boolean;
  warehouses: { id: string; name: string }[];
  _count: { memberships: number; sales: number };
};

type BranchAnalytics = {
  id: string;
  name: string;
  ventas: number;
  valorInventario: number;
  bodegas: number;
};

const schema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(100),
  addressLine1: z.string().min(2),
  city: z.string().min(2),
  countryCode: z.string().min(2).max(2),
  warehouseName: z.string().min(2).default("Bodega principal"),
});

type Form = z.infer<typeof schema>;

export default function SucursalesPage() {
  const branches = useApi<Branch[]>("/branches");
  const analytics = useApi<BranchAnalytics[]>("/branches/analytics");
  const { mostrar } = useToast();
  const [modal, setModal] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      name: "",
      addressLine1: "",
      city: "",
      countryCode: "NI",
      warehouseName: "Bodega principal",
    },
  });

  async function onSubmit(values: Form) {
    setEnviando(true);
    try {
      await apiClient.post("/branches", values);
      mostrar("success", "Sucursal creada");
      setModal(false);
      reset();
      await Promise.all([branches.refetch(), analytics.refetch()]);
    } catch (err) {
      if (err instanceof ApiDisabledError) mostrar("error", "API deshabilitada");
      else if (err instanceof ApiError) mostrar("error", err.message);
      else mostrar("error", "No pudimos crear la sucursal");
    } finally {
      setEnviando(false);
    }
  }

  const analyticsMap = new Map((analytics.data ?? []).map((a) => [a.id, a]));

  const columnas: Columna<Branch>[] = [
    {
      key: "code",
      header: "Código",
      cell: (r) => <span className="font-mono text-[12px]">{r.code}</span>,
      width: "100px",
    },
    {
      key: "nombre",
      header: "Sucursal",
      cell: (r) => (
        <div>
          <div className="flex items-center gap-2 font-medium">
            {r.name}
            {r.isPrimary && <Badge variant="info">Principal</Badge>}
          </div>
          <div className="text-[11px] text-[color:var(--color-text-muted)]">
            {[r.addressLine1, r.city, r.countryCode].filter(Boolean).join(", ")}
          </div>
        </div>
      ),
    },
    {
      key: "warehouses",
      header: "Bodegas",
      align: "right",
      cell: (r) => (
        <span className="flex items-center justify-end gap-1">
          <Warehouse size={12} /> {r.warehouses.length}
        </span>
      ),
    },
    {
      key: "miembros",
      header: "Equipo",
      align: "right",
      cell: (r) => r._count.memberships,
    },
    {
      key: "ventas",
      header: "Ventas",
      align: "right",
      cell: (r) => formatearMoneda(analyticsMap.get(r.id)?.ventas ?? 0),
    },
    {
      key: "inventario",
      header: "Inv. valorizado",
      align: "right",
      cell: (r) => (
        <span className="text-[color:var(--color-text-muted)]">
          {formatearMoneda(analyticsMap.get(r.id)?.valorInventario ?? 0)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Sucursales"
        subtitle={
          branches.loading
            ? "Cargando..."
            : `${branches.data?.length ?? 0} sucursales activas`
        }
        actions={
          <Button size="sm" onClick={() => setModal(true)}>
            <Plus size={14} /> Nueva sucursal
          </Button>
        }
      />

      <ApiAviso apiDisabled={branches.apiDisabled} error={branches.error} />

      {!branches.data || branches.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            titulo="Aún no hay sucursales"
            descripcion="Tu sucursal principal se crea al registrar la empresa."
          />
        </Card>
      ) : (
        <DataTable data={branches.data} columns={columnas} rowKey={(r) => r.id} />
      )}

      <Modal
        abierto={modal}
        onCerrar={() => !enviando && setModal(false)}
        titulo="Nueva sucursal"
        descripcion="Crea un punto de operación adicional"
        ancho="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={enviando}>
              Crear sucursal
            </Button>
          </>
        }
      >
        <form className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Código"
              placeholder="SUC02"
              error={errors.code?.message}
              {...register("code")}
            />
            <Input label="Nombre" error={errors.name?.message} {...register("name")} />
          </div>
          <Input
            label="Dirección"
            error={errors.addressLine1?.message}
            {...register("addressLine1")}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Ciudad" error={errors.city?.message} {...register("city")} />
            <Input
              label="País (ISO 2)"
              placeholder="NI"
              error={errors.countryCode?.message}
              {...register("countryCode")}
            />
          </div>
          <Input
            label="Nombre de la bodega"
            error={errors.warehouseName?.message}
            {...register("warehouseName")}
          />
        </form>
      </Modal>

      <Card className="mt-6">
        <CardHeader title="Resumen por sucursal" subtitle="Ventas vs. inventario valorizado" />
        <CardBody className="p-0">
          {!analytics.data || analytics.data.length === 0 ? (
            <div className="p-5 text-center text-small text-[color:var(--color-text-muted)]">
              Sin métricas aún
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--color-border)]">
              {analytics.data.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 px-5 py-3 text-small">
                  <div className="font-medium">{a.name}</div>
                  <div className="flex gap-6 text-right">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        Ventas
                      </div>
                      <div className="font-semibold">{formatearMoneda(a.ventas)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        Inventario
                      </div>
                      <div className="font-semibold">{formatearMoneda(a.valorInventario)}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
