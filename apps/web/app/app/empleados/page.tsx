"use client";

import { useState } from "react";
import { UserCog, Plus, Clock, Activity } from "lucide-react";
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
import { Select } from "@/components/ui/Select";
import { useApi, ApiAviso } from "@/lib/use-api";
import { apiClient, ApiError, ApiDisabledError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { formatearFechaHora } from "@/lib/utils";

type Empleado = {
  id: string;
  employeeCode: string;
  jobTitle: string;
  hireDate: string;
  branch: { name: string };
  membership: {
    user: { firstName: string; lastName: string; email: string };
    role: { key: string; name: string };
  };
};

type Asistencia = {
  id: string;
  membershipId: string;
  clockIn: string;
  clockOut: string | null;
  duration: number | null;
};

type Activity = {
  id: string;
  action: string;
  context: Record<string, unknown>;
  performedAt: string;
  membership: { user: { firstName: string; lastName: string } } | null;
};

type Branch = { id: string; name: string };

const ROLE_OPTIONS = [
  { value: "owner", label: "Dueño" },
  { value: "admin", label: "Administrador" },
  { value: "accountant", label: "Contador" },
  { value: "worker", label: "Operador" },
];

const schema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(10),
  roleKey: z.string(),
  branchId: z.string().uuid("Selecciona una sucursal"),
  jobTitle: z.string().optional().or(z.literal("")),
});

type Form = z.infer<typeof schema>;

export default function EmpleadosPage() {
  const empleados = useApi<Empleado[]>("/employees");
  const asistencia = useApi<Asistencia[]>("/employees/attendance");
  const actividad = useApi<Activity[]>("/employees/activity");
  const branches = useApi<Branch[]>("/branches");
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
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      roleKey: "worker",
      branchId: "",
      jobTitle: "",
    },
  });

  async function onSubmit(values: Form) {
    setEnviando(true);
    try {
      await apiClient.post("/employees", values);
      mostrar("success", "Empleado creado");
      setModal(false);
      reset();
      await empleados.refetch();
    } catch (err) {
      if (err instanceof ApiDisabledError) mostrar("error", "API deshabilitada");
      else if (err instanceof ApiError) mostrar("error", err.message);
      else mostrar("error", "No pudimos crear el empleado");
    } finally {
      setEnviando(false);
    }
  }

  const columnas: Columna<Empleado>[] = [
    {
      key: "code",
      header: "Código",
      cell: (r) => <span className="font-mono text-[12px]">{r.employeeCode}</span>,
      width: "100px",
    },
    {
      key: "nombre",
      header: "Empleado",
      cell: (r) => (
        <div>
          <div className="font-medium">
            {r.membership.user.firstName} {r.membership.user.lastName}
          </div>
          <div className="text-[11px] text-[color:var(--color-text-muted)]">
            {r.membership.user.email}
          </div>
        </div>
      ),
    },
    { key: "puesto", header: "Puesto", cell: (r) => r.jobTitle },
    { key: "sucursal", header: "Sucursal", cell: (r) => r.branch.name },
    {
      key: "rol",
      header: "Rol",
      cell: (r) => <Badge variant="info">{r.membership.role.name ?? r.membership.role.key}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Empleados"
        subtitle={
          empleados.loading
            ? "Cargando..."
            : `${empleados.data?.length ?? 0} miembros del equipo`
        }
        actions={
          <Button size="sm" onClick={() => setModal(true)}>
            <Plus size={14} /> Nuevo empleado
          </Button>
        }
      />

      <ApiAviso apiDisabled={empleados.apiDisabled} error={empleados.error} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!empleados.data || empleados.data.length === 0 ? (
            <Card>
              <EmptyState
                icon={UserCog}
                titulo="Sin empleados registrados"
                descripcion="Invita a tu equipo para asignarles ventas y permisos."
              />
            </Card>
          ) : (
            <DataTable data={empleados.data} columns={columnas} rowKey={(r) => r.id} />
          )}
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader title="Asistencia hoy" />
            <CardBody className="p-0">
              {!asistencia.data || asistencia.data.length === 0 ? (
                <div className="px-4 py-6 text-center text-small text-[color:var(--color-text-muted)]">
                  <Clock size={20} className="mx-auto mb-1 opacity-40" /> Sin marcaciones
                </div>
              ) : (
                <ul className="divide-y divide-[color:var(--color-border)]">
                  {asistencia.data.slice(0, 5).map((a) => (
                    <li key={a.id} className="px-4 py-2 text-small">
                      <div className="flex justify-between">
                        <span>Entrada: {formatearFechaHora(a.clockIn)}</span>
                        {a.clockOut && <Badge variant="success">Salida</Badge>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Actividad reciente" />
            <CardBody className="p-0">
              {!actividad.data || actividad.data.length === 0 ? (
                <div className="px-4 py-6 text-center text-small text-[color:var(--color-text-muted)]">
                  <Activity size={20} className="mx-auto mb-1 opacity-40" /> Sin actividad
                </div>
              ) : (
                <ul className="divide-y divide-[color:var(--color-border)]">
                  {actividad.data.slice(0, 6).map((a) => (
                    <li key={a.id} className="px-4 py-2 text-small">
                      <div className="font-medium">{a.action}</div>
                      <div className="text-[11px] text-[color:var(--color-text-muted)]">
                        {a.membership?.user.firstName}{" "}
                        {a.membership?.user.lastName} ·{" "}
                        {formatearFechaHora(a.performedAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        abierto={modal}
        onCerrar={() => !enviando && setModal(false)}
        titulo="Nuevo empleado"
        descripcion="Crea acceso al sistema con rol y sucursal"
        ancho="lg"
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Nombre" error={errors.firstName?.message} {...register("firstName")} />
            <Input label="Apellido" error={errors.lastName?.message} {...register("lastName")} />
          </div>
          <Input label="Correo" type="email" error={errors.email?.message} {...register("email")} />
          <Input
            label="Contraseña temporal"
            type="password"
            hint="Mínimo 10 caracteres"
            error={errors.password?.message}
            {...register("password")}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Rol" {...register("roleKey")} options={ROLE_OPTIONS} />
            <Select
              label="Sucursal"
              placeholder="Selecciona..."
              {...register("branchId")}
              options={(branches.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
              error={errors.branchId?.message}
            />
          </div>
          <Input label="Puesto / cargo" placeholder="Operación" {...register("jobTitle")} />
        </form>
      </Modal>
    </div>
  );
}
