"use client";

import { useState } from "react";
import { Users, Plus, Mail, Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useApi, ApiAviso } from "@/lib/use-api";
import { apiClient, ApiError, ApiDisabledError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

type Cliente = {
  id: string;
  code: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  documentId: string | null;
  createdAt: string;
};

const schema = z.object({
  fullName: z.string().min(2),
  email: z.string().email("Correo no válido").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  documentId: z.string().optional().or(z.literal("")),
});

type Form = z.infer<typeof schema>;

export default function ClientesPage() {
  const { data, loading, apiDisabled, error, refetch } = useApi<Cliente[]>("/sales/customers");
  const { mostrar } = useToast();
  const [modal, setModal] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", phone: "", documentId: "" },
  });

  async function onSubmit(values: Form) {
    setEnviando(true);
    try {
      await apiClient.post("/sales/customers", values);
      mostrar("success", "Cliente creado");
      setModal(false);
      reset();
      await refetch();
    } catch (err) {
      if (err instanceof ApiDisabledError) mostrar("error", "API deshabilitada");
      else if (err instanceof ApiError) mostrar("error", err.message);
      else mostrar("error", "No pudimos crear el cliente");
    } finally {
      setEnviando(false);
    }
  }

  const columnas: Columna<Cliente>[] = [
    {
      key: "code",
      header: "Código",
      cell: (r) => <span className="font-mono text-[12px]">{r.code}</span>,
      width: "100px",
    },
    {
      key: "nombre",
      header: "Cliente",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.fullName}</div>
          {r.documentId && (
            <div className="text-[11px] text-[color:var(--color-text-muted)]">
              {r.documentId}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "contacto",
      header: "Contacto",
      cell: (r) => (
        <div className="space-y-0.5">
          {r.email && (
            <div className="flex items-center gap-1 text-[12px]">
              <Mail size={11} className="text-[color:var(--color-text-muted)]" /> {r.email}
            </div>
          )}
          {r.phone && (
            <div className="flex items-center gap-1 text-[12px]">
              <Phone size={11} className="text-[color:var(--color-text-muted)]" /> {r.phone}
            </div>
          )}
          {!r.email && !r.phone && (
            <span className="italic text-[color:var(--color-text-muted)]">—</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={loading ? "Cargando..." : `${data?.length ?? 0} clientes registrados`}
        actions={
          <Button size="sm" onClick={() => setModal(true)}>
            <Plus size={14} /> Nuevo cliente
          </Button>
        }
      />

      <ApiAviso apiDisabled={apiDisabled} error={error} />

      {!data || data.length === 0 ? (
        <div className="atria-card">
          <EmptyState
            icon={Users}
            titulo="Aún no hay clientes"
            descripcion="Registra clientes para emitirles facturas y darles crédito."
            accion={
              <Button size="sm" onClick={() => setModal(true)}>
                <Plus size={14} /> Crear primer cliente
              </Button>
            }
          />
        </div>
      ) : (
        <DataTable data={data} columns={columnas} rowKey={(r) => r.id} />
      )}

      <Modal
        abierto={modal}
        onCerrar={() => !enviando && setModal(false)}
        titulo="Nuevo cliente"
        descripcion="Datos para facturación y contacto"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={enviando}>
              Crear
            </Button>
          </>
        }
      >
        <form className="space-y-3">
          <Input
            label="Nombre o razón social"
            error={errors.fullName?.message}
            {...register("fullName")}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Correo electrónico"
              type="email"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input label="Teléfono" {...register("phone")} />
          </div>
          <Input label="Identificación fiscal" {...register("documentId")} />
        </form>
      </Modal>
    </div>
  );
}
